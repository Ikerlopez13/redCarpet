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

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';

export type LocationLevel = 'denied' | 'foreground' | 'always' | 'unknown';

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
 * Comprueba el permiso en primer plano y registra el consentimiento
 * ('foreground' si granted, 'denied' si denegado). Devuelve el estado.
 * Pensado para llamarse tras cualquier concesión/denegación de ubicación.
 */
export async function syncForegroundConsent(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
    const s = await getForegroundState();
    if (s === 'granted') await recordLocationConsent('foreground');
    else if (s === 'denied') await recordLocationConsent('denied');
    return s;
}

/** Marca explícitamente que el usuario confirmó "Siempre" (registro de consentimiento). */
export async function recordAlwaysConsent(): Promise<void> {
    await recordLocationConsent('always');
}
