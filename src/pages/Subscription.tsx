import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RevenueCatService } from '../services/revenueCatService';
import type { PurchasesPackage } from '../services/revenueCatService';
import { useAuth } from '../contexts/AuthContext';
import {
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
    const { setIsPremium } = useAuth();
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [individualCycle, setIndividualCycle] = useState<'monthly' | 'annual'>('monthly');
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const monthlyPkg = packages.find(p => p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly' || p.identifier === 'redcarpet.premium.onemonths' || p.product.identifier === 'redcarpet.premium.onemonths');
    const annualPkg = packages.find(p => p.packageType === 'ANNUAL' || p.identifier === '$rc_annual' || p.identifier === 'redcarpet.premium.oneyear' || p.product.identifier === 'redcarpet.premium.oneyear');
    
    const displayMonthlyPrice = '12,99€';
    const displayAnnualPrice = '79,99€';

    const SHARED_FEATURES = [
        t('premium.features_list.ai_shield'),
        t('premium.features_list.safe_route'),
        t('premium.features_list.hd_video'),
        t('premium.features_list.cloud_recording'),
        t('premium.features_list.tactical_nav'),
        t('premium.features_list.ai_shield'),
        t('premium.features_list.fall_detection'),
        t('premium.features_list.priority_connection')
    ];

    useEffect(() => {
        const loadOfferings = async () => {
            console.log(`[RevenueCat] 🔄 Iniciando carga de offerings (useEffect)`);
            try {
                // Ensure initialization before fetching
                if (!RevenueCatService.isConfigured) {
                    console.log(`[RevenueCat] Configurando RevenueCat antes de obtener offerings...`);
                    await RevenueCatService.initialize();
                }
                const pkgs = await RevenueCatService.getOfferings();
                console.log(`[RevenueCat] 📦 Offerings cargados correctamente. Total de paquetes: ${pkgs.length}`);
                if (pkgs.length === 0) {
                     console.warn(`[RevenueCat] ⚠️ Advertencia: No se han encontrado paquetes. Intentando fallback directo a Apple...`);
                     const directProducts = await RevenueCatService.getProductsByIds(['redcarpet.premium.onemonths', 'redcarpet.premium.oneyear']);
                     if (directProducts.length > 0) {
                         console.log(`[RevenueCat] ✅ Fallback directo exitoso. Productos encontrados:`, directProducts.length);
                         const fallbackPkgs = directProducts.map((prod: any) => ({
                             identifier: prod.identifier,
                             packageType: prod.identifier.includes('oneyear') ? 'ANNUAL' : 'MONTHLY',
                             product: prod,
                             offeringIdentifier: 'default'
                         })) as PurchasesPackage[];
                         setPackages(fallbackPkgs);
                         return;
                     }
                }
                setPackages(pkgs);
            } catch (err) {
                console.error('[RevenueCat] ❌ Error loading offerings:', err);
                setError(t('common.error') + ': offerings_load_failed');
            }
        };
        loadOfferings();
    }, [t]);

    const handlePurchase = async (packageId: string) => {
        console.log(`[RevenueCat] 👉 Botón de compra pulsado para el paquete: ${packageId}`);
        setProcessing(true);
        setError(null);
        try {
            console.log(`[RevenueCat] Estado actual de paquetes cargados: ${packages.length}`);
            
            // Check configuration again
            if (!RevenueCatService.isConfigured) {
                console.log(`[RevenueCat] RevenueCat no estaba configurado. Inicializando...`);
                await RevenueCatService.initialize();
            }

            // Find real pkg by its package identifier or underlying product identifier
            const pkg = packages.find(p => p.identifier === packageId || p.product.identifier === packageId);

            let result;
            if (pkg && pkg.offeringIdentifier !== 'default') {
                console.log(`[RevenueCat] 🚀 Llamando a RevenueCatService.purchasePackage para: ${pkg.identifier}`);
                result = await RevenueCatService.purchasePackage(pkg);
            } else {
                console.log(`[RevenueCat] 🚀 Fallback directo: Llamando a purchaseProductById para: ${packageId}`);
                result = await RevenueCatService.purchaseProductById(packageId);
            }

            if (result) {
                console.log(`[RevenueCat] ✅ Compra completada exitosamente! CustomerInfo actualizado.`);
                setIsPremium(true);
                setShowSuccess(true);
            } else {
                console.log(`[RevenueCat] ⚠️ Compra devuelta como null (posible cancelación del usuario o error).`);
            }
        } catch (err: any) {
            console.error('[RevenueCat] ❌ Purchase error detail:', err);
            setError(err.message || t('common.error'));
        } finally {
            console.log(`[RevenueCat] 🏁 Proceso de compra finalizado. Restaurando estado del botón.`);
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

                <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-white drop-shadow-sm">{t('premium.success.title')}</h1>
                <p className="text-xl text-white/80 font-bold mb-12">{t('premium.success.now_you_are')}</p>

                <div className="space-y-4 mb-16 text-left w-full max-w-xs px-6">
                    {[
                        t('premium.success.step1'),
                        t('premium.success.step2'),
                        t('premium.success.step3'),
                        t('premium.success.step4'),
                        t('premium.success.step5'),
                        t('premium.success.step6')
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
                    className="w-full max-w-xs h-16 bg-white text-black rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    {t('premium.success.start')}
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
                <h1 className="text-5xl font-extrabold tracking-tight mb-2 animate-slide-up text-white drop-shadow-md">{t('nav.premium')}</h1>
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

                    <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">{t('premium.individual.title')}</h2>
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
                            {displayMonthlyPrice} ({t('common.month')})
                        </button>
                        <button
                            onClick={() => setIndividualCycle('annual')}
                            className={clsx(
                                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all outline-none",
                                individualCycle === 'annual' ? "bg-white text-black shadow-lg" : "text-white/40"
                            )}
                        >
                            {displayAnnualPrice} ({t('common.year')})
                        </button>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-black italic">{individualCycle === 'monthly' ? displayMonthlyPrice : displayAnnualPrice}</span>
                        <span className="text-white/30 text-[9px] font-bold uppercase">/ {individualCycle === 'monthly' ? t('common.month') : t('common.year')}</span>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 uppercase mb-8 italic">{t('premium.cancel_anytime')}</p>

                    <button
                        onClick={() => handlePurchase(individualCycle === 'monthly' ? (monthlyPkg?.identifier || 'redcarpet.premium.onemonths') : (annualPkg?.identifier || 'redcarpet.premium.oneyear'))}
                        disabled={processing}
                        className="w-full h-16 bg-white text-black rounded-2xl font-bold text-lg hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
                    >
                        {processing ? <Loader2 className="animate-spin" /> : t('premium.hire')}
                    </button>

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-shake">
                            <p className="text-red-500 text-[10px] font-black uppercase text-center leading-tight">
                                {error}
                            </p>
                        </div>
                    )}
                </div>



                {/* Grid Benefits Elite */}
                <div className="pt-10 space-y-4">
                    <h3 className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] px-2">{t('premium.tech_elite')}</h3>

                    {[
                        { icon: Video, title: t('premium.features_list.dual_stream'), desc: t('premium.feature_dual_stream_desc') },
                        { icon: Map, title: t('premium.feature_safe_route_title'), desc: t('premium.feature_safe_route_desc') },
                        { icon: Sparkles, title: t('premium.feature_predictive_ai_title'), desc: t('premium.feature_predictive_ai_desc') }
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

                {/* Subscription Terms */}
                <p className="text-[10px] text-white/50 text-center max-w-xs mx-auto mb-4">
                    {t('premium.legal.iap_disclaimer')}
                </p>

                {/* Footer Legal */}
                <div className="mt-12 flex flex-col items-center text-white/80 gap-6 pb-20">
                    <button
                        onClick={() => RevenueCatService.restorePurchases().then(() => navigate('/'))}
                        className="text-[9px] font-black uppercase tracking-[0.2em] underline underline-offset-8"
                    >
                        {t('premium.restore_purchases')}
                    </button>
                    <div className="flex gap-8">
                        <button onClick={() => navigate('/terms')} className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4">Terms of Use (EULA)</button>
                        <button onClick={() => navigate('/privacy')} className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4">Privacy Policy</button>
                    </div>
                </div>
            </div>
        </div>
    );
};