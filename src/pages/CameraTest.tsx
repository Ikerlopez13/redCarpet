import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, RefreshCw, AlertCircle, ShieldAlert, X, Delete, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import clsx from 'clsx';

import { 
    startSOSPreview, 
    stopSOSPreview, 
    startRecording, 
    stopAndUploadRecording, 
    updateSOSAlertMedia 
} from '../services/sosService';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext.base';

export const CameraTest: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isPremium } = useAuth();
    
    // SOS State from Navigation
    const sosState = location.state as { 
        isSOS?: boolean; 
        alertId?: string; 
        reason?: string;
        mode?: 'visible' | 'discrete';
    } | null;
    
    const isSOS = sosState?.isSOS || false;
    const alertId = sosState?.alertId || null;
    const sosMode = sosState?.mode || 'visible';

    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [step, setStep] = useState<'active' | 'pin'>(isSOS ? 'active' : 'active'); // Default to active layout
    
    // PIN State
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    const [localSOSPin, setLocalSOSPin] = useState<string | null>(null);

    // Initial Setup
    useEffect(() => {
        console.log('[Camera SOS Page] Mounted. State:', { 
            isSOS, 
            alertId, 
            sosMode,
            path: location.pathname
        });

        Preferences.get({ key: 'SOS_PIN' }).then(({ value }) => {
            if (value) setLocalSOSPin(value);
        });

        if (isSOS) {
            handleStartSOS();
        } else {
            startStandardCamera();
        }

        return () => {
            console.log('[Camera SOS Page] Unmounting');
            handleCleanup();
        };
    }, [isSOS]);

    const handleStartSOS = async () => {
        console.log('[Camera SOS Page] handleStartSOS triggered. Initializing emergency recording...');
        
        // 1. Start Native Preview (Mirrored)
        if (Capacitor.isNativePlatform()) {
            await startSOSPreview();
        } else {
            await startStandardCamera();
        }

        // 2. Start Native Recording
        await startRecording(isPremium);
        setIsStreaming(true);
    };

    const startStandardCamera = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            }
        } catch (err) {
            console.error('Error starting camera:', err);
            setError('No se pudo acceder a la cámara frontal.');
            setIsStreaming(false);
        }
    };

    const handleCleanup = async () => {
        if (Capacitor.isNativePlatform()) {
            await stopSOSPreview();
        }
        
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsStreaming(false);
    };

    const handleStopAttempt = () => {
        const finalPin = user?.profile?.sos_pin || localSOSPin;
        if (finalPin) {
            setStep('pin');
        } else {
            handleFinalStop();
        }
    };

    const handlePinKeyPress = (key: string) => {
        setPinError(false);
        if (pinInput.length < 4) {
            const newPin = pinInput + key;
            setPinInput(newPin);

            if (newPin.length === 4) {
                const finalPin = user?.profile?.sos_pin || localSOSPin;
                if (newPin === finalPin) {
                    handleFinalStop();
                } else {
                    setPinError(true);
                    setTimeout(() => {
                        setPinInput('');
                        setPinError(false);
                    }, 1000);
                }
            }
        }
    };

    const handleFinalStop = async () => {
        setIsStreaming(false);
        if (user) {
            const url = await stopAndUploadRecording(user.id);
            if (url && alertId) {
                await updateSOSAlertMedia(alertId, url);
            }
        }
        
        if (Capacitor.isNativePlatform()) {
            await stopSOSPreview();
        }
        
        // Redirect back home or to safety check
        navigate('/');
    };

    // Nuclear Transparency Effect for SOS
    useEffect(() => {
        if (isSOS && step === 'active') {
            document.body.classList.add('sos-mode-active');
            const styleId = 'sos-camera-transparency';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                    .bg-background-dark, #root, .ion-page, ion-content, body {
                        background: transparent !important;
                    }
                    .sos-native-preview {
                        z-index: -1 !important;
                    }
                `;
                document.head.appendChild(style);
            }
            return () => {
                document.body.classList.remove('sos-mode-active');
                const style = document.getElementById(styleId);
                if (style) style.remove();
            };
        }
    }, [isSOS, step]);

    return (
        <div className={clsx(
            "flex flex-col h-full text-white transition-colors duration-500",
            isSOS ? "bg-transparent" : "bg-background-dark p-6"
        )}>
            {/* SOS Active UI */}
            {step === 'active' && (
                <div className="flex flex-col h-full animate-fade-in">
                    {isSOS ? (
                        /* SOS OVERLAY */
                        <div className="flex-1 flex flex-col items-center justify-between py-12 px-6 relative z-50">
                            <div className="text-center space-y-4">
                                <div
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-red-600 font-black text-xs tracking-widest uppercase shadow-2xl animate-pulse"
                                >
                                    <div className="size-2 rounded-full bg-red-600" />
                                    SOS EN CURSO
                                </div>
                                <h1 className="text-4xl font-black uppercase tracking-tight">Cámara Activa</h1>
                                <p className="text-white/60 text-sm font-medium">Grabando y enviando señal de auxilio...</p>
                            </div>

                            {/* Transparent Area for Native Camera */}
                            <div className="flex-1 w-full flex items-center justify-center">
                                {!Capacitor.isNativePlatform() && (
                                    <div className="relative aspect-[3/4] w-full max-w-sm rounded-[40px] overflow-hidden border-4 border-red-600 shadow-2xl animate-scale-in">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover"
                                            style={{ transform: 'scaleX(-1)' }}
                                        />
                                        <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full animate-pulse">
                                            <div className="size-2 rounded-full bg-white" />
                                            <span className="text-[10px] font-black tracking-widest uppercase">REC</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center gap-6">
                                <button
                                    onClick={handleStopAttempt}
                                    className="group relative size-24 active:scale-95 transition-all"
                                >
                                    <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
                                    <div className="relative h-full w-full rounded-full bg-white flex items-center justify-center shadow-2xl">
                                        <div className="size-8 bg-red-600 rounded-lg" />
                                    </div>
                                </button>
                                <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.3em]">
                                    Mantén para detener
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* STANDARD CAMERA TEST */
                        <>
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <Camera className="text-primary w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold">Prueba de Cámara</h1>
                                    <p className="text-sm text-slate-400">Verificando stream frontal</p>
                                </div>
                            </header>

                            <main className="flex-1 flex flex-col gap-6">
                                <div className="relative aspect-[3/4] w-full max-w-sm mx-auto bg-slate-900 rounded-3xl overflow-hidden border border-white/5 shadow-2xl animate-fade-in">
                                    {error ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center gap-4">
                                            <AlertCircle className="text-red-500 w-12 h-12" />
                                            <p className="text-red-400 font-medium">{error}</p>
                                            <button 
                                                onClick={startStandardCamera}
                                                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2"
                                            >
                                                <RefreshCw size={18} />
                                                Reintentar
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {!isStreaming && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                                </div>
                                            )}
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className={clsx(
                                                    "w-full h-full object-cover",
                                                    !isStreaming && "hidden"
                                                )}
                                            />
                                        </>
                                    )}
                                </div>
                            </main>

                            <footer className="mt-auto pt-6 text-center">
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium">
                                    Modo Diagnóstico
                                </p>
                            </footer>
                        </>
                    )}
                </div>
            )}

            {step === 'pin' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-2xl z-[100] animate-fade-in">
                    <div className="text-center space-y-4 mb-12">
                        <div className="inline-flex items-center justify-center size-20 rounded-full bg-red-600/20 text-red-600 mb-4 animate-scale-in">
                            <ShieldAlert size={40} />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">Seguridad PIN</h1>
                        <p className="text-white/60 font-medium max-w-[280px] mx-auto">Introduce el código para desactivar la alerta SOS de forma segura.</p>
                    </div>

                    {/* PIN Dots */}
                    <div className="flex gap-4 mb-12">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={clsx(
                                    "size-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all",
                                    pinError ? "border-red-600 bg-red-600/20 text-white animate-shake" :
                                        pinInput.length > i ? "border-white bg-white text-black shadow-lg shadow-white/20" : 
                                        pinInput.length === i ? "border-white/40 bg-white/5" : "border-white/10 bg-white/5"
                                )}
                            >
                                {pinInput.length > i ? "●" : ""}
                            </div>
                        ))}
                    </div>

                    {/* Number Pad */}
                    <div className="grid grid-cols-3 gap-6 w-full max-w-[320px]">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "delete"].map((key, i) => (
                            key === "back" ? (
                                <button 
                                    key={i}
                                    onClick={() => setStep('active')}
                                    className="size-20 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors animate-fade-in"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <X size={24} />
                                </button>
                            ) : (
                                <button
                                    key={i}
                                    onClick={() => key === "delete" ? setPinInput(p => p.slice(0, -1)) : handlePinKeyPress(key)}
                                    className="size-20 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-2xl font-black transition-all active:scale-90 border border-white/5 animate-fade-in shadow-xl"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    {key === "delete" ? <Delete size={24} /> : key}
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
