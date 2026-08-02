import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

import { useTranslation } from 'react-i18next';

export const EULA: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 pt-16 font-display overflow-y-auto no-scrollbar">
            <div className="max-w-xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-8 p-3 bg-white/5 rounded-2xl text-white/60 hover:text-white transition-all flex items-center gap-2 border border-white/5 active:scale-95"
                >
                    <ArrowLeft size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">{t('eula.back')}</span>
                </button>

                <div className="flex items-center gap-4 mb-8">
                    <div className="size-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-3xl">explore</span>
                    </div>
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none">{t('eula.title')}</h1>
                        <p className="text-primary font-bold text-[10px] uppercase tracking-widest mt-1">{t('eula.subtitle')}</p>
                    </div>
                </div>

                <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden text-zinc-300 leading-relaxed text-sm">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[80px] -z-10" />
                    
                    <section className="space-y-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight italic">{t('eula.disclaimer_title')}</h2>
                        <div className="space-y-4">
                            <p className="bg-primary/10 p-4 rounded-xl border border-primary/30 text-white font-bold italic">
                                {t('eula.disclaimer_quote')}
                            </p>
                            <p>
                                {t('eula.description_1')}
                            </p>
                            <p>
                                {t('eula.description_2')}
                            </p>
                            <p>
                                {t('eula.description_3')}
                            </p>
                        </div>
                    </section>

                    <div className="h-px w-full bg-white/10" />

                    <section className="space-y-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight italic">{t('eula.location_title')}</h2>
                        <p>
                            {t('eula.location_desc_1')}
                        </p>
                        <p>
                            {t('eula.location_desc_2')}
                        </p>
                    </section>

                    <div className="h-px w-full bg-white/10" />

                    <section className="space-y-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight italic">{t('eula.privacy_title')}</h2>
                        <p>
                            {t('eula.privacy_desc')}
                        </p>
                    </section>

                    <div className="pt-4">
                        <p className="text-[10px] text-white/20 uppercase font-bold tracking-[0.2em] italic">
                            {t('eula.last_update')}: {new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div className="mt-8 pb-12">
                     <button
                        onClick={() => navigate(-1)}
                        className="w-full py-5 rounded-[2rem] bg-white text-black font-black text-xl italic uppercase tracking-tighter shadow-2xl active:scale-95 transition-all"
                    >
                        {t('eula.accept')}
                    </button>
                </div>
            </div>
        </div>
    );
};
