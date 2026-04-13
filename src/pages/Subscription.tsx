import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RevenueCatService } from '../services/revenueCatService';
import type { PurchasesPackage } from '../services/revenueCatService';
import { useAuth } from '../contexts/AuthContext';
import { 
    ShieldCheck, 
    ShieldAlert, 
    Crown,
    Check,
    Video,
    Map,
    Users,
    Loader2,
    Sparkles,
    CheckCircle2,
    ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';

export const Subscription: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { isPremium, setIsPremium } = useAuth();
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [individualCycle, setIndividualCycle] = useState<'monthly' | 'annual'>('monthly');
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const SHARED_FEATURES = [
        "Escudo de IA Personal",
        "SOS con Vídeo HD 1080p",
        "Grabación en la Nube",
        "Navegación Táctica Segura",
        "Detección de Caída/Choque",
        "Conexión Prioritaria"
    ];

    useEffect(() => {
        const loadOfferings = async () => {
            try {
                const pkgs = await RevenueCatService.getOfferings();
                setPackages(pkgs);
            } catch (err) {
                console.error('Error loading offerings:', err);
                setError('No se pudieron cargar los planes.');
            }
        };
        loadOfferings();
    }, []);

    const handlePurchase = async (packageId: string) => {
        setProcessing(true);
        setError(null);
        try {
            // Find real pkg or mock it
            const pkg = packages.find(p => p.identifier === packageId);
            
            // Simulation for better UI experience
            await new Promise(r => setTimeout(r, 1200));

            const result = pkg ? await RevenueCatService.purchasePackage(pkg) : true; // Mock success if not found
            
            if (result) {
                setIsPremium(true);
                setShowSuccess(true);
            } else {
                setError('La compra no se pudo completar.');
            }
        } catch (err: any) {
            setError(err.message || 'Error en la suscripción');
        } finally {
            setProcessing(false);
        }
    };

    // Post-payment success screen
    if (showSuccess) {
        return (
            <div className="flex flex-col h-full w-full bg-black text-white items-center justify-center p-8 text-center font-display relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10" />
                
                <div 
                    className="size-32 rounded-[3.5rem] bg-primary/20 flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(255,49,49,0.4)] border border-primary/30 animate-scale-in"
                >
                    <CheckCircle2 size={72} className="text-primary" />
                </div>
                
                <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-4">Felicidades.</h1>
                <p className="text-xl text-white/80 font-bold mb-12">Ahora eres:</p>
                
                <div className="space-y-4 mb-16 text-left w-full max-w-xs px-6">
                    {[
                        '• Más seguro.',
                        '• Más inteligente.',
                        '• Más protegido.',
                        '• Más preparado.',
                        '• Más tranquilo.',
                        '• Más Red Carpet.'
                    ].map((step, i) => (
                        <p 
                            key={i} 
                            className="text-lg font-black italic tracking-tight animate-fade-in"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            {step}
                        </p>
                    ))}
                </div>
                
                <button
                    onClick={() => navigate('/')}
                    className="w-full max-w-xs h-16 bg-white text-black rounded-2xl font-black text-xl uppercase tracking-tighter italic shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    COMENZAR EXPERIENCIA
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display relative animate-fade-in">
            
            {/* Background Elite Gradient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-10" />

            {/* Header */}
            <div className="relative flex flex-col items-center p-8 pt-16 shrink-0 z-10 text-center">
                <button 
                    onClick={() => navigate(-1)} 
                    className="absolute left-6 top-16 size-12 flex items-center justify-center text-white/60 hover:text-white bg-white/5 rounded-2xl backdrop-blur-2xl border border-white/10 transition-all active:scale-90 shadow-xl"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-2 animate-slide-up">{t('nav.premium')}</h1>
                <p className="text-sm font-bold text-primary max-w-[200px] leading-tight uppercase tracking-tight animate-fade-in" style={{ animationDelay: '200ms' }}>
                    {t('premium.main_subtitle')}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pb-24 px-6 no-scrollbar z-10 space-y-6">
                
                {/* 3. Premium Individual */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[3rem] p-8 relative overflow-hidden group animate-slide-up" style={{ animationDelay: '300ms' }}>
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Crown size={24} />
                    </div>
                    
                    <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-2">{t('premium.individual.title')}</h2>
                    <p className="text-primary text-[11px] font-black uppercase tracking-widest mb-8">{t('premium.individual.subtitle')}</p>

                    <div className="space-y-4 mb-10">
                        {SHARED_FEATURES.map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Check size={14} className="text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-tight text-white/70">{f}</span>
                            </div>
                        ))}
                    </div>

                    {/* Selector de Pago Toggle */}
                    <div className="bg-black/40 p-1.5 rounded-2xl border border-white/5 mb-8 flex items-center">
                        <button 
                            onClick={() => setIndividualCycle('monthly')}
                            className={clsx(
                                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all outline-none",
                                individualCycle === 'monthly' ? "bg-white text-black shadow-lg" : "text-white/40"
                            )}
                        >
                            9,99€ (Mensual)
                        </button>
                        <button 
                            onClick={() => setIndividualCycle('annual')}
                            className={clsx(
                                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all outline-none",
                                individualCycle === 'annual' ? "bg-white text-black shadow-lg" : "text-white/40"
                            )}
                        >
                            89,99€ (Anual)
                        </button>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-black italic">{individualCycle === 'monthly' ? '9,99€' : '89,99€'}</span>
                        <span className="text-white/30 text-[9px] font-bold uppercase">/ {individualCycle === 'monthly' ? 'Mes' : 'Año'}</span>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 uppercase mb-8 italic">{t('premium.cancel_anytime')}</p>

                    <button 
                        onClick={() => handlePurchase(individualCycle === 'monthly' ? 'rc_individual_monthly' : 'rc_individual_annual')}
                        disabled={processing}
                        className="w-full h-16 bg-white text-black rounded-2xl font-black text-xl uppercase tracking-tighter italic hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center"
                    >
                        {processing ? <Loader2 className="animate-spin" /> : t('premium.hire')}
                    </button>
                </div>

                {/* 4. Plan Estudiantes */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-[3rem] p-8 animate-slide-up" style={{ animationDelay: '400ms' }}>
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-2">{t('premium.student.title')}</h2>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-6">{t('premium.student.subtitle')}</p>
                    
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl mb-6 flex flex-col gap-1">
                        <p className="text-[9px] font-black text-primary uppercase tracking-tight text-center">
                            {t('premium.includes_all_individual')}
                        </p>
                        <p className="text-[9px] font-black text-primary uppercase tracking-tight text-center">
                            {t('premium.student_discount')}
                        </p>
                    </div>

                    <div className="space-y-3 mb-8 opacity-60">
                        {SHARED_FEATURES.map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Check size={12} className="text-primary" />
                                <span className="text-[9px] font-black uppercase tracking-tight">{f}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-black italic">4,99€</span>
                        <span className="text-white/30 text-[9px] font-bold uppercase">/ Mes</span>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 uppercase mb-6 italic">{t('premium.cancel_anytime')}</p>

                    <button 
                        onClick={() => handlePurchase('rc_student')}
                        className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-700 transition-all"
                    >
                        {t('premium.verify')}
                    </button>
                </div>

                {/* 5. Pase 72 Horas */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-[3rem] p-8 animate-slide-up" style={{ animationDelay: '500ms' }}>
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-1">{t('premium.72h.title')}</h2>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-2">{t('premium.72h.subtitle')}</p>
                    <p className="text-white/50 text-[10px] font-bold uppercase leading-none mb-6 italic">{t('premium.72h.promo')}</p>
                    
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl mb-6">
                        <p className="text-[9px] font-black text-primary uppercase tracking-tight text-center">
                            {t('premium.includes_all_individual')}
                        </p>
                    </div>

                    <div className="space-y-3 mb-8 opacity-60">
                        {SHARED_FEATURES.map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Check size={12} className="text-primary" />
                                <span className="text-[9px] font-black uppercase tracking-tight">{f}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-black italic">2,99€</span>
                        <span className="text-white/30 text-[9px] font-bold uppercase">/ Pago único</span>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 uppercase mb-6 italic">{t('premium.cancel_anytime')}</p>

                    <button 
                        onClick={() => handlePurchase('rc_72h')}
                        className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                        {t('premium.activate')}
                    </button>
                </div>

                {/* 6. Plan Familiar */}
                <div className="bg-gradient-to-br from-zinc-900 to-primary/10 border border-white/10 rounded-[3rem] p-8 overflow-hidden relative animate-slide-up" style={{ animationDelay: '600ms' }}>
                    <div className="absolute top-0 right-0 p-6 flex flex-col items-end">
                         <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">PRO</span>
                    </div>

                    <div className="flex items-baseline gap-3 mb-1">
                        <h2 className="text-3xl font-black uppercase tracking-tighter italic">{t('premium.family.title')}</h2>
                        <span className="text-[9px] font-medium text-white/40 max-w-[100px] leading-tight">{t('premium.family.subtitle')}</span>
                    </div>
                    
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-8">
                        La seguridad de tus seres queridos y la tuya sí importa.
                    </p>

                    <div className="grid grid-cols-1 gap-3 mb-8">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                            <Users size={20} className="text-primary" />
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase">Hasta 6 Miembros</p>
                                <p className="text-[8px] text-white/30 font-bold uppercase">Ubicación y Alertas compartidas</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                            <Map size={20} className="text-primary" />
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase">Geocercas Ilimitadas</p>
                                <p className="text-[8px] text-white/30 font-bold uppercase">Enterate cuando lleguen a salvo</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-5xl font-black italic">14,99€</span>
                        <span className="text-white/30 text-[10px] font-bold uppercase">/ Mes</span>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 uppercase mb-8 italic">{t('premium.cancel_anytime')}</p>

                    <button 
                        onClick={() => handlePurchase('rc_family')}
                        className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xl uppercase tracking-tighter italic shadow-xl shadow-primary/30"
                    >
                        {t('premium.protect_family')}
                    </button>
                </div>

                {/* Grid Benefits Elite */}
                <div className="pt-10 space-y-4">
                    <h3 className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] px-2">Tecnología de Élite Included</h3>
                    
                    {[
                        { icon: Video, title: 'Streaming Dual', desc: 'Sincronización de cámaras en ultra HD.' },
                        { icon: Map, title: 'SafeRoute Táctico', desc: 'Análisis de riesgo en tiempo real.' },
                        { icon: Sparkles, title: 'IA Predictiva', desc: 'Detección proactiva de peligros.' }
                    ].map((f, i) => (
                        <div key={i} className="flex items-center gap-5 p-5 rounded-[2rem] bg-white/5 border border-white/5 animate-fade-in" style={{ animationDelay: `${700 + i * 100}ms` }}>
                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <f.icon size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-black text-sm uppercase italic">{f.title}</h4>
                                <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider">{f.desc}</p>
                            </div>
                            <Check size={16} className="text-white/20" />
                        </div>
                    ))}
                </div>

                {/* Footer Legal */}
                <div className="mt-12 flex flex-col items-center opacity-30 gap-6 pb-20">
                    <button 
                        onClick={() => RevenueCatService.restorePurchases().then(() => navigate('/'))}
                        className="text-[9px] font-black uppercase tracking-[0.2em] underline underline-offset-8"
                    >
                        {t('premium.restore_purchases')}
                    </button>
                    <div className="flex gap-10">
                        <button onClick={() => navigate('/terms')} className="text-[8px] font-black uppercase tracking-widest underline underline-offset-4">{t('settings.items.terms_of_use')}</button>
                        <button onClick={() => navigate('/privacy')} className="text-[8px] font-black uppercase tracking-widest underline underline-offset-4">{t('settings.items.privacy_policy')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
