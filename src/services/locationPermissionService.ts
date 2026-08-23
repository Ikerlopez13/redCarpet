// ── PERMISOS DE UBICACIÓN — utilidades centralizadas ──────────────────────
// Consolida la comprobación del estado del permiso y el registro del
// consentimiento (nivel + fecha) en BD, para poder demostrar el consentimiento
// conforme a la política de privacidad.
//
// LIMITACIÓN NATIVA (documentada): @capacitor/geolocation.checkPermissions()
// distingue granted/denied/prompt del permiso en PRIMER PLANO, pero NO
// distingue "mientras se usa" de "siempre". Para saber con exactitud si el
// usuario tiene "Siempre" haría falta un método nativo (authorizationStatus en
// iOS / ACCESS_BACKGROUND_LOCATION en Android). Aquí trabajamos con la mejor
// señal disponible y registramos el nivel conocido.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from './supabaseClient';

export type LocationLevel = 'denied' | 'foreground' | 'always' | 'unknown';

// Plugin nativo propio (iOS/Android) para detección EXACTA de "Siempre".
// Devuelve: 'always' | 'foreground' | 'denied' | 'prompt'.
const LocationAuth = registerPlugin<{ check(): Promise<{ status: string }> }>('LocationAuth');

/**
 * Nivel EXACTO del permiso de ubicación usando el plugin nativo:
 *   always     → "Siempre" (background concedido)
 *   foreground → "Mientras se usa"
 *   denied     → denegado
 *   prompt     → aún no preguntado (solo iOS lo distingue)
 * En web/fallo cae a la comprobación de primer plano de Capacitor.
 */
export async function getLocationLevel(): Promise<'always' | 'foreground' | 'denied' | 'prompt' | 'unknown'> {
    if (Capacitor.isNativePlatform()) {
        try {
            const { status } = await LocationAuth.check();
            if (status === 'always' || status === 'foreground' || status === 'denied' || status === 'prompt') {
                return status;
            }
        } catch {
            /* fallback abajo */
        }
    }
    // Fallback: Capacitor Geolocation (solo distingue primer plano).
    const fg = await getForegroundState();
    return fg === 'granted' ? 'foreground' : fg;
}

/** Estado del permiso en primer plano (granted/denied/prompt/unknown). */
export async function getForegroundState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
    try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const s = await Geolocation.checkPermissions();
        return (s.location as any) || 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Registra en BD el nivel de permiso concedido (solo si cambió respecto al
 * último), para tener constancia del consentimiento. Idempotente y silencioso.
 */
export async function recordLocationConsent(level: LocationLevel): Promise<void> {
    if (level === 'unknown') return;
    try {
        await supabase.rpc('record_location_consent', {
            p_level: level,
            p_platform: Capacitor.getPlatform(),
        });
    } catch {
        /* no bloquear el flujo por el registro de consentimiento */
    }
}

/**
 * Comprueba el nivel EXACTO de permiso y registra el consentimiento real
 * (always/foreground/denied). Devuelve el nivel. Se llama tras cualquier
 * concesión/denegación y al recuperar el foco (volver de Ajustes).
 */
export async function syncForegroundConsent(): Promise<'always' | 'foreground' | 'denied' | 'prompt' | 'unknown'> {
    const level = await getLocationLevel();
    if (level === 'always') await recordLocationConsent('always');
    else if (level === 'foreground') await recordLocationConsent('foreground');
    else if (level === 'denied') await recordLocationConsent('denied');
    return level;
}

/** Marca explícitamente que el usuario confirmó "Siempre" (registro de consentimiento). */
export async function recordAlwaysConsent(): Promise<void> {
    await recordLocationConsent('always');
}
