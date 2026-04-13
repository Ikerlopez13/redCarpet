import { Preferences } from '@capacitor/preferences';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { ShieldCheck, ChevronRight, X } from 'lucide-react';
import React, { useState } from 'react';

interface EmergencyConsentModalProps {
    isOpen: boolean;
    onConsent: () => void;
    onDecline: () => void;
}

export const CONSENT_KEY = 'emergency_recording_consent';

export async function checkEmergencyConsent(): Promise<boolean> {
    const { value } = await Preferences.get({ key: CONSENT_KEY });
    return value === 'true';
}

export function EmergencyConsentModal({ isOpen, onConsent, onDecline }: EmergencyConsentModalProps) {
    const { user, refreshProfile } = useAuth();
    const [accepted, setAccepted] = useState(false);

    const handleConfirm = async () => {
        if (!accepted) return;

        // Save locally
        await Preferences.set({ key: CONSENT_KEY, value: 'true' });

        // Save to Database if logged in
        if (user) {
            await supabase
                .from('profiles')
                // @ts-ignore
                .update({ has_accepted_privacy_policy: true })
                .eq('id', user.id);

            // Refresh profile context
            if (refreshProfile) {
                await refreshProfile();
            }
        }

        onConsent();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-12 bg-black/80 backdrop-blur-md">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative">
                <button 
                    onClick={onDecline}
                    className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shadow-inner">
                        <ShieldCheck size={40} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Protocolo Legal</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                            Para tu protección, la app grabará audio y vídeo y compartirá tu ubicación en caso de SOS. ¿Confirmas tu consentimiento?
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <label className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer active:scale-95 transition-all outline-none border border-white/5">
                        <input 
                            type="checkbox" 
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            className="mt-0.5 size-5 rounded border-white/20 bg-transparent text-primary focus:ring-primary shadow-inner"
                        />
                        <span className="text-xs font-bold text-white/70 leading-relaxed">
                            He leído y acepto que se graben evidencias multimedia en caso de emergencia.
                        </span>
                    </label>

                    <button
                        onClick={handleConfirm}
                        disabled={!accepted}
                        className={`w-full py-5 rounded-[2rem] font-black text-xl italic uppercase tracking-tighter shadow-2xl flex items-center justify-center gap-3 transition-all ${
                            accepted ? 'bg-white text-black active:scale-95' : 'bg-white/10 text-white/20'
                        }`}
                    >
                        CONFIRMAR Y ACTIVAR
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}
