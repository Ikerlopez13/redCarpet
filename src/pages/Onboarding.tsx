import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MapPin, BellRing, ChevronRight } from 'lucide-react';
import { requestSOSPermissions, requestNotificationPermission } from '../services/sosService';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { PrivacyPolicy } from './PrivacyPolicy';

type Step = 'welcome' | 'permissions' | 'privacy';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('welcome');
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

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
                            <span className="material-symbols-outlined text-5xl">explore</span>
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black uppercase italic tracking-tighter">{t('onboarding.welcome.title')}</h1>
                            <p className="text-white/40 text-lg leading-tight max-w-[280px]">{t('onboarding.welcome.subtitle')}</p>
                        </div>
                    </div>
                )}

                {step === 'permissions' && (
                    <div className="space-y-8 flex flex-col items-center w-full">
                        <div className="size-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
                            <MapPin size={40} />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter">{t('onboarding.permissions.title')}</h2>
                            <p className="text-white/40 text-sm leading-relaxed px-4">{t('onboarding.permissions.subtitle')}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <MapPin size={24} className="text-primary" />
                                <div className="text-left">
                                    <p className="text-sm font-bold">{t('onboarding.permissions.location_title')}</p>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black">{t('onboarding.permissions.location_subtitle')}</p>
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
                    <div className="space-y-8 flex flex-col items-center w-full">
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
                            {step === 'welcome' ? t('onboarding.buttons.start') : step === 'permissions' ? t('onboarding.buttons.continue') : t('onboarding.buttons.finish')}
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
