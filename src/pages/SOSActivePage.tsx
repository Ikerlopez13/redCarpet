import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, X, Delete, Loader2, Phone, Mic, Video } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
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
    const [step, setStep] = useState<'active' | 'pin'>('active');
    
    // PIN State
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);

    useEffect(() => {
        console.log('[SOS-Active-Page] Mounted. AlertID:', alertId);
        
        const initSOS = async () => {
            // 1. Initial delay to ensure the route Transition is smooth
            await new Promise(r => setTimeout(r, 500));

            // 2. Start Native Preview (Mirroring handled in Plugin.swift now)
            if (Capacitor.isNativePlatform()) {
                await startSOSPreview();
                // Ensure state updates AFTER preview start to trigger transparency
                setTimeout(() => {
                    setIsCameraStarted(true);
                    document.body.classList.add('sos-mode-active');
                }, 300);
            }

            // 3. Start Recording (Resilient with it's own timeouts)
            await startRecording(isPremium);
        };

        initSOS();

        return () => {
            console.log('[SOS-Active-Page] Unmounting. Cleaning up...');
            cleanAll();
        };
    }, []);

    const cleanAll = async () => {
        document.body.classList.remove('sos-mode-active');
        if (Capacitor.isNativePlatform()) {
            await stopSOSPreview();
        }
    };

    const handlePinKeyPress = async (key: string) => {
        setPinError(false);
        
        // Haptic feedback on press
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light });
        }

        if (pinInput.length < 4) {
            const newPin = pinInput + key;
            setPinInput(newPin);

            if (newPin.length === 4) {
                const correctPin = user?.profile?.sos_pin || '0000';
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
                                <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                                    <div className="size-5 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                                        <span className="text-[10px] text-white font-black">📞</span>
                                    </div>
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest">LLAMANDO AL 112...</p>
                                </div>
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
        </div>
    );
};
