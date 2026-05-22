import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Heart, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Feedback: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [rating, setRating] = useState<number>(0);
    const [comment, setComment] = useState<string>('');
    const [submitted, setSubmitted] = useState<boolean>(false);
    const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

    const currentLang = i18n.language?.split('-')[0] || 'es';

    const redirectingText: Record<string, string> = {
        es: 'Redirigiéndote a la App Store...',
        ca: 'Redirigint-te a l\'App Store...',
        en: 'Redirecting you to the App Store...',
        fr: 'Redirection vers l\'App Store...',
        pt: 'Redirecionando para a App Store...',
        de: 'Weiterleitung zum App Store...',
        it: 'Reindirizzamento all\'App Store...'
    };

    const handleStarClick = async (stars: number) => {
        setRating(stars);
        if (stars >= 4) {
            setIsRedirecting(true);
            setTimeout(async () => {
                const { Capacitor } = await import('@capacitor/core');
                const storeUrl = 'https://apps.apple.com/es/app/redcarpet/id6755689618?action=write-review';
                
                try {
                    window.open(storeUrl, '_system');
                } catch (e) {
                    window.open(storeUrl, '_blank');
                }
                // Go back to settings
                navigate('/settings', { replace: true });
            }, 1800);
        }
    };

    const handleSubmit = () => {
        if (rating === 0) return;
        setSubmitted(true);
        setTimeout(() => {
            navigate('/settings', { replace: true });
        }, 2200);
    };

    if (isRedirecting) {
        return (
            <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white items-center justify-center p-8 text-center animate-fade-in relative overflow-hidden">
                {/* Ambient background glows */}
                <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#FF3131]/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-64 h-64 bg-[#10B981]/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="relative z-10 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl shadow-2xl max-w-sm w-full space-y-6 flex flex-col items-center">
                    <div className="relative">
                        <div className="size-20 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                            <Star size={36} fill="#10B981" className="animate-pulse" />
                        </div>
                        {/* Glow ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-[#10B981]/40 animate-ping opacity-75" />
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                            {rating === 5 ? '¡Excelente!' : '¡Muchas Gracias!'}
                        </h2>
                        <p className="text-white/60 text-sm">
                            {redirectingText[currentLang] || redirectingText.es}
                        </p>
                    </div>

                    {/* Progress Loader Bar */}
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#FF3131] to-[#10B981] rounded-full" style={{ animation: 'load 1.8s linear forwards' }} />
                    </div>
                </div>

                <style>{`
                    @keyframes load {
                        0% { width: 0%; }
                        100% { width: 100%; }
                    }
                `}</style>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white items-center justify-center p-8 text-center animate-fade-in relative overflow-hidden">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#10B981]/10 rounded-full blur-[120px] pointer-events-none" />
                
                <div className="relative z-10 max-w-sm w-full space-y-6 flex flex-col items-center">
                    <div className="size-20 rounded-full bg-[#10B981]/25 text-[#10B981] flex items-center justify-center shadow-lg shadow-[#10B981]/10">
                        <Heart size={36} fill="currentColor" className="animate-bounce" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black uppercase italic tracking-tighter">{t('feedback.thanks')}</h1>
                        <p className="text-white/40 text-sm">{t('feedback.thanks_desc')}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in relative">
            {/* Ambient Background Blur */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF3131]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#10B981]/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-4 px-6 pt-12 pb-6 relative z-10">
                <button 
                    onClick={() => navigate(-1)} 
                    className="p-2 -ml-2 text-white/40 hover:text-white transition-all duration-250 hover:bg-white/5 rounded-xl active:scale-90"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-black uppercase italic tracking-tighter">{t('feedback.title')}</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar relative z-10">
                {/* Rating Card */}
                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md space-y-4 shadow-xl">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">{t('feedback.rate_experience')}</h2>
                    <div className="flex justify-between max-w-md mx-auto pt-2">
                        {[1, 2, 3, 4, 5].map((s) => {
                            const isActive = rating >= s;
                            return (
                                <button 
                                    key={s}
                                    onClick={() => handleStarClick(s)}
                                    className={`size-12 rounded-2xl flex items-center justify-center transition-all duration-300 relative group active:scale-90 ${
                                        isActive 
                                            ? 'bg-gradient-to-br from-[#FF3131] to-[#FF5E5E] text-white shadow-lg shadow-[#FF3131]/20' 
                                            : 'bg-white/5 text-white/20 border border-white/5 hover:border-white/20 hover:text-white/40'
                                    }`}
                                >
                                    <Star size={24} fill={isActive ? 'currentColor' : 'none'} className={isActive ? 'scale-110 rotate-[360deg] transition-transform duration-500' : 'transition-transform duration-300 group-hover:scale-110'} />
                                    {isActive && (
                                        <span className="absolute -inset-1 rounded-2xl bg-[#FF3131]/25 blur-sm -z-10 animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Conditional Textarea for low ratings (1-3 stars) */}
                {rating > 0 && rating <= 3 && (
                    <div className="space-y-4 animate-slide-up duration-300">
                        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md space-y-4 shadow-xl">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">{t('feedback.how_to_improve')}</h2>
                            <textarea 
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t('feedback.placeholder')}
                                className="w-full h-36 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131]/30 transition-all duration-300 resize-none placeholder-white/20"
                            />
                            
                            <button 
                                onClick={handleSubmit}
                                disabled={comment.trim().length === 0}
                                className="w-full py-4 bg-white text-black font-black text-base rounded-2xl shadow-xl shadow-white/5 active:scale-95 hover:bg-white/90 disabled:opacity-20 disabled:scale-100 disabled:hover:bg-white transition-all duration-300 uppercase italic tracking-tighter flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                {t('feedback.send')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
