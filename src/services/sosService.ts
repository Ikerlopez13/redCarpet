import { supabase } from './supabaseClient';
import type { SOSAlert } from './database.types';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Module-level recording state ────────────────────────────────────────────

// Web MediaRecorder
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let activeStream: MediaStream | null = null;

// Native CameraPreview
let videoRecordPromise: Promise<any> | null = null;

// Chunk loop
interface ChunkLoop {
    running: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    index: number;
    alertId: string | null;
    userId: string | null;
    isPremium: boolean;
    thumbnailCaptured: boolean;
}
const _loop: ChunkLoop = {
    running: false, timer: null, index: 0,
    alertId: null, userId: null, isPremium: false, thumbnailCaptured: false,
};

const CHUNK_MS = 45_000;  // 45-second chunks
const VIDEO_BUCKET = 'sos-videos';
const THUMB_BUCKET = 'sos-thumbnails';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function b64ToBlob(b64: string, mime: string): Blob {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

// ─── Camera preview ──────────────────────────────────────────────────────────

export async function startSOSPreview(options: { position?: 'front' | 'rear' } = {}): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    const positions = [options.position || 'rear', 'front'];
    for (const position of positions) {
        try {
            const { CameraPreview } = await import('@capacitor-community/camera-preview');
            await CameraPreview.start({
                parent: 'sos-native-preview',
                position,
                toBack: true,
                storeToFile: false,
                disableAudio: true,
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight,
            });
            return true;
        } catch (err) {
            console.warn('[SOS] Camera preview failed for', position, err);
        }
    }
    return false;
}

export async function stopSOSPreview() {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { CameraPreview } = await import('@capacitor-community/camera-preview');
        await CameraPreview.stop();
    } catch {}
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export async function requestSOSPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
        const { Camera } = await import('@capacitor/camera');
        const { Geolocation } = await import('@capacitor/geolocation');

        let cam = await Camera.checkPermissions();
        if (cam.camera !== 'granted') cam = await Camera.requestPermissions({ permissions: ['camera'] });

        let mic = await VoiceRecorder.hasAudioRecordingPermission();
        if (!mic.value) mic = await VoiceRecorder.requestAudioRecordingPermission();

        let geo = await Geolocation.checkPermissions();
        if (geo.location !== 'granted') geo = await Geolocation.requestPermissions();

        return cam.camera === 'granted' && mic.value && geo.location === 'granted';
    } catch (err) {
        console.error('[SOS] requestSOSPermissions error:', err);
        return false;
    }
}

// ─── Thumbnail capture ───────────────────────────────────────────────────────

export async function captureSOSThumbnail(userId: string, alertId: string): Promise<string | null> {
    try {
        if (Capacitor.isNativePlatform()) {
            const { CameraPreview } = await import('@capacitor-community/camera-preview');
            const { value: isStarted } = await CameraPreview.isCameraStarted();
            if (!isStarted) return null;
            // @ts-ignore — capture() exists but may not be typed in all versions
            const shot = await CameraPreview.capture({ quality: 50 });
            const base64 = shot?.value ?? shot;
            if (!base64 || typeof base64 !== 'string') return null;
            const blob = b64ToBlob(base64, 'image/jpeg');
            const path = `${userId}/${alertId}/thumb.jpg`;
            const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, blob, {
                contentType: 'image/jpeg',
                upsert: true,
            });
            if (error) return null;
            const { data } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(path);
            return data.publicUrl;
        }

        // Web: draw first video frame to canvas
        if (activeStream) {
            const video = document.createElement('video');
            video.srcObject = activeStream;
            video.muted = true;
            await new Promise<void>(res => { video.onloadedmetadata = () => res(); });
            await video.play();
            const canvas = document.createElement('canvas');
            canvas.width = 320; canvas.height = 240;
            canvas.getContext('2d')?.drawImage(video, 0, 0, 320, 240);
            video.pause();
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.7));
            if (!blob) return null;
            const path = `${userId}/${alertId}/thumb.jpg`;
            const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, blob, {
                contentType: 'image/jpeg', upsert: true,
            });
            if (error) return null;
            const { data } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(path);
            return data.publicUrl;
        }
        return null;
    } catch (err) {
        console.warn('[SOS] captureSOSThumbnail error:', err);
        return null;
    }
}

