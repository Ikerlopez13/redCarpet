import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

interface ReviewPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({ isOpen, onClose }) => {
    const [rating, setRating] = useState<number>(0);
    const [hover, setHover] = useState<number>(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleRating = async (val: number) => {
        setRating(val);
        if (val >= 4) {
            // Redirect to stores for 4 and 5 stars
            if (Capacitor.isNativePlatform()) {
                const url = Capacitor.getPlatform() === 'ios'
                    ? 'itms-apps://itunes.apple.com/app/id6755689618?action=write-review'
                    : 'market://details?id=com.vibecode.redcarpet';
                try {
                    window.location.href = url;
                } catch (e) {
                    console.error("Failed to open store link", e);
                }
            }
            await Preferences.set({ key: 'HAS_RATED_APP', value: 'true' });
            setSubmitted(true);
            setTimeout(onClose, 2000);
        } else {
            // Show feedback prompt for 1 to 3 stars
            setShowFeedback(true);
        }
    };

    const submitFeedback = async () => {
        // Here feedback would be sent to the backend
        await Preferences.set({ key: 'HAS_RATED_APP', value: 'true' });
        setSubmitted(true);
        setTimeout(onClose, 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-[#121216] border border-white/10 rounded-3xl p-8 w-full max-w-sm relative text-center shadow-2xl z-10 animate-scale-in">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                    <X size={20} />
                </button>
                
                {!submitted ? (
                    <>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">¿Qué te parece RedCarpet?</h2>
                        <p className="text-sm text-white/60 mb-8">Tu opinión nos ayuda a salvar más vidas y mejorar la aplicación.</p>
                        
                        {!showFeedback ? (
                            <div className="flex justify-center gap-2 mb-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => handleRating(star)}
                                        onMouseEnter={() => setHover(star)}
                                        onMouseLeave={() => setHover(0)}
                                        className="transition-transform active:scale-90 p-1"
                                    >
                                        <Star
                                            size={44}
                                            strokeWidth={1.5}
                                            className={(hover || rating) >= star ? "text-amber-500 fill-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "text-white/20"}
                                        />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="animate-fade-in text-left">
                                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-3">¿Qué podemos mejorar?</label>
                                <textarea
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="Dinos cómo podemos hacer la app mejor para ti..."
                                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 resize-none outline-none focus:border-red-500 transition-colors"
                                />
                                <button 
                                    onClick={submitFeedback}
                                    className="w-full mt-4 bg-red-600 text-white font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-900/50"
                                >
                                    Enviar Comentarios
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="animate-fade-in py-8">
                        <div className="size-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                            <span className="material-symbols-outlined text-3xl font-black">favorite</span>
                        </div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">¡Gracias!</h2>
                        <p className="text-sm text-white/60">Agradecemos mucho tu apoyo y confianza en nosotros.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
