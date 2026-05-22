import { supabase } from './supabaseClient';
import type { SOSAlert } from './database.types';
// @ts-ignore
// import { Camera } from '@capacitor/camera';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

interface SOSConfig {
    message: string;
    highPriority: boolean;
    notifyContacts: boolean;
    shareLocation: boolean;
    mode?: 'discrete' | 'visible';
    type?: string;
    mediaUrl?: string;
    privacyPolicyAccepted?: boolean;
}

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

export async function startSOSPreview(options: { position?: 'front' | 'rear' } = { position: 'rear' }) {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { CameraPreview } = await import('@capacitor-community/camera-preview');
        await CameraPreview.start({
            parent: "sos-native-preview",
            position: options.position || "rear",
            toBack: true,
            storeToFile: false,
            className: "sos-native-preview"
        });
    } catch (err) {
        console.error('[SOS-Service] Native Preview fail:', err);
    }
}

export async function stopSOSPreview() {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { CameraPreview } = await import('@capacitor-community/camera-preview');
        await CameraPreview.stop();
    } catch (err) {
        console.log('[SOS-Service] stopSOSPreview check:', err);
    }
}

export async function requestSOSPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
        const { Camera } = await import('@capacitor/camera');
        const { Geolocation } = await import('@capacitor/geolocation');
        
        const cameraStatus = await Camera.requestPermissions({ permissions: ['camera'] });
        const voiceStatus = await VoiceRecorder.requestAudioRecordingPermission();
        
        // Request Location permissions (targeting 'Always' if available)
        const locationStatus = await Geolocation.requestPermissions();
        
        console.log('[SOS-Service] Permission statuses:', {
            camera: cameraStatus.camera,
            voice: voiceStatus.value,
            location: locationStatus.location
        });

        return cameraStatus.camera === 'granted' && voiceStatus.value === true && locationStatus.location === 'granted';
    } catch (err) {
        console.error('[SOS-Service] Permission fail:', err);
        return false;
    }
}

/**
 * Starts recording (Audio for Free, Video for Premium on supported platforms)
 */
export async function startRecording(isPremium: boolean = false, options: { position?: 'user' | 'environment' } = { position: 'user' }): Promise<{ success: boolean; stream?: MediaStream }> {
    try {
        await requestSOSPermissions();
        const isNative = Capacitor.isNativePlatform();
        
        // Native Platform currently uses dedicated VoiceRecorder (Better for background/lock)
        if (isNative) {
            const { value: canRecord } = await VoiceRecorder.canDeviceVoiceRecord();
            if (canRecord) {
                await VoiceRecorder.startRecording();
                return { success: true };
            }
        }

        recordedChunks = [];
        // Video is a Premium-only feature
        const constraints = (isPremium && !isNative)
            ? { video: { facingMode: options.position || 'user' }, audio: true }
            : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start();
        return { success: true, stream };
    } catch (error) {
        console.error('[SOS-Service] startRecording error:', error);
        return { success: true };
    }
}

export async function stopAndUploadRecording(userId: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
        try {
            const result = await VoiceRecorder.stopRecording();
            if (result.value?.recordDataBase64) {
                const base64Data = result.value.recordDataBase64;
                const mimeType = result.value.mimeType || 'audio/aac';
                const byteCharacters = atob(base64Data);
                const byteArray = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
                const blob = new Blob([byteArray], { type: mimeType });
                const fileName = `${userId}/${Date.now()}.m4a`;
                const { error } = await supabase.storage.from('sos-recordings').upload(fileName, blob, { contentType: mimeType });
                if (error) throw error;
                const { data } = supabase.storage.from('sos-recordings').getPublicUrl(fileName);
                return data.publicUrl;
            }
        } catch (err) {
            console.error('[SOS-Service] Native upload fail:', err);
        }
        return null;
    }
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return resolve(null);
        mediaRecorder.onstop = async () => {
            try {
                const mimeType = mediaRecorder?.mimeType || 'video/webm';
                const blob = new Blob(recordedChunks, { type: mimeType });
                const fileName = `${userId}/${Date.now()}.webm`;
                await supabase.storage.from('sos-recordings').upload(fileName, blob, { contentType: mimeType });
                const { data } = supabase.storage.from('sos-recordings').getPublicUrl(fileName);
                resolve(data.publicUrl);
            } catch (err) { resolve(null); }
        };
        mediaRecorder.stop();
    });
}

async function getBatteryLevel(): Promise<string> {
    try {
        // @ts-ignore
        if ('getBattery' in navigator) {
            // @ts-ignore
            const battery = await navigator.getBattery();
            return `${Math.round(battery.level * 100)}%`;
        }
        return 'N/A';
    } catch (e) { return 'N/A'; }
}