// ─── Low-level: start/stop a single recording segment ────────────────────────

async function _startRecordingSegment(isPremium: boolean): Promise<boolean> {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
        try {
            const { CameraPreview } = await import('@capacitor-community/camera-preview');
            const { value: isStarted } = await CameraPreview.isCameraStarted();
            if (isStarted) {
                videoRecordPromise = CameraPreview.startRecordVideo({
                    position: 'rear',
                    storeToFile: true,
                });
                // El vídeo sale sin sonido (la sesión de cámara va sin micro para no
                // interrumpir la llamada al 112): grabamos audio en paralelo.
                // Reintentos: con la cámara aún arrancando, el primer intento puede
                // fallar con CANNOT_RECORD_ON_THIS_PHONE (transitorio).
                try {
                    const { value: canRecord } = await VoiceRecorder.canDeviceVoiceRecord();
                    if (canRecord) {
                        for (let attempt = 0; attempt < 3; attempt++) {
                            try {
                                await VoiceRecorder.startRecording();
                                break;
                            } catch (e) {
                                if (attempt === 2) console.error('[SOS] VoiceRecorder no arranca tras 3 intentos:', e);
                                else await new Promise(r => setTimeout(r, 800));
                            }
                        }
                    }
                } catch {}
                return true;
            }
        } catch (err) {
            console.warn('[SOS] CameraPreview.startRecordVideo failed, falling back to audio:', err);
        }

        try {
            const { value: canRecord } = await VoiceRecorder.canDeviceVoiceRecord();
            if (canRecord) {
                await VoiceRecorder.startRecording();
                return true;
            }
        } catch {}
        return false;
    }

    // Web: reuse existing stream for subsequent chunks
    if (activeStream) {
        recordedChunks = [];
        try {
            mediaRecorder = new MediaRecorder(activeStream);
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
            mediaRecorder.start();
            return true;
        } catch {}
    }

    // Web: first chunk — acquire stream
    try {
        const constraints = isPremium
            ? { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }, audio: true }
            : { audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start();
        return true;
    } catch (err) {
        console.error('[SOS] getUserMedia error:', err);
        return false;
    }
}

const VIDEO_STOP_TIMEOUT_MS = 10_000;

function _withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        p,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), ms)),
    ]);
}

