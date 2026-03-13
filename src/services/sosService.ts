import { supabase, isMockMode } from './supabaseClient';
import type { SOSAlert, EmergencyContact } from './database.types';
import { CameraPreview } from '@capacitor-community/camera-preview';
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

/**
 * Start audio/video recording (Web API)
 */
export async function startRecording(videoEnabled: boolean = true): Promise<{ success: boolean; stream?: MediaStream }> {
    try {
        recordedChunks = [];
        let stream: MediaStream | null = null;

        try {
            if (videoEnabled) {
                // Try Video + Audio (Premium)
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: true
                });
            } else {
                // Free user: Audio only
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (err) {
            console.warn('Initial media request failed, trying fallback', err);
            try {
                // Fallback to Audio only for either case if video fails but audio might work
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (authErr) {
                console.error('All media permissions denied', authErr);
                return { success: false };
            }
        }

        if (!stream) return { success: false };

        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.start();
        return { success: true, stream };
    } catch (error) {
        console.error('Error starting recording:', error);
        return { success: false };
    }
}

/**
 * Stop recording and upload to Supabase Storage
 */
export async function stopAndUploadRecording(userId: string): Promise<string | null> {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            resolve(null);
            return;
        }

        mediaRecorder.onstop = async () => {
            try {
                const mimeType = mediaRecorder?.mimeType || 'video/webm';
                const blob = new Blob(recordedChunks, { type: mimeType });

                // Determine extension based on mime type (webm for video, ogg/webm for audio usually)
                const ext = mimeType.includes('video') ? 'webm' : 'webm';
                const fileName = `${userId}/${Date.now()}.${ext}`;

                // Stop all tracks to release camera/mic
                mediaRecorder?.stream.getTracks().forEach(track => track.stop());

                const { error } = await supabase
                    .storage
                    .from('sos-recordings')
                    .upload(fileName, blob, {
                        contentType: mimeType,
                        upsert: true
                    });

                if (error) {
                    console.error('Error uploading recording:', error);
                    resolve(null);
                    return;
                }

                const { data: publicUrl } = supabase
                    .storage
                    .from('sos-recordings')
                    .getPublicUrl(fileName);

                resolve(publicUrl.publicUrl);
            } catch (error) {
                console.error('Error handling recording:', error);
                resolve(null);
            }
        };

        mediaRecorder.stop();
    });
}

/**
 * Take a silent background picture for security
 */
export async function captureSecuritySnapshot(userId: string): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
        console.warn('Camera capture only available on native devices');
        return null;
    }

    try {
        // Start camera preview hidden
        await CameraPreview.start({
            position: 'rear',
            parent: 'cameraPreview',
            className: 'cameraPreview',
            toBack: true, // Render behind the webview
            width: window.screen.width,
            height: window.screen.height
        });

        // Wait a tiny bit for the camera to focus
        await new Promise(resolve => setTimeout(resolve, 800));

        const result = await CameraPreview.capture({ quality: 50 });
        await CameraPreview.stop();

        if (!result.value) return null;

        // Convert base64 to Blob
        const response = await fetch(`data:image/jpeg;base64,${result.value}`);
        const blob = await response.blob();

        const fileName = `${userId}/sos_snapshot_${Date.now()}.jpg`;

        const { error } = await supabase
            .storage
            .from('sos-recordings')
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.error('Error uploading snapshot:', error);
            return null;
        }

        const { data: publicUrl } = supabase
            .storage
            .from('sos-recordings')
            .getPublicUrl(fileName);

        return publicUrl.publicUrl;

    } catch (err) {
        console.error('Snapshot error:', err);
        // Try to stop it just in case it failed during capture
        try { await CameraPreview.stop(); } catch (e) { }
        return null;
    }
}

/**
 * Activate SOS alert
 */
