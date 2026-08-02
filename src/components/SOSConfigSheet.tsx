import React, { useState, useEffect } from 'react';
import { X, Shield, Phone, Bell, MapPin, Mic, Info } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { useTranslation } from 'react-i18next';

export interface SOSConfigData {
    contacts: string[];
    pin: string;
    autoCall112: boolean;
    shareLocation: boolean;
    recordAudio: boolean;
    privacyPolicyAccepted: boolean;
    isConfigured: boolean;
}

interface SOSConfigSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: SOSConfigData) => void;
    currentConfig?: SOSConfigData;
}

export const SOSConfigSheet: React.FC<SOSConfigSheetProps> = ({ 
    isOpen, 
    onClose, 
    onSave,
    currentConfig 
}) => {
    const { t } = useTranslation();
    const [pin, setPin] = useState(currentConfig?.pin || '');
    const [autoCall112, setAutoCall112] = useState(currentConfig?.autoCall112 ?? true);
    const [shareLocation, setShareLocation] = useState(currentConfig?.shareLocation ?? true);
    const [recordAudio, setRecordAudio] = useState(currentConfig?.recordAudio ?? true);
    const [step, setStep] = useState<'intro' | 'pin' | 'options'>('intro');

    useEffect(() => {
        if (currentConfig?.pin) {
            setPin(currentConfig.pin);
            setStep('options');
        }
    }, [currentConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (pin.length < 4) {
            alert(t('settings.sos.pin_error'));
            return;
        }

        onSave({
            contacts: [],
            pin,
            autoCall112,
            shareLocation,
            recordAudio,
            privacyPolicyAccepted: true,
            isConfigured: true
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                        {t('settings.sos.title')}
                    </h2>
                    {currentConfig?.isConfigured && (
                        <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-white/40">
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="px-8 pb-10 space-y-6">
                    {step === 'intro' && (
                        <div className="space-y-6">
                            <div className="p-5 bg-primary/10 rounded-3xl border border-primary/20 space-y-3">
                                <div className="flex items-center gap-3 text-primary">
                                    <Shield size={24} />
                                    <span className="font-bold uppercase tracking-tight italic">{t('settings.sos.protocol')}</span>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed font-medium">
                                    {t('settings.sos.protocol_desc')}
                                </p>
                            </div>
                            
                            <button 
                                onClick={() => setStep('pin')}
                                className="w-full py-5 bg-white text-black rounded-[2rem] font-black text-xl italic uppercase tracking-tighter active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl"
                            >
                                {t('settings.sos.start')}
                            </button>
                        </div>
                    )}

                    {step === 'pin' && (
                        <div className="space-y-6">
                            <div className="space-y-2 text-center">
                                <p className="text-sm font-bold text-white/40 uppercase tracking-widest">{t('settings.sos.pin_title')}</p>
                                <p className="text-xs text-white/20">{t('settings.sos.pin_desc')}</p>
                            </div>

                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="----"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 text-center text-4xl font-black tracking-[1em] text-white outline-none focus:border-primary transition-all"
                            />

                            <button 
                                onClick={() => setStep('options')}
                                disabled={pin.length < 4}
                                className={`w-full py-5 rounded-[2rem] font-black text-xl italic uppercase tracking-tighter transition-all ${
                                    pin.length >= 4 ? 'bg-primary text-white active:scale-95 shadow-lg shadow-primary/20' : 'bg-white/5 text-white/20'
                                }`}
                            >
                                {t('settings.sos.continue')}
                            </button>
                        </div>
                    )}

                    {step === 'options' && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <ToggleOption 
                                    icon={<Phone size={20} />}
                                    label={t('settings.sos.call_112')}
                                    description={t('settings.sos.call_112_desc')}
                                    enabled={autoCall112}
                                    onChange={setAutoCall112}
                                />
                                <ToggleOption 
                                    icon={<MapPin size={20} />}
                                    label={t('settings.sos.share_location')}
                                    description={t('settings.sos.share_location_desc')}
                                    enabled={shareLocation}
                                    onChange={setShareLocation}
                                />
                                <ToggleOption 
                                    icon={<Mic size={20} />}
                                    label={t('settings.sos.record_media')}
                                    description={t('settings.sos.record_media_desc')}
                                    enabled={recordAudio}
                                    onChange={setRecordAudio}
                                />
                            </div>

                            <div className="pt-2">
                                <button 
                                    onClick={handleSave}
                                    className="w-full py-5 bg-white text-black rounded-[2rem] font-black text-xl italic uppercase tracking-tighter active:scale-95 transition-all shadow-xl"
                                >
                                    {t('settings.sos.save')}
                                </button>
                                <button 
                                    onClick={() => setStep('pin')}
                                    className="w-full py-3 text-white/40 text-xs font-bold uppercase tracking-widest mt-2"
                                >
                                    {t('settings.sos.change_pin')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ToggleOption: React.FC<{
    icon: React.ReactNode;
    label: string;
    description: string;
    enabled: boolean;
    onChange: (val: boolean) => void;
}> = ({ icon, label, description, enabled, onChange }) => (
    <div className={`p-4 rounded-3xl border transition-all flex items-center gap-4 ${
        enabled ? 'bg-white/10 border-white/10' : 'bg-transparent border-white/5 opacity-50'
    }`} onClick={() => onChange(!enabled)}>
        <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${
            enabled ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40'
        }`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0 text-left">
            <p className="font-bold text-white text-sm">{label}</p>
            <p className="text-[11px] text-white/40 leading-tight">{description}</p>
        </div>
        <div className={`w-12 h-6 rounded-full p-1 transition-all ${enabled ? 'bg-primary' : 'bg-zinc-800'}`}>
            <div className={`size-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </div>
    </div>
);
