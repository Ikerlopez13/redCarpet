import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';

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
    const [agreed, setAgreed] = useState(false);
    const { user, refreshProfile } = useAuth();

    const handleConfirm = async () => {
        if (!agreed) return;

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <Shield size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Aviso Legal Importante</h2>
                    <p className="text-sm text-zinc-400">
                        Antes de utilizar la función de emergencia, debes aceptar los términos de uso y privacidad.
                    </p>
                </div>

                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 mb-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <div className="relative flex items-center mt-1">
                            <input
                                type="checkbox"
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-zinc-500 bg-zinc-800 checked:border-red-500 checked:bg-red-500 transition-all"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                            />
                            <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" viewBox="0 0 14 14" fill="none">
                                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="text-xs text-zinc-300 leading-tight">
                            En caso de emergencia, la aplicación grabará audio y/o vídeo y compartirá enlaces con tus contactos de confianza para garantizar tu seguridad.
                        </span>
                    </label>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onDecline}
                        className="flex-1 py-3 text-zinc-400 font-medium hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!agreed}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all ${agreed
                            ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                    >
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
}
