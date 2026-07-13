import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MapPin, BellRing, ChevronRight, User, Calendar, Map, Activity, ShieldAlert } from 'lucide-react';
import { requestSOSPermissions, requestNotificationPermission } from '../services/sosService';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor, registerPlugin } from '@capacitor/core';
const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');
import { PrivacyPolicy } from './PrivacyPolicy';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

type Step = 'welcome' | 'profile' | 'habits' | 'permissions' | 'privacy';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, refreshProfile } = useAuth();
    
    const [step, setStep] = useState<Step>('welcome');
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

    // Profile State
    const [fullName, setFullName] = useState(user?.profile?.full_name || user?.user_metadata?.full_name || '');
    const [dob, setDob] = useState('');
    const hasNameFromProvider = !!(user?.profile?.full_name || user?.user_metadata?.full_name);
    const isAppleUser = user?.app_metadata?.provider === 'apple' || user?.app_metadata?.providers?.includes('apple');
    const shouldAskName = !hasNameFromProvider && !isAppleUser;
    const [habitualCity, setHabitualCity] = useState('');

    // Habits State
    const [walkingAlone, setWalkingAlone] = useState<'daily' | 'occasional' | 'rarely' | ''>('');
    const [riskExposure, setRiskExposure] = useState<'high' | 'medium' | 'low' | ''>('');
    const [habitualZones, setHabitualZones] = useState('');

    const handleNextStep = async () => {
        if (step === 'welcome') {
            setStep('profile');
        } else if (step === 'profile') {
            if (!fullName || !dob || !habitualCity) return; // Prevent next if empty
            setStep('habits');
        } else if (step === 'habits') {
            if (!walkingAlone || !riskExposure) return;
            setStep('permissions');
        } else if (step === 'permissions') {
            setIsProcessing(true);
            try {
                // Request All Permissions
                await new Promise(r => setTimeout(r, 300));
                await requestSOSPermissions();
                
                if (Capacitor.isNativePlatform()) {
                    // Standard geolocation
                    await Geolocation.requestPermissions();
                    
                    // Request ALWAYS background geolocation handled later by GeofenceService
                    // Just request standard foreground/background permissions via standard Capacitor API
                    try {
                        await Geolocation.requestPermissions();
                    } catch (err) {
                        console.warn('[Onboarding] Geo permission prompt failed:', err);
                    }
                }
                
                await requestNotificationPermission();
                setStep('privacy');
            } catch (err) {
                console.error('[Onboarding] Permissions error:', err);
                setStep('privacy'); 
            } finally {
                setTimeout(() => setIsProcessing(false), 500);
            }
        } else if (step === 'privacy') {
            if (!hasAcceptedPrivacy) return;
            setIsProcessing(true);

            // Save to Supabase
            if (user) {
                try {
                    await supabase.from('profiles').update({
                        full_name: fullName,
                        dob: dob,
                        habitual_city: habitualCity,
                        walking_alone_frequency: walkingAlone,
                        risk_exposure_level: riskExposure,
                        habitual_zones: habitualZones ? [habitualZones] : [],
                        privacy_policy_accepted: true,
                        onboarding_completed: true
                    }).eq('id', user.id);
                    await refreshProfile();
                } catch (e) {
                    console.error('Error saving profile data during onboarding:', e);
                }
            }
            
            localStorage.setItem('onboarding_complete', 'true');
            localStorage.setItem('usage_type', 'individual');
            localStorage.setItem('privacy_accepted', 'true');
            localStorage.setItem('emergency_recording_consent', 'true');
            
            setIsProcessing(false);
            navigate('/');
        }
    };

    const isNextDisabled = () => {
        if (isProcessing) return true;
        if (step === 'profile') return (shouldAskName && !fullName) || !dob || !habitualCity;
        if (step === 'habits') return !walkingAlone || !riskExposure;
        if (step === 'privacy') return !hasAcceptedPrivacy;
        return false;
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display relative p-8">
            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mb-8 mt-4 shrink-0">
                {(['welcome', 'profile', 'habits', 'permissions', 'privacy'] as Step[]).map((s) => (
                    <div 
                        key={s} 
                        className={clsx(
                            "h-1 rounded-full transition-all duration-300",
                            step === s ? "w-8 bg-primary" : "w-3 bg-white/10"
                        )} 
                    />
                ))}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto no-scrollbar pb-10">
                {step === 'welcome' && (
                    <div className="space-y-8 flex flex-col items-center animate-fade-in">
                        <div className="size-24 rounded-[2rem] bg-primary/20 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-5xl">explore</span>
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black uppercase italic tracking-tighter">{t('onboarding.welcome.title')}</h1>
                            <p className="text-white/40 text-lg leading-tight max-w-[280px]">{t('onboarding.welcome.subtitle')}</p>
                        </div>
                    </div>
                )}

                {step === 'profile' && (
                    <div className="space-y-6 flex flex-col items-center w-full animate-fade-in">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Tu Perfil de Seguridad</h2>
                        <p className="text-white/40 text-xs leading-relaxed px-4">Esta información vital nos ayudará a identificar tus patrones y agilizar el rescate en caso de emergencia.</p>
                        
                        <div className="w-full max-w-xs space-y-4 text-left">
                            {shouldAskName && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><User size={12}/> Nombre Completo</label>
                                    <input 
                                        type="text" 
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        placeholder="Ej. Ana García"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors"
                                    />
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Fecha de Nacimiento</label>
                                <input 
                                    type="date" 
                                    value={dob}
                                    onChange={e => setDob(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors [color-scheme:dark]"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><Map size={12}/> Ciudad Habitual</label>
                                <input 
                                    type="text" 
                                    value={habitualCity}
                                    onChange={e => setHabitualCity(e.target.value)}
                                    placeholder="Ej. Barcelona"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 'habits' && (
                    <div className="space-y-6 flex flex-col items-center w-full animate-fade-in">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Hábitos de Movimiento</h2>
                        <p className="text-white/40 text-xs leading-relaxed px-4">Ajustaremos nuestro algoritmo de protección según tus rutinas diarias.</p>
                        
                        <div className="w-full max-w-xs space-y-6 text-left">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><Activity size={12}/> ¿Frecuencia caminando sol@?</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['daily', 'occasional', 'rarely'].map(val => (
                                        <button 
                                            key={val}
                                            onClick={() => setWalkingAlone(val as any)}
                                            className={clsx(
                                                "py-2 rounded-xl text-[10px] font-bold uppercase transition-all border",
                                                walkingAlone === val ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                                            )}
                                        >
                                            {val === 'daily' ? 'Diario' : val === 'occasional' ? 'A Veces' : 'Rara vez'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={12}/> Nivel de Exposición al Peligro</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['high', 'medium', 'low'].map(val => (
                                        <button 
                                            key={val}
                                            onClick={() => setRiskExposure(val as any)}
                                            className={clsx(
                                                "py-2 rounded-xl text-[10px] font-bold uppercase transition-all border",
                                                riskExposure === val 
                                                    ? (val === 'high' ? 'bg-red-600 border-red-500 text-white' : val === 'medium' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-green-600 border-green-500 text-white')
                                                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                                            )}
                                        >
                                            {val === 'high' ? 'Alto' : val === 'medium' ? 'Medio' : 'Bajo'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><MapPin size={12}/> Zonas Frecuentes (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={habitualZones}
                                    onChange={e => setHabitualZones(e.target.value)}
                                    placeholder="Ej. Centro, Universidad, Gimnasio"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 'permissions' && (
                    <div className="space-y-8 flex flex-col items-center w-full animate-fade-in">
                        <div className="size-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
                            <MapPin size={40} />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter">{t('onboarding.permissions.title')}</h2>
                            <p className="text-white/40 text-sm leading-relaxed px-4">Necesitamos permisos vitales. Al pedir la ubicación, te rogamos que selecciones <strong className="text-white">"Permitir Siempre"</strong> para que podamos protegerte incluso cuando la app esté cerrada en tu bolsillo.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <MapPin size={24} className="text-primary" />
                                <div className="text-left">
                                    <p className="text-sm font-bold">Ubicación (Siempre)</p>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">Vital para rescates</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <BellRing size={24} className="text-primary" />
                                <div className="text-left">
                                    <p className="text-sm font-bold">{t('onboarding.permissions.notifications_title')}</p>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">{t('onboarding.permissions.notifications_subtitle')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'privacy' && (
                    <div className="space-y-8 flex flex-col items-center w-full animate-fade-in">
                        <div className="size-20 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-500">
                            <span className="material-symbols-outlined text-4xl">verified_user</span>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter">{t('onboarding.privacy.title')}</h2>
                            <label className="flex items-center gap-3 px-4 py-4 bg-white/5 rounded-xl cursor-pointer active:scale-95 transition-all w-full max-w-xs border border-white/5 mt-8">
                                <input 
                                    type="checkbox" 
                                    checked={hasAcceptedPrivacy}
                                    onChange={(e) => setHasAcceptedPrivacy(e.target.checked)}
                                    className="size-5 rounded border-white/20 bg-transparent text-primary focus:ring-primary shadow-inner"
                                />
                                <span className="text-xs font-bold text-white/80">
                                    {t('onboarding.privacy.accept')} <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPrivacyPolicy(true); }} className="text-blue-400 underline active:text-blue-300">{t('onboarding.privacy.policy')}</span>
                                </span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Button */}
            <div className="pb-4 shrink-0">
                <button
                    onClick={handleNextStep}
                    disabled={isNextDisabled()}
                    className={clsx(
                        "w-full py-5 rounded-[2rem] font-black text-xl uppercase italic tracking-tighter transition-all flex items-center justify-center gap-3",
                        isNextDisabled()
                            ? "bg-white/10 text-white/20" 
                            : "bg-white text-black bg-gradient-to-r from-white to-zinc-200 shadow-2xl active:scale-95 shadow-white/10"
                    )}
                >
                    {isProcessing ? (
                        <div className="size-6 border-4 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            {step === 'welcome' ? t('onboarding.buttons.start') : step === 'permissions' ? t('onboarding.buttons.continue') : step === 'privacy' ? t('onboarding.buttons.finish') : 'Siguiente'}
                            <ChevronRight size={24} />
                        </>
                    )}
                </button>
            </div>

            {/* Privacy Policy Fullscreen Overlay */}
            {showPrivacyPolicy && (
                <div className="fixed inset-0 z-[100] bg-background-dark overflow-y-auto">
                    <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} />
                </div>
            )}
        </div>
    );
};