export async function activateSOS(
    userId: string,
    groupId: string,
    config: SOSConfig
): Promise<{ alert: SOSAlert | null; error: string | null }> {
    if (!userId || userId.trim() === '' || !groupId || groupId.trim() === '') {
        console.error('[SOS-Service] Missing IDs:', { userId, groupId });
        return { alert: null, error: "Sesión o grupo no válido" };
    }

    try {
        // 1. Get position with fallback
        const position = await (async () => {
            try {
                const geoPromise = new Promise<GeolocationPosition | null>((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (p) => resolve(p),
                        (err) => {
                            console.warn('[SOS-Service] Geolocation error:', err);
                            resolve(null);
                        },
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
                    );
                });
                const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
                return Promise.race([geoPromise, timeoutPromise]);
            } catch (e) {
                return null;
            }
        })();

        const battery = await getBatteryLevel();
        
        let msg = config.message;
        if (config.type) msg = `🚨 NOTA DE TRAYECTO: ${config.type.toUpperCase()}\n\n` + msg;
        
        if (config.shareLocation && position) {
            msg += `\n\n📍 UBICACIÓN EN TIEMPO REAL:\nhttps://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
        }

        msg += `\n\n🎥 VER VÍDEO DEL TRAYECTO:\nEsperando secuencia...`;
        msg += `\n\n🔋 Batería: ${battery}`;

        const alertData: any = {
            user_id: userId,
            group_id: groupId,
            lat: position?.coords.latitude || null,
            lng: position?.coords.longitude || null,
            status: 'active',
            message: msg,
            mode: config.mode || 'visible',
            media_url: config.mediaUrl || null,
        };

        // Fetch User Context Payload Data
        try {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
            const { data: recentLocations } = await supabase.from('locations').select('lat, lng, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
            
            alertData.context_payload = {
                timestamp_ms: Date.now(),
                battery: battery,
                user_profile: profile ? {
                    dob: profile.dob,
                    habitual_city: profile.habitual_city,
                    walking_alone_frequency: profile.walking_alone_frequency,
                    risk_exposure_level: profile.risk_exposure_level,
                    habitual_zones: profile.habitual_zones
                } : null,
                recent_locations: recentLocations || []
            };
        } catch (e) {
            console.warn('[SOS-Service] Failed to fetch context payload:', e);
        }

        console.log('[SOS-Service] Inserting alert into DB...');
        const alertPromise = (supabase.from('sos_alerts') as any).insert(alertData).select().single();
        const dbTimeout = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera de base de datos agotado')), 10000));
        
        const result = await Promise.race([alertPromise, dbTimeout]) as any;
        
        if (result instanceof Error) throw result;
        const { data: alert, error } = result;

        if (error) {
            console.error('[SOS-Service] DB Insert error:', error);
            return { alert: null, error: `Error DB: ${error.message}` };
        }
        
        if (!alert) return { alert: null, error: 'No se pudo crear el aviso' };

        console.log('[SOS-Service] Alert created successfully:', alert.id);

        // Invoke notifications in background
        supabase.functions.invoke('send-sos-notifications', { body: { alertId: alert.id, userId, groupId, config } })
            .catch((err: any) => console.error('[SOS-Service] Notification fail:', err));

        return { alert, error: null };
    } catch (err: any) {
        console.error('[SOS-Service] Critical activation error:', err);
        return { alert: null, error: err.message || 'Error crítico de activación' };
    }
}

export async function resolveSOS(alertId: string, status: 'resolved' | 'cancelled' = 'resolved'): Promise<{ error: string | null }> {
    const { error } = await (supabase.from('sos_alerts') as any).update({ status } as any).eq('id', alertId);
    return { error: error?.message || null };
}

export async function updateSOSAlertMedia(alertId: string, mediaUrl: string): Promise<{ error: string | null }> {
    const isVideo = mediaUrl.includes('.webm') || mediaUrl.includes('.mp4');
    
    await (supabase.from('sos_alerts') as any).update({ 
        media_url: mediaUrl,
        media_audio_url: !isVideo ? mediaUrl : null,
        media_video_url: isVideo ? mediaUrl : null
    } as any).eq('id', alertId);

    supabase.functions.invoke('send-sos-notifications', {
        body: { alertId, action: 'media_uploaded', mediaUrl, config: { message: `Media: ${mediaUrl}`, notifyContacts: true } }
    }).catch(() => {});
    return { error: null };
}

export async function getActiveAlerts(groupId: string): Promise<SOSAlert[]> {
    const { data } = await supabase.from('sos_alerts').select('*').eq('group_id', groupId).eq('status', 'active').order('created_at', { ascending: false });
    return data || [];
}

export async function getSOSHistory(groupId: string, limit: number = 20): Promise<SOSAlert[]> {
    const { data } = await supabase.from('sos_alerts').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
}

export function subscribeToSOSAlerts(groupId: string, onNewAlert: (alert: SOSAlert) => void) {
    const subscription = supabase
        .channel(`sos-alerts-${groupId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'sos_alerts',
                filter: `group_id=eq.${groupId}`
            },
            (payload: any) => {
                onNewAlert(payload.new as SOSAlert);
            }
        )
        .subscribe();
    return {
        unsubscribe: () => {
            supabase.removeChannel(subscription);
        }
    };
}

export async function call112() {
    console.log('[SOS-Service] Initiating 112 call...');
    if (Capacitor.isNativePlatform()) {
        // Use tel: link which triggers OS dialer
        window.location.href = 'tel:112';
    } else {
        alert('Simulación de llamada al 112 (Solo disponible en dispositivos móviles)');
    }
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        const { receive } = await FirebaseMessaging.requestPermissions();
        return receive === 'granted';
    } catch (err) {
        console.error('[SOS-Service] Notification permission fail:', err);
        return false;
    }
}

export async function executeSOSProtocol(userId: string, groupId: string, type: string = 'security') {
    console.log('[SOS-Service] EXECUTING ROUTE NOTICE PROTOCOL');
    
    // 1. Trigger 112 Call Immediately (Dialer)
    call112();

    // 2. Trigger Database Alert & Notifications to Trusted Contacts
    const { alert, error } = await activateSOS(userId, groupId, {
        message: `⚠️ AVISO DE TRAYECTO. \nHe activado una nota de trayecto. Mi ubicación y cámara han sido compartidas con mis contactos seleccionados. Por favor, revisa mi progreso.`,
        highPriority: false,
        notifyContacts: true,
        shareLocation: true,
        mode: 'visible',
        type: type
    });

    return { alert, error };
}