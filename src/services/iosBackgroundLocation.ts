// iOS: tracking en 2º plano estilo Life360 con subida HTTP NATIVA.
//
// A diferencia del plugin community (que sube en JavaScript y muere cuando la app
// se cierra), el plugin Transistor postea cada ubicación en código nativo a un
// Edge Function de Supabase, con `stopOnTerminate:false` + `startOnBoot:true`, así
// que sigue reportando aunque el usuario cierre la app o reinicie el móvil.
//
// Autenticación: token de dispositivo de LARGA VIDA (get_or_create_location_token),
// no el JWT — porque el JWT caduca y con la app cerrada no hay quien lo refresque.

import { supabase } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface NativeTrackingHandle {
    stop: () => Promise<void>;
}

export async function startIOSNativeTracking(
    _userId: string,
    onUpdate?: (pos: any) => void,
): Promise<NativeTrackingHandle | null> {
    try {
        const mod: any = await import('@transistorsoft/capacitor-background-geolocation');
        const BG = mod.default ?? mod;

        // Token de dispositivo (lo crea si no existe). Sin él no podemos subir.
        const { data: token, error: tokenError } = await supabase.rpc('get_or_create_location_token');
        if (tokenError || !token) {
            console.warn('[iOS BG] no se pudo obtener el token de dispositivo:', tokenError?.message);
            return null;
        }

        const url = `${SUPABASE_URL}/functions/v1/ingest-location`;

        // Actualiza el mapa en vivo cuando la app está abierta.
        BG.onLocation(
            (location: any) => {
                if (!location?.coords) return;
                onUpdate?.({
                    coords: {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        accuracy: location.coords.accuracy,
                        altitude: location.coords.altitude ?? null,
                        altitudeAccuracy: null,
                        heading: location.coords.heading ?? null,
                        speed: location.coords.speed ?? null,
                    },
                    timestamp: Date.parse(location.timestamp) || Date.now(),
                });
            },
            (err: any) => console.warn('[iOS BG] location error', err),
        );

        const state = await BG.ready({
            desiredAccuracy: BG.DESIRED_ACCURACY_HIGH,
            distanceFilter: 75,               // metros mínimos entre reportes
            stopOnTerminate: false,           // sigue tras cerrar la app
            startOnBoot: true,                // rearranca tras reiniciar el móvil
            // ---- Subida HTTP nativa (la clave de todo) ----
            url,
            httpRootProperty: '.',            // postea el objeto location en la raíz
            autoSync: true,                   // sube en cuanto tiene una ubicación
            autoSyncThreshold: 0,
            batchSync: false,
            maxDaysToPersist: 7,              // cola offline: reintenta al recuperar red
            maxRecordsToPersist: 10_000,
            headers: {
                Authorization: `Bearer ${ANON}`, // pasa el gateway (verify_jwt)
                apikey: ANON,
                'x-rc-device-token': token,       // auth real en el Edge Function
            },
            // ---- Permisos ----
            locationAuthorizationRequest: 'Always',
            stopTimeout: 5,
            pausesLocationUpdatesAutomatically: true,
            activityType: BG.ACTIVITY_TYPE_OTHER_NAVIGATION,
            debug: false,
            logLevel: BG.LOG_LEVEL_OFF,
        });

        if (!state.enabled) {
            await BG.start();
        }
        return {
            stop: async () => {
                try { await BG.stop(); await BG.removeListeners(); } catch { /* noop */ }
            },
        };
    } catch (e) {
        console.warn('[iOS BG] init fallida, se usará el fallback:', e);
        return null;
    }
}