async function _stopSegmentAndUpload(
    userId: string, alertId: string, chunkIdx: number
): Promise<string[]> {
    if (Capacitor.isNativePlatform()) {
        const paths: string[] = [];

        if (videoRecordPromise) {
            try {
                const { CameraPreview } = await import('@capacitor-community/camera-preview');
                await _withTimeout(CameraPreview.stopRecordVideo(), VIDEO_STOP_TIMEOUT_MS, 'stopRecordVideo');
                const result: any = await _withTimeout(videoRecordPromise, VIDEO_STOP_TIMEOUT_MS, 'videoRecordPromise');
                videoRecordPromise = null;

                const rawPath: string | undefined = result?.value ?? result;
                if (!rawPath) throw new Error('Empty video path');

                // Filesystem.readFile quiere la URL file:// COMPLETA; como
                // fallback probamos la ruta pelada (comportamiento antiguo).
                const { Filesystem } = await import('@capacitor/filesystem');
                let file;
                try {
                    file = await Filesystem.readFile({ path: rawPath });
                } catch {
                    const stripped = rawPath.startsWith('file://') ? rawPath.slice(7) : rawPath;
                    file = await Filesystem.readFile({ path: stripped });
                }
                const blob = b64ToBlob(file.data as string, 'video/mp4');

                const storagePath = `${userId}/${alertId}/chunk_${chunkIdx}.mp4`;
                const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(storagePath, blob, {
                    contentType: 'video/mp4', upsert: true,
                });
                if (error) throw error;
                paths.push(storagePath);
            } catch (err) {
                console.error('[SOS] Native video chunk upload failed:', err);
            }
            videoRecordPromise = null;
        }

        // Audio del segmento (grabado en paralelo al vídeo, o como único medio si no hay cámara)
        try {
            const result = await VoiceRecorder.stopRecording();
            if (result.value?.recordDataBase64) {
                const mime = result.value.mimeType || 'audio/aac';
                const blob = b64ToBlob(result.value.recordDataBase64, mime);
                const storagePath = `${userId}/${alertId}/chunk_${chunkIdx}.m4a`;
                const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(storagePath, blob, {
                    contentType: mime, upsert: true,
                });
                if (!error) paths.push(storagePath);
            }
        } catch {}
        return paths;
    }

    // Web MediaRecorder
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return resolve([]);
        mediaRecorder.onstop = async () => {
            try {
                const mime = mediaRecorder?.mimeType || 'video/webm';
                const blob = new Blob(recordedChunks, { type: mime });
                recordedChunks = [];
                const ext = mime.includes('mp4') ? 'mp4' : 'webm';
                const storagePath = `${userId}/${alertId}/chunk_${chunkIdx}.${ext}`;
                const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(storagePath, blob, {
                    contentType: mime, upsert: true,
                });
                resolve(error ? [] : [storagePath]);
            } catch { resolve([]); }
        };
        mediaRecorder.stop();
    });
}

// ─── Chunked recording loop (public API) ─────────────────────────────────────

async function _loopIteration() {
    if (!_loop.running || !_loop.userId || !_loop.alertId) return;

    const ok = await _startRecordingSegment(_loop.isPremium);
    if (!ok) {
        console.error('[SOS] Chunk recording failed to start');
        return;
    }

    // Capture thumbnail once, 2s after camera stabilizes
    if (!_loop.thumbnailCaptured) {
        setTimeout(async () => {
            if (!_loop.userId || !_loop.alertId) return;
            const thumbUrl = await captureSOSThumbnail(_loop.userId, _loop.alertId);
            _loop.thumbnailCaptured = true;
            if (thumbUrl) {
                supabase.functions.invoke('send-sos-notifications', {
                    body: { alertId: _loop.alertId, userId: _loop.userId, action: 'thumbnail_ready', thumbnailUrl: thumbUrl },
                }).catch(() => {});
            }
        }, 2000);
    }

    _loop.timer = setTimeout(async () => {
        if (!_loop.running || !_loop.userId || !_loop.alertId) return;
        const idx = _loop.index++;
        await _finishChunk(_loop.userId, _loop.alertId, idx);
        _loopIteration();
    }, CHUNK_MS);
}

async function _finishChunk(userId: string, alertId: string, idx: number) {
    const storagePaths = await _stopSegmentAndUpload(userId, alertId, idx);
    if (storagePaths.length === 0) return;

    // Persist chunk metadata (una fila por medio: vídeo y/o audio)
    for (const storagePath of storagePaths) {
        const { error: dbErr } = await (supabase.from('sos_recordings') as any).insert({
            sos_alert_id: alertId,
            user_id: userId,
            storage_path: storagePath,
            chunk_index: idx,
            media_type: storagePath.endsWith('.m4a') ? 'audio/m4a' : 'video/mp4',
        });
        if (dbErr) console.error('[SOS] sos_recordings insert error:', dbErr);
    }

    // Send notification with signed URL (24h validity) so contacts can watch immediately
    const notifyPath = storagePaths.find(p => p.endsWith('.mp4')) || storagePaths[0];
    try {
        const { data: signed } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(notifyPath, 86400);
        if (signed?.signedUrl) {
            supabase.functions.invoke('send-sos-notifications', {
                body: {
                    alertId,
                    userId,
                    action: 'chunk_uploaded',
                    mediaUrl: signed.signedUrl,
                    chunkIndex: idx,
                },
            }).catch(() => {});
        }
    } catch {}
}

