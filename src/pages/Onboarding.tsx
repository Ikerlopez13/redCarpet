import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ShieldCheck, Camera, MapPin, BellRing, ChevronRight } from 'lucide-react';
import { requestSOSPermissions, requestNotificationPermission } from '../services/sosService';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

type Step = 'welcome' | 'permissions' | 'privacy';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('welcome');
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);

    const handleNextStep = async () => {
        if (step === 'welcome') {
            setStep('permissions');
        } else if (step === 'permissions') {
            setIsProcessing(true);
            try {
                // Request All Permissions
                await requestSOSPermissions();
                if (Capacitor.isNativePlatform()) {
                    await Geolocation.requestPermissions();
                }
                await requestNotificationPermission();
                setStep('privacy');
            } catch (err) {
                console.error('Permissions error:', err);
                setStep('privacy');
            } finally {
                setIsProcessing(false);
            }
        } else if (step === 'privacy') {
            if (!hasAcceptedPrivacy) return;
            
            localStorage.setItem('onboarding_complete', 'true');
            localStorage.setItem('usage_type', 'individual');
            localStorage.setItem('privacy_accepted', 'true');
            localStorage.setItem('emergency_recording_consent', 'true');
            
            navigate('/');
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display relative p-8">
            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mb-12 mt-4">
                {(['welcome', 'permissions', 'privacy'] as Step[]).map((s) => (
                    <div 
                        key={s} 
                        className={clsx(
                            "h-1 rounded-full transition-all duration-300",
                            step === s ? "w-8 bg-primary" : "w-3 bg-white/10"
                        )} 
                    />
                ))}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                {step === 'welcome' && (
                    <div className="space-y-8 flex flex-col items-center">
                        <div className="size-24 rounded-[2rem] bg-primary/20 flex items-center justify-center text-primary">
                            <ShieldCheck size={48} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black uppercase italic tracking-tighter">Bienvenida a RedCarpet</h1>
                            <p className="text-white/40 text-lg leading-tight max-w-[280px]">Tu red personal de seguridad pública impulsada por la comunidad.</p>
                        </div>
                    </div>
                )}

                {step === 'permissions' && (
                    <div className="space-y-8 flex flex-col items-center w-full">
                        <div className="size-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
                            <Camera size={40} />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Configurar Protección</h2>
                            <p className="text-white/40 text-sm leading-relaxed px-4">Necesitamos acceso a tu ubicación y cámara para activar los protocolos de seguridad SOS en tiempo real.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <MapPin size={24} className="text-primary" />
                                <div className="text-left">
                                    <p className="text-sm font-bold">Ubicación Precisa</p>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Incluso en segundo plano</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <BellRing size={24} className="text-primary" />
                                <div className="text-left">
                                    <p className="text-sm font-bold">Notificaciones</p>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Alertas de seguridad críticas</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'privacy' && (
                    <div className="space-y-8 flex flex-col items-center w-full">
                        <div className="size-20 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-500">
                            <ShieldCheck size={40} />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Tu Privacidad</h2>
                            <div className="bg-white/5 rounded-2xl p-6 text-left space-y-4 max-h-[250px] overflow-y-auto no-scrollbar border border-white/5">
                                <p className="text-xs text-white/60 leading-relaxed font-medium">
                                    Tus datos están encriptados. La ubicación solo se comparte con tus contactos de confianza cuando se activa una alerta SOS.
                                </p>
                                <p className="text-xs text-white/60 leading-relaxed font-medium">
                                    Al pulsar el botón SOS, la aplicación capturará audio y vídeo para tu protección y evidencia legal.
                                </p>
                            </div>
                            <label className="flex items-center gap-3 px-4 py-4 bg-white/5 rounded-xl cursor-pointer active:scale-95 transition-all w-full max-w-xs border border-white/5">
                                <input 
                                    type="checkbox" 
                                    checked={hasAcceptedPrivacy}
                                    onChange={(e) => setHasAcceptedPrivacy(e.target.checked)}
                                    className="size-5 rounded border-white/20 bg-transparent text-primary focus:ring-primary shadow-inner"
                                />
                                <span className="text-xs font-bold text-white/80">Acepto la Política de Privacidad</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Button */}
            <div className="pb-8">
                <button
                    onClick={handleNextStep}
                    disabled={isProcessing || (step === 'privacy' && !hasAcceptedPrivacy)}
                    className={clsx(
                        "w-full py-5 rounded-[2rem] font-black text-xl uppercase italic tracking-tighter transition-all flex items-center justify-center gap-3",
                        (isProcessing || (step === 'privacy' && !hasAcceptedPrivacy))
                            ? "bg-white/10 text-white/20" 
                            : "bg-white text-black bg-gradient-to-r from-white to-zinc-200 shadow-2xl active:scale-95 shadow-white/10"
                    )}
                >
                    {isProcessing ? (
                        <div className="size-6 border-4 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            {step === 'welcome' ? 'Comenzar' : step === 'permissions' ? 'Continuar y Permitir' : 'Finalizar Configuración'}
                            <ChevronRight size={24} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