export async function activateSOS(
    userId: string,
    groupId: string,
    config: SOSConfig
): Promise<{ alert: SOSAlert | null; error: string | null }> {
    // Get current location
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
        });
    }).catch(() => null);

    let finalMessage = config.message;
    if (config.type) {
        finalMessage = `🚨 EMERGENCIA: ${config.type.toUpperCase()}\n\n` + finalMessage;
    }

    if (config.shareLocation && position) {
        finalMessage += `\n\n📍 Ubicación en tiempo real:\nhttps://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
    }

    const alertData: Omit<SOSAlert, 'id' | 'created_at'> = {
        user_id: userId,
        group_id: groupId,
        lat: position?.coords.latitude || null,
        lng: position?.coords.longitude || null,
        status: 'active',
        message: finalMessage,
        mode: config.mode || 'visible',
        media_url: config.mediaUrl || null,
        // Assuming we update profiles or pass metadata here
    } as any;

    // Create alert in database
    const { data: alert, error } = await (supabase.from('sos_alerts') as any)
        .insert(alertData)
        .select()
        .single();

    if (error) {
        console.error('Error creating SOS alert:', error);
        return { alert: null, error: error.message };
    }

    // Trigger notifications via Edge Function
    const { error: funcError } = await supabase.functions.invoke('send-sos-notifications', {
        body: {
            alertId: alert.id,
            userId,
            groupId,
            config,
        }
    });

    if (funcError) {
        console.error('Error invoking SOS function:', funcError);
    }

    // Call emergency services if configured
    if (config.callPolice) {
        // This would integrate with native calling capability
        console.log('📞 Calling emergency services...');
        window.location.href = 'tel:112';
    }

    return { alert, error: null };
}

/**
 * Cancel/resolve SOS alert
 */
export async function resolveSOS(
    alertId: string,
    status: 'resolved' | 'cancelled' = 'resolved'
): Promise<{ error: string | null }> {
    if (isMockMode) {
        console.log(`✅ SOS ${status}:`, alertId);
        return { error: null };
    }

    const { error } = await (supabase.from('sos_alerts') as any)
        .update({ status } as any)
        .eq('id', alertId);

    return { error: error?.message || null };
}

/**
 * Update SOS alert with media URL and notify
 */
export async function updateSOSAlertMedia(
    alertId: string,
    mediaUrl: string
): Promise<{ error: string | null }> {
    // Update database
    const { error } = await (supabase.from('sos_alerts') as any)
        .update({ media_url: mediaUrl } as any)
        .eq('id', alertId);

    if (error) {
        console.error('Error updating SOS media:', error);
        return { error: error.message };
    }

    // Trigger notification for evidence
    const mediaMessage = `🎧 Audio / 🎥 Vídeo:\n${mediaUrl}`;

    const { error: funcError } = await supabase.functions.invoke('send-sos-notifications', {
        body: {
            alertId: alertId,
            action: 'media_uploaded',
            mediaUrl: mediaUrl,
            // We pass a custom config object to reuse the logic in the edge function (assuming it uses config.message)
            config: {
                message: mediaMessage,
                notifyContacts: true
            }
        }
    });

    if (funcError) {
        console.error('Error sending media notification:', funcError);
    }

    return { error: null };
}

/**
 * Get active SOS alerts for a group
 */
export async function getActiveAlerts(groupId: string): Promise<SOSAlert[]> {
    if (isMockMode) {
        return [];
    }

    const { data } = await supabase
        .from('sos_alerts')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    return data || [];
}

/**
 * Subscribe to SOS alerts for a group (realtime)
 */
export function subscribeToSOSAlerts(
    groupId: string,
    onAlert: (alert: SOSAlert) => void
): { unsubscribe: () => void } {
    if (isMockMode) {
        // No mock realtime for SOS
        return { unsubscribe: () => { } };
    }

    const subscription = supabase
        .channel('sos-alerts')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'sos_alerts',
                filter: `group_id=eq.${groupId}`,
            },
            (payload) => {
                onAlert(payload.new as SOSAlert);
            }
        )
        .subscribe();

    return {
        unsubscribe: () => subscription.unsubscribe()
    };
}

// ============ Emergency Contacts ============

/**
 * Get emergency contacts for a user
 */
export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    if (isMockMode) {
        // Mock removed
        return [];
    }

    const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    return data || [];
}

/**
 * Add emergency contact
 */
export async function addEmergencyContact(
    userId: string,
    contact: Omit<EmergencyContact, 'id' | 'user_id' | 'created_at'>
): Promise<{ contact: EmergencyContact | null; error: string | null }> {
    if (isMockMode) {
        // Mock removed
        return { contact: null, error: null };
    }

    const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({ ...contact, user_id: userId } as any)
        .select()
        .single();

    return { contact: data, error: error?.message || null };
}

/**
 * Remove emergency contact
 */
export async function removeEmergencyContact(contactId: string): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: null };
    }

    const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId);

    return { error: error?.message || null };
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}
