import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Navigation2, Settings } from 'lucide-react';
import { requestSOSPermissions, requestNotificationPermission } from '../services/sosService';
import { getLocationLevel, syncForegroundConsent, recordAlwaysConsent } from '../services/locationPermissionService';
import { useAuth } from '../contexts/AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');

const ALWAYS_CONFIRMED_KEY = 'location_always_confirmed';

/**
 * Pide todos los permisos críticos del SOS al entrar en la app (cámara, micro,
 * ubicación y notificaciones), para que ningún diálogo del sistema aparezca en
 * mitad de una emergencia. En Android, además guía al usuario a activar la
 * ubicación "Permitir siempre" (el sistema no deja pedirla con un diálogo a
 * partir de Android 11: hay que pasar por Ajustes).
 */
export function PermissionsPrimer() {
    const location = useLocation();
    const { user } = useAuth();
    const [showAlwaysSheet, setShowAlwaysSheet] = useState(false);

    const isExcludedPage = ['/onboarding', '/login', '/privacy', '/terms', '/eula'].includes(location.pathname);
    const isOnboardingComplete = localStorage.getItem('onboarding_complete') === 'true';

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || !user || isExcludedPage || !isOnboardingComplete) return;
        if (sessionStorage.getItem('permissions_primed') === 'true') return;
        sessionStorage.setItem('permissions_primed', 'true');

        (async () => {
            try {
                // Cadena de diálogos nativos: cámara → micro → ubicación → notificaciones.
                // Si ya están concedidos no aparece nada.
                await requestSOSPermissions();
                await requestNotificationPermission();
            } catch (err) {
                console.warn('[PermissionsPrimer] Error pidiendo permisos:', err);
            }

            // Registrar el consentimiento en primer plano (nivel + fecha en BD).
            await syncForegroundConsent();

            if (Capacitor.getPlatform() === 'android') {
                // CHECK-BEFORE-ASK con detección EXACTA: solo mostramos la hoja de
                // "Siempre" si tiene el permiso en primer plano pero NO "Siempre".
                // Si ya tiene "always", no se le molesta. Si aún no tiene ni
                // foreground, se deja que el diálogo nativo lo pida antes.
                const level = await getLocationLevel();
                if (level === 'always') {
                    await Preferences.set({ key: ALWAYS_CONFIRMED_KEY, value: 'true' });
                }
                const { value } = await Preferences.get({ key: ALWAYS_CONFIRMED_KEY });
                if (level === 'foreground' && value !== 'true') {
                    // En Android 10 el diálogo nativo de ubicación aún ofrece "Permitir
                    // siempre"; lo provocamos con un watcher efímero en segundo plano.
                    try {
                        const id = await BackgroundGeolocation.addWatcher(
                            {
                                backgroundMessage: 'RedCarpet te protege en segundo plano',
                                requestPermissions: true,
                                stale: true,
                            },
                            () => {}
                        );
                        setTimeout(() => {
                            BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
                        }, 4000);
                    } catch (err) {
                        console.warn('[PermissionsPrimer] Watcher siempre-ubicación:', err);
                    }
                    setShowAlwaysSheet(true);
                }
            }
        })();
    }, [user, isExcludedPage, isOnboardingComplete]);

    // Al volver de Ajustes (foco recuperado), re-sincronizar el estado del
    // permiso sin requerir reiniciar la app. No deja al usuario atrapado.
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let remove: (() => void) | undefined;
        (async () => {
            const { App } = await import('@capacitor/app');
            const handle = await App.addListener('appStateChange', async ({ isActive }) => {
                if (!isActive) return;
                // Al volver de Ajustes: re-detectar el nivel real y, si ya es
                // "Siempre", cerrar la hoja automáticamente (sin reiniciar).
                const level = await syncForegroundConsent();
                if (level === 'always') {
                    await Preferences.set({ key: ALWAYS_CONFIRMED_KEY, value: 'true' });
                    setShowAlwaysSheet(false);
                }
            });
            remove = () => handle.remove();
        })();
        return () => { if (remove) remove(); };
    }, []);

    const openLocationSettings = async () => {
        try {
            await BackgroundGeolocation.openSettings();
        } catch (err) {
            console.warn('[PermissionsPrimer] openSettings falló:', err);
        }
    };

    const confirmAlways = async () => {
        await Preferences.set({ key: ALWAYS_CONFIRMED_KEY, value: 'true' });
        await recordAlwaysConsent(); // registrar consentimiento "Siempre" en BD
        setShowAlwaysSheet(false);
    };

    if (!showAlwaysSheet) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-zinc-950 border border-white/10 rounded-[2rem] p-7 w-full max-w-sm shadow-2xl text-center mb-6">
                <div className="size-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-5">
                    <Navigation2 size={30} className="text-primary" />
                </div>
                <h2 className="text-white text-2xl font-black uppercase italic tracking-tighter mb-3 leading-tight">
                    Activa "Ubicación Siempre"
                </h2>
                <p className="text-white/70 text-sm leading-relaxed mb-5">
                    Para que tus contactos te vean en el mapa en tiempo real y estés protegido en segundo plano,
                    necesitamos permiso de ubicación <strong className="text-white">"Siempre"</strong>.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left mb-6">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Cómo activarlo:</p>
                    <p className="text-xs text-white/80 font-semibold mb-1">1. Toca <strong>"Ir a Ajustes"</strong></p>
                    <p className="text-xs text-white/80 font-semibold mb-1">2. Toca <strong>Ubicación</strong> (Permisos)</p>
                    <p className="text-xs text-white/80 font-semibold">3. Selecciona <strong>"Permitir siempre"</strong></p>
                </div>
                <button
                    onClick={openLocationSettings}
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mb-3 active:scale-95 transition-all"
                >
                    <Settings size={18} /> Ir a Ajustes
                </button>
                <div className="flex justify-between items-center px-2">
                    <button onClick={() => setShowAlwaysSheet(false)} className="text-white/40 text-xs font-bold py-3">
                        Ahora no
                    </button>
                    <button onClick={confirmAlways} className="text-white text-xs font-black py-3 underline underline-offset-4">
                        Ya lo he activado — Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}