export async function startChunkedRecording(userId: string, alertId: string, isPremium: boolean) {
    _loop.running = true;
    _loop.index = 0;
    _loop.alertId = alertId;
    _loop.userId = userId;
    _loop.isPremium = isPremium;
    _loop.thumbnailCaptured = false;
    await _loopIteration();
}

export async function stopChunkedRecording(userId: string, alertId: string): Promise<void> {
    _loop.running = false;
    if (_loop.timer) { clearTimeout(_loop.timer); _loop.timer = null; }

    // Upload the final partial segment
    const idx = _loop.index;
    await _finishChunk(userId, alertId, idx);

    // Release web stream
    activeStream?.getTracks().forEach(t => t.stop());
    activeStream = null;
}

// ─── Legacy one-shot API (kept for backwards compat / non-premium fallback) ──

export async function startRecording(isPremium: boolean = false, options: { position?: 'user' | 'environment' } = {}): Promise<{ success: boolean; stream?: MediaStream }> {
    const ok = await _startRecordingSegment(isPremium);
    return { success: ok, stream: activeStream ?? undefined };
}

export async function stopAndUploadRecording(userId: string): Promise<string | null> {
    const storagePaths = await _stopSegmentAndUpload(userId, `legacy_${Date.now()}`, 0);
    const storagePath = storagePaths.find(p => p.endsWith('.mp4')) || storagePaths[0];
    if (!storagePath) return null;
    // Return a signed URL (24h) for backwards compat callers
    const { data } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(storagePath, 86400);
    return data?.signedUrl ?? null;
}

// ─── Alert activation ─────────────────────────────────────────────────────────

async function getBatteryLevel(): Promise<string> {
    try {
        // @ts-ignore
        if ('getBattery' in navigator) { const b = await navigator.getBattery(); return `${Math.round(b.level * 100)}%`; }
    } catch {}
    return 'N/A';
}

export async function activateSOS(
    userId: string,
    groupId: string,
    config: SOSConfig
): Promise<{ alert: SOSAlert | null; error: string | null }> {
    if (!userId?.trim() || !groupId?.trim()) {
        return { alert: null, error: 'Sesión o grupo no válido' };
    }
    try {
        const position = await (async () => {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                return await Promise.race([
                    Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }),
                    new Promise<null>(r => setTimeout(() => r(null), 6000)),
                ]);
            } catch { return null; }
        })();

        const battery = await getBatteryLevel();

        let msg = config.message;
        if (config.type) msg = `🚨 NOTA DE TRAYECTO: ${config.type.toUpperCase()}\n\n` + msg;
        if (config.shareLocation && position) {
            msg += `\n\n📍 UBICACIÓN EN TIEMPO REAL:\nhttps://maps.google.com/?q=${(position as any).coords.latitude},${(position as any).coords.longitude}`;
        }
        msg += `\n\n🎥 VÍDEO EN DIRECTO:\nGrabando y subiendo por chunks...`;
        msg += `\n\n🔋 Batería: ${battery}`;

        const alertData: any = {
            user_id: userId,
            group_id: groupId,
            lat: (position as any)?.coords.latitude ?? null,
            lng: (position as any)?.coords.longitude ?? null,
            status: 'active',
            message: msg,
            mode: config.mode || 'visible',
            media_url: config.mediaUrl || null,
        };

        try {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
            const { data: recentLocations } = await supabase.from('locations').select('lat, lng, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
            alertData.context_payload = {
                timestamp_ms: Date.now(), battery,
                user_profile: profile ? {
                    dob: profile.dob, habitual_city: profile.habitual_city,
                    walking_alone_frequency: profile.walking_alone_frequency,
                    risk_exposure_level: profile.risk_exposure_level,
                    habitual_zones: profile.habitual_zones,
                } : null,
                recent_locations: recentLocations || [],
            };
        } catch {}

        const result: any = await Promise.race([
            (supabase.from('sos_alerts') as any).insert(alertData).select().single(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('DB timeout')), 10000)),
        ]);
        if (result instanceof Error) throw result;
        const { data: alert, error } = result;
        if (error) return { alert: null, error: `Error DB: ${error.message}` };
        if (!alert) return { alert: null, error: 'No se pudo crear el aviso' };

        supabase.functions.invoke('send-sos-notifications', {
            body: { alertId: alert.id, userId, groupId, config },
        }).catch((e: any) => console.error('[SOS] Notification fail:', e));

        return { alert, error: null };
    } catch (err: any) {
        return { alert: null, error: err.message || 'Error crítico' };
    }
}

