import { supabase } from './supabaseClient';
import type { SOSAlert } from './database.types';
// @ts-ignore
import { Camera } from '@capacitor/camera';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

interface SOSConfig {
    message: string;
    callPolice: boolean;
    notifyContacts: boolean;
    shareLocation: boolean;
    mode?: 'discrete' | 'visible';
    type?: string;
    mediaUrl?: string;
    privacyPolicyAccepted?: boolean;
}

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

export async function startSOSPreview() {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { CameraPreview } = await import('@capacitor-community/camera-preview');
        await CameraPreview.start({
            parent: "sos-native-preview",
            position: "rear",
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
        const cameraStatus = await Camera.requestPermissions({ permissions: ['camera'] });
        const voiceStatus = await VoiceRecorder.requestAudioRecordingPermission();
        return cameraStatus.camera === 'granted' && voiceStatus.value === true;
    } catch (err) {
        console.error('[SOS-Service] Permission fail:', err);
        return false;
    }
}

export async function startRecording(videoEnabled: boolean = true): Promise<{ success: boolean; stream?: MediaStream }> {
    try {
        await requestSOSPermissions();
        const isNative = Capacitor.isNativePlatform();
        if (isNative) {
            const { value: canRecord } = await VoiceRecorder.canDeviceVoiceRecord();
            if (canRecord) {
                await VoiceRecorder.startRecording();
                return { success: true };
            }
        }
        recordedChunks = [];
        const constraints = (videoEnabled && !isNative)
            ? { video: { facingMode: 'user' }, audio: true }
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
    try {
        const position = await (async () => {
            const geoPromise = new Promise<GeolocationPosition | null>((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (p) => resolve(p),
                    () => resolve(null),
                    { enableHighAccuracy: true, timeout: 2000, maximumAge: 5000 }
                );
            });
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
            return Promise.race([geoPromise, timeoutPromise]);
        })();
        const battery = await getBatteryLevel();
        
        let msg = config.message;
        if (config.type) msg = `🚨 EMERGENCIA SOS: ${config.type.toUpperCase()}\n\n` + msg;
        
        if (config.shareLocation && position) {
            msg += `\n\n📍 UBICACIÓN EN TIEMPO REAL:\nhttps://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
        }

        // Add Video Placeholder Link (will be updated when recording finishes)
        msg += `\n\n🎥 VER VÍDEO PRUEBA:\nEsperando secuencia...`;
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
        const alertPromise = (supabase.from('sos_alerts') as any).insert(alertData).select().single();
        const dbTimeout = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera de base de datos agotado')), 8000));
        const { data: alert, error } = await Promise.race([alertPromise, dbTimeout]) as any;
        if (error) return { alert: null, error: error.message };
        if (!alert) return { alert: null, error: 'No se pudo crear la alerta' };
        supabase.functions.invoke('send-sos-notifications', { body: { alertId: alert.id, userId, groupId, config } })
            .catch((err: any) => console.error('[SOS-Service] Notification fail:', err));
        return { alert, error: null };
    } catch (err: any) {
        return { alert: null, error: err.message || 'Logic error' };
    }
}

export async function resolveSOS(alertId: string, status: 'resolved' | 'cancelled' = 'resolved'): Promise<{ error: string | null }> {
    const { error } = await (supabase.from('sos_alerts') as any).update({ status } as any).eq('id', alertId);
    return { error: error?.message || null };
}

export async function updateSOSAlertMedia(alertId: string, mediaUrl: string): Promise<{ error: string | null }> {
    await (supabase.from('sos_alerts') as any).update({ media_url: mediaUrl } as any).eq('id', alertId);
    supabase.functions.invoke('send-sos-notifications', {
        body: { alertId, action: 'media_uploaded', mediaUrl, config: { message: `Media: ${mediaUrl}`, notifyContacts: true } }
    }).catch(() => {});
    return { error: null };
}

export async function getActiveAlerts(groupId: string): Promise<SOSAlert[]> {
    const { data } = await supabase.from('sos_alerts').select('*').eq('group_id', groupId).eq('status', 'active').order('created_at', { ascending: false });
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
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const status = await PushNotifications.requestPermissions();
        return status.receive === 'granted';
    } catch (err) {
        console.error('[SOS-Service] Notification permission fail:', err);
        return false;
    }
}

/**
 * Execute Full SOS Protocol
 * 1. Dial 112
 * 2. Activate Alert (Notify Contacts + Location)
 * 3. Return alert info
 */
export async function executeSOSProtocol(userId: string, groupId: string, type: string = 'security') {
    console.log('[SOS-Service] EXECUTING FULL SOS PROTOCOL');
    
    // 1. Trigger 112 Call Immediately
    call112();

    // 2. Trigger Database Alert & Notifications
    const { alert, error } = await activateSOS(userId, groupId, {
        message: `⚠️ ALGO ESTÁ PASANDO. \nHe activado una alerta SOS y las autoridades han sido notificadas. Por favor, revisa mi ubicación.`,
        callPolice: true,
        notifyContacts: true,
        shareLocation: true,
        mode: 'visible',
        type: type
    });

    return { alert, error };
}
