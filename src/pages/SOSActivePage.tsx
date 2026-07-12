import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, X, Delete, Loader2, Phone, Mic, Video } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import clsx from 'clsx';

import { 
    startSOSPreview, 
    stopSOSPreview, 
    startRecording, 
    stopAndUploadRecording, 
    updateSOSAlertMedia,
    resolveSOS
} from '../services/sosService';
import { useAuth } from '../contexts/AuthContext';
import { ReviewPromptModal } from '../components/ReviewPromptModal';

export const SOSActivePage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isPremium } = useAuth();

    // SOS State from Navigation
    const sosState = location.state as {
        alertId?: string;
        reason?: string;
        mode?: 'visible' | 'discrete';
    } | null;

    const alertId = sosState?.alertId || null;
    const sosMode = sosState?.mode || 'visible';

    const [isCameraStarted, setIsCameraStarted] = useState(false);
    const isCameraStartingRef = useRef(false);
    const isCameraStoppingRef = useRef(false);
    const cameraRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [step, setStep] = useState<'active' | 'pin'>('active');
    const [showReview, setShowReview] = useState(false);
    const [autoCall112, setAutoCall112] = useState(true);
    
    // PIN State
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    const [correctPin, setCorrectPin] = useState('0000');

    useEffect(() => {
        const loadConfig = async () => {
            const { value: localPin } = await Preferences.get({ key: 'SOS_PIN' });
            const { value: localConfig } = await Preferences.get({ key: 'sos_config' });
            let parsedPin = '';
            let parsedAutoCall112 = true;
            if (localConfig) {
                try {
                    const parsed = JSON.parse(localConfig);
                    parsedPin = parsed.pin || '';
                    parsedAutoCall112 = parsed.autoCall112 !== false;
                } catch {}
            }
            const pin = user?.profile?.sos_pin || localPin || parsedPin || '0000';
            console.log('[SOSActivePage] PIN loaded:', pin, '| autoCall112:', parsedAutoCall112);
            setCorrectPin(pin);
            setAutoCall112(parsedAutoCall112);
        };
        loadConfig();
    }, [user]);

    // Discreet SOS Decoy States
    const [decoyType, setDecoyType] = useState<'calculator' | 'weather' | 'blank'>('calculator');
    const [calcDisplay, setCalcDisplay] = useState('');
    const [weatherTapCount, setWeatherTapCount] = useState(0);

    const handleCalcBtnPress = (val: string) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
        if (val === 'C') {
            setCalcDisplay('');
        } else if (val === 'delete') {
            setCalcDisplay(d => d.slice(0, -1));
        } else if (val === '=') {
            if (calcDisplay === '941') {
                setStep('pin');
                setCalcDisplay('');
                return;
            }
            try {
                const sanitized = calcDisplay.replace(/x/g, '*').replace(/÷/g, '/');
                const result = Function(`"use strict"; return (${sanitized})`)();
                if (result === 941) {
                    setStep('pin');
                    setCalcDisplay('');
                    return;
                }
                setCalcDisplay(String(result));
            } catch {
                setCalcDisplay('Error');
            }
        } else {
            if (calcDisplay === 'Error') {
                setCalcDisplay(val);
            } else {
                setCalcDisplay(d => d + val);
            }
        }
    };

    const handleWeatherSecretTap = () => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
        const next = weatherTapCount + 1;
        setWeatherTapCount(next);
        if (next >= 3) {
            setStep('pin');
            setWeatherTapCount(0);
        }
    };

    useEffect(() => {
        console.log('[SOS-Active-Page] Mounted. AlertID:', alertId);

        const initSOS = async () => {
            // Load all preferences at once to avoid race conditions
            const [{ value: decoyVal }, { value: localConfig }] = await Promise.all([
                Preferences.get({ key: 'DECOY_TYPE' }),
                Preferences.get({ key: 'sos_config' })
            ]);

            if (decoyVal) setDecoyType(decoyVal as any);

            let call112 = true;
            if (localConfig) {
                try { call112 = JSON.parse(localConfig).autoCall112 !== false; } catch {}
            }
            setAutoCall112(call112);

            // 1. Initial delay to ensure the route Transition is smooth
            await new Promise(r => setTimeout(r, 500));

            // 2. Start Native Preview (Mirroring handled in Plugin.swift now)
            if (Capacitor.isNativePlatform()) {
                isCameraStartingRef.current = true;
                let previewOk = false;
                try {
                    previewOk = await startSOSPreview();
                } finally {
                    isCameraStartingRef.current = false;
                }
                // Solo hacer el fondo transparente si la cámara arrancó de verdad:
                // si falla, dejar el fondo de la UI (evita la pantalla negra) y
                // seguir con audio.
                if (previewOk) {
                    setTimeout(() => {
                        setIsCameraStarted(true);
                        document.body.classList.add('sos-mode-active');
                    }, 300);
                }
            }

            // 3. Start Recording (Resilient with it's own timeouts)
            await startRecording(isPremium);

            // 4. Auto-call 112 only if user has this option enabled in settings
            if (call112) {
                const timer = setTimeout(() => {
                    if (step === 'active') {
                        console.log('🚨 Auto-calling 112 after 10s timeout');
                        window.location.href = 'tel:112';
                    }
                }, 10000);
                (window as any)._sos112Timer = timer;
            }
        };

        let appStateListener: any = null;
        if (Capacitor.isNativePlatform()) {
            import('@capacitor/app').then(({ App }) => {
                App.addListener('appStateChange', async ({ isActive }) => {
                    if (isActive) {
                        console.log('[SOS-Active-Page] App resumed, ensuring camera is running');
                        // Only restart if camera is not already starting/stopping
                        if (isCameraStartingRef.current || isCameraStoppingRef.current) {
                            console.log('[SOS-Active-Page] Camera operation in progress, skipping restart');
                            return;
                        }
                        // Restart camera preview to fix freeze on some iPhones after system alert
                        try {
                            isCameraStoppingRef.current = true;
                            await stopSOSPreview();
                            isCameraStoppingRef.current = false;

                            if (cameraRestartTimerRef.current) {
                                clearTimeout(cameraRestartTimerRef.current);
                            }
                            cameraRestartTimerRef.current = setTimeout(async () => {
                                if (isCameraStartingRef.current) return;
                                isCameraStartingRef.current = true;
                                try {
                                    const ok = await startSOSPreview();
                                    if (!ok) document.body.classList.remove('sos-mode-active');
                                } finally {
                                    isCameraStartingRef.current = false;
                                }
                            }, 300);
                        } catch (e) {
                            isCameraStoppingRef.current = false;
                            console.error('Error restarting camera preview', e);
                        }
                    }
                }).then(listener => {
                    appStateListener = listener;
                });
            });
        }

        initSOS();

        return () => {
            console.log('[SOS-Active-Page] Unmounting. Cleaning up...');
            if (appStateListener) {
                appStateListener.remove();
            }
            if ((window as any)._sos112Timer) {
                clearTimeout((window as any)._sos112Timer);
            }
            if (cameraRestartTimerRef.current) {
                clearTimeout(cameraRestartTimerRef.current);
                cameraRestartTimerRef.current = null;
            }
            cleanAll();
        };
    }, []);

    const cleanAll = async () => {
        if ((window as any)._sos112Timer) {
            clearTimeout((window as any)._sos112Timer);
            delete (window as any)._sos112Timer;
        }
        if (cameraRestartTimerRef.current) {
            clearTimeout(cameraRestartTimerRef.current);
            cameraRestartTimerRef.current = null;
        }
        document.body.classList.remove('sos-mode-active');
        if (Capacitor.isNativePlatform()) {
            // Wait for any in-progress operations
            let attempts = 0;
            while ((isCameraStartingRef.current || isCameraStoppingRef.current) && attempts < 50) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
            if (!isCameraStoppingRef.current) {
                isCameraStoppingRef.current = true;
                try {
                    await stopSOSPreview();
                } finally {
                    isCameraStoppingRef.current = false;
                }
            }
        }
    };

    const handlePinKeyPress = async (key: string) => {
        setPinError(false);
        
        // Haptic feedback on press
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light });
        }

        if (pinInput.length < correctPin.length) {
            const newPin = pinInput + key;
            setPinInput(newPin);

            if (newPin.length === correctPin.length) {
                if (newPin === correctPin) {
                    if (Capacitor.isNativePlatform()) {
                        Haptics.notification({ type: NotificationType.Success });
                    }
                    handleFinalStop();
                } else {
                    setPinError(true);
                    if (Capacitor.isNativePlatform()) {
                        Haptics.notification({ type: NotificationType.Error });
                    }
                    setTimeout(() => {
                        setPinInput('');
                        setPinError(false);
                    }, 1000);
                }
            }
        }
    };

    const handleFinalStop = async () => {
        console.log('[SOS-Active-Page] Final STOP triggered.');
        // 1. Resolve alert in DB
        if (alertId) {
            await resolveSOS(alertId);
        }

        // 2. Stop and upload recording
        if (user) {
            const url = await stopAndUploadRecording(user.id);
            if (url && alertId) {
                await updateSOSAlertMedia(alertId, url);
            }
        }
        
        await cleanAll();
        
        const { value } = await Preferences.get({ key: 'HAS_RATED_APP' });
        if (!value) {
            setShowReview(true);
        } else {
            navigate('/');
        }
    };

    const handleReviewClose = () => {
        setShowReview(false);
        navigate('/');
    };

    return (
        <div className={clsx(
            "flex flex-col h-full transition-colors duration-700",
            isCameraStarted ? "bg-transparent" : "bg-gradient-to-b from-red-950 to-black"
        )}>
            {/* Native Camera Container (Placeholder for z-index ref) */}
            <div id="sos-native-preview" className="fixed inset-0 z-0 pointer-events-none" />

            {step === 'active' && (
                sosMode === 'discrete' ? (
                    // DECOY INTERACTIVE VIEWS
                    <div className="flex flex-col h-full w-full bg-[#0a0f1d] text-white overflow-hidden relative z-40 select-none animate-fade-in">
                        
                        {/* CALCULATOR DECOY SCREEN */}
                        {decoyType === 'calculator' && (
                            <div className="flex-1 flex flex-col justify-end p-6 bg-black">
                                {/* Display */}
                                <div className="text-right py-8 px-4 text-white text-6xl font-light tracking-tight truncate min-h-[120px] select-all">
                                    {calcDisplay || '0'}
                                </div>

                                {/* Calculator keypad */}
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { val: 'C', bg: 'bg-zinc-400 text-black font-semibold' },
                                        { val: 'delete', bg: 'bg-zinc-400 text-black', icon: 'backspace' },
                                        { val: '÷', bg: 'bg-zinc-400 text-black font-semibold' },
                                        { val: '÷', bg: 'bg-amber-500 text-white font-semibold' },

                                        { val: '7', bg: 'bg-zinc-800 text-white' },
                                        { val: '8', bg: 'bg-zinc-800 text-white' },
                                        { val: '9', bg: 'bg-zinc-800 text-white' },
                                        { val: 'x', bg: 'bg-amber-500 text-white font-semibold' },

                                        { val: '4', bg: 'bg-zinc-800 text-white' },
                                        { val: '5', bg: 'bg-zinc-800 text-white' },
                                        { val: '6', bg: 'bg-zinc-800 text-white' },
                                        { val: '-', bg: 'bg-amber-500 text-white font-semibold' },

                                        { val: '1', bg: 'bg-zinc-800 text-white' },
                                        { val: '2', bg: 'bg-zinc-800 text-white' },
                                        { val: '3', bg: 'bg-zinc-800 text-white' },
                                        { val: '+', bg: 'bg-amber-500 text-white font-semibold' },

                                        { val: '0', bg: 'bg-zinc-800 text-white col-span-2 rounded-[2.5rem] flex pl-8 items-center text-left' },
                                        { val: '.', bg: 'bg-zinc-800 text-white' },
                                        { val: '=', bg: 'bg-amber-500 text-white font-semibold' },
                                    ].map((btn, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleCalcBtnPress(btn.val)}
                                            className={clsx(
                                                "h-20 rounded-full flex items-center justify-center text-2xl transition-all active:brightness-150",
                                                btn.bg
                                            )}
                                        >
                                            {btn.icon ? (
                                                <span className="material-symbols-outlined text-xl">{btn.icon}</span>
                                            ) : (
                                                btn.val
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* WEATHER DECOY SCREEN */}
                        {decoyType === 'weather' && (
                            <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-[#1b2d4f] via-[#101b30] to-[#0a0f1d] overflow-y-auto no-scrollbar relative">
                                {/* Invisible Secret escape zone at top-left corner */}
                                <div 
                                    className="absolute top-0 left-0 size-20 z-50 cursor-pointer" 
                                    onClick={handleWeatherSecretTap}
                                />

                                {/* City Temp header */}
                                <div className="text-center pt-16 pb-8 space-y-2">
                                    <h2 className="text-3xl font-light">Barcelona</h2>
                                    <p className="text-7xl font-thin tracking-tighter pl-3">19°</p>
                                    <p className="text-sm font-semibold text-white/60">Lluvia Débil</p>
                                    <p className="text-xs font-semibold text-white/40">Máx: 21°  Mín: 14°</p>
                                </div>

                                {/* Weather Details */}
                                <div className="space-y-4">
                                    {/* 24h Forecast */}
                                    <div className="bg-white/5 border border-white/5 rounded-3xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Pronóstico de Hoy</p>
                                        <div className="flex justify-between text-center">
                                            {[
                                                { time: 'Ahora', temp: '19°', icon: '⛈️' },
                                                { time: '14:00', temp: '20°', icon: '🌧️' },
                                                { time: '15:00', temp: '20°', icon: '🌥️' },
                                                { time: '16:00', temp: '19°', icon: '🌤️' },
                                                { time: '17:00', temp: '18°', icon: '☀️' }
                                            ].map((f, i) => (
                                                <div key={i} className="space-y-2">
                                                    <p className="text-[10px] text-white/60 font-medium">{f.time}</p>
                                                    <p className="text-lg">{f.icon}</p>
                                                    <p className="text-xs font-bold">{f.temp}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 5-Day Forecast */}
                                    <div className="bg-white/5 border border-white/5 rounded-3xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Siguientes 5 Días</p>
                                        <div className="space-y-3">
                                            {[
                                                { day: 'Hoy', desc: 'Lluvia', range: '14° - 21°', icon: '🌧️' },
                                                { day: 'Mañana', desc: 'Nublado', range: '15° - 20°', icon: '☁️' },
                                                { day: 'Miércoles', desc: 'Despejado', range: '16° - 22°', icon: '☀️' },
                                                { day: 'Jueves', desc: 'Tormentas', range: '13° - 18°', icon: '⛈️' },
                                                { day: 'Viernes', desc: 'Soleado', range: '15° - 23°', icon: '☀️' }
                                            ].map((d, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs">
                                                    <p className="font-bold w-16">{d.day}</p>
                                                    <span className="text-lg">{d.icon}</span>
                                                    <p className="text-white/60 w-24 text-left">{d.desc}</p>
                                                    <p className="font-mono font-bold text-white/80">{d.range}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BLANK / BLACK SCREEN DECOY */}
                        {decoyType === 'blank' && (
                            <div 
                                className="flex-1 w-full h-full bg-black cursor-pointer"
                                onClick={handleWeatherSecretTap} // Triple tap exits to PIN
                            />
                        )}

                    </div>
                ) : (
                    // NORMAL ACTIVE EMERGENCY VIEW
                    <div className="flex flex-col h-full relative z-40 animate-fade-in">
                        {/* Status Bar Backdrop (Translucent) */}
                        <div className="h-12 w-full bg-black/20 backdrop-blur-md shrink-0" />

                        {/* Top Header */}
                        <div className="p-6 text-center space-y-4">
                            <div
                                className="inline-flex items-center gap-3 px-6 py-2.5 bg-red-600 rounded-2xl text-white font-black text-xs tracking-widest uppercase shadow-[0_0_30px_rgba(220,38,38,0.5)] border border-white/20 animate-pulse"
                            >
                                <div className="size-2.5 rounded-full bg-white" />
                                REC • EN VIVO
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-1">PROTOCOLO ACTIVO</h1>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Sincronizando con autoridades...</p>
                                </div>

                                <div className="flex flex-col gap-3 bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 max-w-[320px] mx-auto shadow-2xl">
                                    {autoCall112 && (
                                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                                        <div className="size-5 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                                            <span className="text-[10px] text-white font-black">📞</span>
                                        </div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-widest">LLAMANDO AL 112...</p>
                                    </div>
                                    )}
                                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '400ms' }}>
                                        <div className="size-5 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                                            <span className="text-[10px] text-black font-black">✓</span>
                                        </div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-widest">Contactos Alertados</p>
                                    </div>
                                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '600ms' }}>
                                        <div className="size-5 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                                            <div className="size-2 rounded-full bg-white animate-pulse" />
                                        </div>
                                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Compartiendo Vídeo + GPS</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Center Visual/Status */}
                        {!isCameraStarted && Capacitor.isNativePlatform() && (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <Loader2 className="animate-spin text-white/40" size={40} />
                                <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Enlazando cámara de seguridad...</p>
                            </div>
                        )}

                        <div className="flex-1" />

                        {/* Bottom Indicators & Stop Button */}
                        <div className="p-10 space-y-12">
                            {/* HUD Indicators */}
                            <div className="flex justify-center gap-6">
                                <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-white/50">
                                    <Mic size={16} className="text-red-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">LIVE</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-white/50">
                                    <Video size={16} className="text-red-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">HD</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-white/50">
                                    <Phone size={16} className="text-blue-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">GPS</span>
                                </div>
                            </div>

                            {/* Stop Trigger */}
                            <div className="flex flex-col items-center gap-6">
                                <button
                                    onClick={() => setStep('pin')}
                                    className="group relative size-28 active:scale-95 transition-all"
                                >
                                    <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-10" />
                                    <div className="relative h-full w-full rounded-full bg-white flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                                        <div className="size-10 bg-red-600 rounded-xl" />
                                    </div>
                                </button>
                                <div className="text-center">
                                    <p className="text-white font-black text-xs uppercase tracking-widest mb-1">DETENER ALERTA</p>
                                    <p className="text-white/30 font-medium text-[9px] uppercase tracking-widest font-mono">(Requiere PIN)</p>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Nav Spacer */}
                        <div className="pb-safe-bottom" />
                        <div className="h-[84px] shrink-0" />
                    </div>
                )
            )}

            {step === 'pin' && (
                <div className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-[40px] z-[100] animate-fade-in">
                    {/* Background Decorative Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_40%,_rgba(239,68,68,0.15)_0%,_transparent_60%)] pointer-events-none" />

                    {/* PIN Header */}
                    <div className="text-center space-y-4 mb-16 relative z-10">
                        <div className="inline-flex items-center justify-center size-24 rounded-[2.5rem] bg-white/5 border border-white/10 text-red-500 mb-4 shadow-2xl backdrop-blur-xl animate-scale-in">
                            <ShieldAlert size={48} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">DESACTIVAR SOS</h1>
                        <p className="text-white/40 font-black uppercase tracking-[0.3em] text-[9px]">Código de Seguridad Requerido</p>
                    </div>

                    {/* PIN Dots */}
                    <div className="flex gap-5 mb-16 relative z-10">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={clsx(
                                    "size-18 rounded-3xl border-2 flex items-center justify-center transition-all duration-300",
                                    pinError ? "border-red-500 bg-red-500/10 animate-shake" : 
                                    pinInput.length > i ? "bg-white border-white shadow-[0_0_30px_rgba(255,255,255,0.3)]" : 
                                    pinInput.length === i ? "border-white/30 bg-white/5" : "border-white/5 bg-white/[0.03] backdrop-blur-3xl"
                                )}
                            >
                                {pinInput.length > i && (
                                    <div className="size-4 bg-black rounded-full animate-scale-in" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Number Pad */}
                    <div className="grid grid-cols-3 gap-x-8 gap-y-6 w-full max-w-[320px] relative z-10">
                        {[
                            { val: "1", label: "" }, { val: "2", label: "ABC" }, { val: "3", label: "DEF" },
                            { val: "4", label: "GHI" }, { val: "5", label: "JKL" }, { val: "6", label: "MNO" },
                            { val: "7", label: "PQRS" }, { val: "8", label: "TUV" }, { val: "9", label: "WXYZ" },
                            { val: "back", icon: <X size={24} /> }, { val: "0", label: "" }, { val: "delete", icon: <Delete size={24} /> }
                        ].map((btn, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    if (btn.val === "back") setStep('active');
                                    else if (btn.val === "delete") {
                                        if (pinInput.length > 0) {
                                            setPinInput(p => p.slice(0, -1));
                                            if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
                                        }
                                    }
                                    else handlePinKeyPress(btn.val);
                                }}
                                className={clsx(
                                    "h-20 rounded-[2rem] flex flex-col items-center justify-center transition-all duration-300 border border-white/5 animate-fade-in",
                                    btn.val === "back" || btn.val === "delete" ? "bg-transparent text-white/30" : "bg-white/10 backdrop-blur-xl text-white shadow-lg active:scale-90 active:bg-white/20"
                                )}
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                {btn.icon ? btn.icon : (
                                    <>
                                        <span className="text-2xl font-black italic">{btn.val}</span>
                                        {btn.label && <span className="text-[7px] font-black opacity-30 tracking-[0.2em] -mt-1">{btn.label}</span>}
                                    </>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Emergency Contact Hint */}
                    <div className="mt-16 text-white/20 text-[9px] font-black uppercase tracking-[0.3em] text-center max-w-[240px] leading-relaxed animate-fade-in" style={{ animationDelay: '500ms' }}>
                        ¿Olvidaste tu PIN?<br/>
                        Contacta con tu grupo de confianza
                    </div>
                </div>
            )}

            <ReviewPromptModal isOpen={showReview} onClose={handleReviewClose} />
        </div>
    );
};