export async function resolveSOS(alertId: string, status: 'resolved' | 'cancelled' = 'resolved'): Promise<{ error: string | null }> {
    const { error } = await (supabase.from('sos_alerts') as any).update({ status } as any).eq('id', alertId);
    return { error: error?.message ?? null };
}

export async function updateSOSAlertMedia(alertId: string, mediaUrl: string): Promise<{ error: string | null }> {
    const isVideo = /\.(webm|mp4|mov)(\?|$)/i.test(mediaUrl);
    const { error } = await (supabase.from('sos_alerts') as any).update({
        media_video_url: isVideo ? mediaUrl : null,
        media_audio_url: !isVideo ? mediaUrl : null,
    } as any).eq('id', alertId);
    if (error) console.error('[SOS] updateSOSAlertMedia error:', error);
    supabase.functions.invoke('send-sos-notifications', {
        body: { alertId, action: 'media_uploaded', mediaUrl, config: { message: `Media: ${mediaUrl}`, notifyContacts: true } },
    }).catch(() => {});
    return { error: null };
}

// ─── Recording management ─────────────────────────────────────────────────────

export async function preserveSOSRecording(recordingId: string): Promise<void> {
    await (supabase.from('sos_recordings') as any).update({ preserved: true }).eq('id', recordingId);
}

export async function getSignedVideoUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) { console.warn('[SOS] getSignedVideoUrl error:', error); return null; }
    return data.signedUrl;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getActiveAlerts(groupId: string): Promise<SOSAlert[]> {
    const { data } = await supabase.from('sos_alerts').select('*').eq('group_id', groupId).eq('status', 'active').order('created_at', { ascending: false });
    return data || [];
}

export async function getSOSHistory(groupId: string, limit = 20): Promise<SOSAlert[]> {
    const { data } = await supabase.from('sos_alerts').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
}

export function subscribeToSOSAlerts(groupId: string, onNewAlert: (alert: SOSAlert) => void) {
    const sub = supabase.channel(`sos-alerts-${groupId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_alerts', filter: `group_id=eq.${groupId}` },
            (payload: any) => onNewAlert(payload.new as SOSAlert))
        .subscribe();
    return { unsubscribe: () => supabase.removeChannel(sub) };
}

// ─── 112 call ────────────────────────────────────────────────────────────────

let last112DialAt = 0;

export async function call112(force = false) {
    if (!force) {
        try {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key: 'sos_config' });
            if (value && JSON.parse(value).autoCall112 === false) return;
        } catch {}
    }
    const now = Date.now();
    if (!force && now - last112DialAt < 15000) return;
    last112DialAt = now;
    if (Capacitor.isNativePlatform()) {
        window.open('tel:112', '_system');
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
    } catch { return false; }
}

export async function executeSOSProtocol(userId: string, groupId: string, type = 'security') {
    // La llamada al 112 la gestiona SOSActivePage (cuenta atrás de 10s
    // configurable con autoCall112) — no llamar aquí para no duplicar.
    return activateSOS(userId, groupId, {
        message: '⚠️ AVISO DE TRAYECTO. \nHe activado una nota de trayecto. Mi ubicación y cámara han sido compartidas con mis contactos seleccionados. Por favor, revisa mi progreso.',
        highPriority: false,
        notifyContacts: true,
        shareLocation: true,
        mode: 'visible',
        type,
    });
}
