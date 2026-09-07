import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RevenueCatService } from '../services/revenueCatService';
import type { PurchasesPackage } from '../services/revenueCatService';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
    Globe,
    Crown,
    Check,
    Loader2,
    Sparkles,
    CheckCircle2,
    X,
    Shield,
    Eye,
    Cloud,
    Mic,
    Sun,
    Heart,
    Users,
    Clock,
    Star,
    ChevronRight,
    RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
// Alert system imports
import AlertModal from '../components/Alert/AlertModal';
import { startAlert } from '../services/AlertService';
import { requestAlertPermissions } from '../utils/Permissions';
import { TrustedContactsService } from '../services/trustedContactsService';

export const Subscription: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, setIsPremium, isPremium } = useAuth();
    const isAndroid = Capacitor.getPlatform() === 'android';
    const isIOS = Capacitor.getPlatform() === 'ios';

    // ---- Gestión de suscripción (solo si ya es premium) ----
    const [subInfo, setSubInfo] = useState<{ plan_id: string; expires_at: string | null; granted: boolean } | null>(null);
    const [hasFamily, setHasFamily] = useState(false);

    useEffect(() => {
        if (!isPremium || !user) return;
        (async () => {
            const { supabase } = await import('../services/supabaseClient');
            const { data } = await supabase
                .from('subscriptions')
                .select('plan_id, expires_at, granted_by')
                .eq('user_id', user.id).eq('status', 'active')
                .order('expires_at', { ascending: false }).limit(1).maybeSingle();
            if (data) setSubInfo({ plan_id: data.plan_id, expires_at: data.expires_at, granted: !!data.granted_by });
            const { data: fam } = await supabase.rpc('has_active_family_plan', { p_uid: user.id });
            setHasFamily(!!fam);
        })();
    }, [isPremium, user]);

    const planLabel = (id?: string) => {
        const p = (id || '').toLowerCase();
        if (p === 'family_member') return t('mgmt.plan_family_member');
        if (p === 'family' || p.includes('familiar') || p.includes('premium.family')) return t('mgmt.plan_family');
        if (p.includes('anual') || p.includes('annual') || p.includes('1y')) return t('mgmt.plan_annual');
        if (p.includes('72h')) return t('mgmt.plan_72h');
        return t('mgmt.plan_monthly');
    };

    // La cancelación / gestión real vive en la tienda (Apple/Google no permiten
    // cancelar dentro de la app). Deep-link a la gestión de suscripciones.
    const openStoreSubscriptions = async () => {
        const url = isAndroid
            ? 'https://play.google.com/store/account/subscriptions'
            : isIOS
                ? 'https://apps.apple.com/account/subscriptions'
                : 'https://tryredcarpet.com/account';
        await Browser.open({ url });
    };

    const openWebPaywall = async (planId: string = 'monthly') => {
        if (!user) return;
        // POST a create-checkout para obtener la URL de Stripe y abrirla en browser
        try {
            const r = await fetch('https://tryredcarpet.com/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, planId })
            });
            const data = await r.json();
            if (data.url) {
                await Browser.open({ url: data.url });
                // Cuando el usuario vuelve a la app, comprobar si pagó
                import('@capacitor/app').then(({ App }) => {
                    const listener = App.addListener('appStateChange', async ({ isActive }) => {
                        if (isActive) {
                            listener.then(l => l.remove());
                            // Esperar un poco para que el webhook actualice Supabase
                            await new Promise(r => setTimeout(r, 2000));
                            const { supabase } = await import('../services/supabaseClient');
                            const { data: sub } = await supabase
                                .from('subscriptions').select('id')
                                .eq('user_id', user.id).eq('status', 'active')
                                .gt('expires_at', new Date().toISOString()).maybeSingle();
                            if (sub) { setIsPremium(true); setShowSuccess(true); }
                        }
                    });
                });
            } else {
                // Fallback: abrir directamente la web del paywall con user_id + plan
                await Browser.open({ url: `https://tryredcarpet.com/premium?uid=${user.id}&plan=${planId}` });
            }
        } catch {
            await Browser.open({ url: `https://tryredcarpet.com/premium?uid=${user.id}&plan=${planId}` });
        }
    };

    const verifyWebPurchase = async () => {
        if (!user) return;
        setProcessing(true);
        const { supabase } = await import('../services/supabaseClient');
        const { data } = await supabase
            .from('subscriptions').select('id')
            .eq('user_id', user.id).eq('status', 'active')
            .gt('expires_at', new Date().toISOString()).maybeSingle();
        if (data) { setIsPremium(true); setShowSuccess(true); }
        else setError(t('sub.err_no_active'));
        setProcessing(false);
    };

    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<string>('monthly');
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    // Alert state
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertType, setAlertType] = useState<string>('emergency');
    const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const pass72hPkg = packages.find(p => p.identifier === 'rc_72h_pass' || p.product.identifier === 'rc_72h_pass');
    const monthlyPkg = packages.find(p => p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly' || p.identifier === 'mes_premium' || p.product.identifier === 'mes_premium');
    const annualPkg = packages.find(p => p.packageType === 'ANNUAL' || p.identifier === '$rc_annual' || p.identifier === 'rc_premium_anual_1y' || p.product.identifier === 'rc_premium_anual_1y');
    const family1Pkg = packages.find(p => p.identifier === 'rc_familiar_1p_1m' || p.product.identifier === 'rc_familiar_1p_1m');
    const family2Pkg = packages.find(p => p.identifier === 'rc_familiar_2p_1m' || p.product.identifier === 'rc_familiar_2p_1m');
    const family6Pkg = packages.find(p => p.identifier === 'rc_familiar_6p_1m' || p.product.identifier === 'rc_familiar_6p_1m');
    
    useEffect(() => {
        const loadOfferings = async () => {
            console.log(`[RevenueCat] 🔄 Iniciando carga de offerings (useEffect)`);
            try {
                if (!RevenueCatService.isConfigured) {
                    console.log(`[RevenueCat] Configurando RevenueCat antes de obtener offerings...`);
                    await RevenueCatService.initialize();
                }
                const pkgs = await RevenueCatService.getOfferings();
                console.log(`[RevenueCat] 📦 Offerings cargados correctamente. Total de paquetes: ${pkgs.length}`);
                if (pkgs.length === 0) {
                     console.warn(`[RevenueCat] ⚠️ Advertencia: No se han encontrado paquetes. Intentando fallback directo a Apple...`);
                     const directProducts = await RevenueCatService.getProductsByIds(['mes_premium', 'rc_premium_anual_1y']);
                     if (directProducts.length > 0) {
                          console.log(`[RevenueCat] ✅ Fallback directo exitoso. Productos encontrados:`, directProducts.length);
                          const fallbackPkgs = directProducts.map((prod: any) => ({
                              identifier: prod.identifier,
                              packageType: (prod.identifier.includes('anual') || prod.identifier.includes('1y') || prod.identifier.includes('annual')) ? 'ANNUAL' : 'MONTHLY',
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

    const handlePurchase = async (planKey: string, packageId: string) => {
        // Android: sin compra in-app (Google Play Billing). Se redirige al pago web
        // con el user_id + plan; el backend habilita el premium correspondiente y al
        // volver a la app el listener de openWebPaywall refresca el estado. iOS sigue
        // usando RevenueCat (Apple exige compra in-app).
        if (isAndroid) {
            setSelectedPlan(planKey);
            await openWebPaywall(planKey);
            return;
        }
        console.log(`[RevenueCat] 👉 Botón de compra pulsado para el paquete: ${packageId} (${planKey})`);
        setSelectedPlan(planKey);
        setProcessing(true);
        setError(null);
        try {
            if (!RevenueCatService.isConfigured) {
                console.log(`[RevenueCat] RevenueCat no estaba configurado. Inicializando...`);
                await RevenueCatService.initialize();
            }

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
                console.log(`[RevenueCat] ⚠️ Compra devuelta como null (posible cancelación del usuario).`);
            }
        } catch (err: any) {
            console.error('[RevenueCat] ❌ Purchase error detail:', err);
            setError(err.message || t('common.error'));
        } finally {
            setProcessing(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="flex flex-col h-full w-full bg-black text-white items-center justify-center p-8 text-center font-display relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10" />
                <div className="size-32 rounded-[3.5rem] bg-primary/20 flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(255,49,49,0.4)] border border-primary/30 animate-scale-in">
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
                {/* Si el plan es familiar, permite repartir premium a la familia */}
                {selectedPlan?.toLowerCase().includes('famil') && (
                    <button
                        onClick={() => navigate('/family-plan')}
                        className="w-full max-w-xs h-14 mt-3 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
                    >
                        {t('familyplan.manage')}
                    </button>
                )}
            </div>
        );
    }

    // ============ PANEL DE GESTIÓN (usuario ya premium) ============
    if (isPremium && !showSuccess) {
        const isGranted = subInfo?.granted;
        const renewDate = subInfo?.expires_at
            ? new Date(subInfo.expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
            : null;

        const benefits = [
            { icon: Sparkles, label: t('sub.f_routes_unlimited') },
            { icon: Shield, label: t('sub.f_sos') },
            { icon: Eye, label: t('sub.f_smart_alerts') },
            { icon: Cloud, label: t('sub.coverage_spain') },
            { icon: Heart, label: t('sub.f_priority') },
            { icon: Users, label: t('mgmt.plan_family') },
        ];

        return (
            <div className="flex flex-col h-full w-full bg-[#080808] text-white overflow-hidden font-display relative animate-fade-in">
                {/* Glows premium */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-primary/20 rounded-full blur-[150px] -z-10" />
                <div className="absolute -top-10 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-[120px] -z-10" />

                <div className="flex-1 overflow-y-auto no-scrollbar pb-16">
                    {/* HERO celebratorio */}
                    <div className="relative flex flex-col items-center px-6 pt-16 pb-8 text-center">
                        <button
                            onClick={() => navigate('/')}
                            className="absolute right-6 top-16 size-11 flex items-center justify-center text-white/50 hover:text-white bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"
                            aria-label={t('sub.close')}
                        >
                            <X size={22} />
                        </button>

                        <div className="relative mb-5">
                            <div className="size-24 rounded-[2rem] bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-[0_0_60px_rgba(255,49,49,0.45)] animate-scale-in">
                                <Crown size={48} className="text-white drop-shadow-lg" />
                            </div>
                            <div className="absolute -inset-2 rounded-[2.5rem] border-2 border-primary/30 animate-ping opacity-40" />
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 mb-3">
                            <Star size={12} className="text-primary" fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('mgmt.badge')}</span>
                        </div>

                        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-tight">
                            {t('mgmt.hero')}
                        </h1>
                        <p className="text-sm text-white/50 font-semibold mt-2 max-w-[280px]">
                            {t('mgmt.thanks')}
                        </p>
                    </div>

                    {/* Tarjeta plan + renovación */}
                    <div className="px-6">
                        <div className="rounded-[1.75rem] bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-primary/20 p-5 shadow-2xl shadow-primary/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t('mgmt.plan')}</p>
                                    <p className="text-lg font-black italic uppercase tracking-tight text-white mt-0.5">{planLabel(subInfo?.plan_id)}</p>
                                </div>
                                <div className="size-11 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/25">
                                    <Crown size={22} className="text-primary" />
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                                <Clock size={14} className="text-white/40" />
                                <p className="text-xs font-semibold text-white/60">
                                    {isGranted
                                        ? t('mgmt.plan_family_member')
                                        : renewDate
                                            ? `${t('mgmt.renews')} ${renewDate}`
                                            : t('mgmt.no_expiry')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Beneficios desbloqueados */}
                    <div className="px-6 mt-8">
                        <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">{t('mgmt.benefits')}</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                            {benefits.map((b, i) => (
                                <div key={i} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-3">
                                    <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                        <b.icon size={16} />
                                    </div>
                                    <span className="text-[11px] font-bold text-white/80 leading-tight">{b.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Acciones principales (visibles y atractivas) */}
                    <div className="px-6 mt-8 space-y-3">
                        {hasFamily && (
                            <button
                                onClick={() => navigate('/family-plan')}
                                className="w-full flex items-center gap-3 bg-primary hover:bg-primary/90 text-white rounded-2xl px-5 h-14 font-black uppercase tracking-widest text-xs active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                            >
                                <Users size={18} />
                                <span className="flex-1 text-left">{t('mgmt.manage_family')}</span>
                                <ChevronRight size={18} />
                            </button>
                        )}

                        <button
                            onClick={() => RevenueCatService.restorePurchases().then(() => navigate('/'))}
                            className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl px-5 h-14 font-black uppercase tracking-widest text-xs active:scale-[0.98] transition-all"
                        >
                            <RotateCcw size={18} className="text-white/70" />
                            <span className="flex-1 text-left">{t('premium.restore_purchases')}</span>
                            <ChevronRight size={18} className="text-white/40" />
                        </button>

                        {!isGranted && (
                            <button
                                onClick={openStoreSubscriptions}
                                className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl px-5 h-14 font-black uppercase tracking-widest text-xs active:scale-[0.98] transition-all"
                            >
                                <Crown size={18} className="text-white/70" />
                                <span className="flex-1 text-left">{t('mgmt.manage_store')}</span>
                                <ChevronRight size={18} className="text-white/40" />
                            </button>
                        )}
                    </div>

                    {/* Nota para miembros de plan familiar */}
                    {isGranted && (
                        <p className="px-8 mt-6 text-center text-[11px] text-white/40 font-medium leading-relaxed">
                            {t('mgmt.granted_note')}
                        </p>
                    )}

                    {/* Legales discretos */}
                    <div className="flex flex-wrap justify-center gap-3 px-6 mt-8">
                        <button onClick={() => navigate('/privacy')} className="text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white/60 underline underline-offset-4">Privacy</button>
                        <button onClick={() => navigate('/eula')} className="text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white/60 underline underline-offset-4">EULA</button>
                    </div>

                    {/* ⬇️ EL BOTÓN MENOS VISIBLE DE TODOS: cancelar suscripción.
                        Solo si es titular (los miembros de plan familiar no cancelan). */}
                    {!isGranted && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={openStoreSubscriptions}
                                className="text-[10px] font-medium text-white/15 hover:text-white/35 transition-colors tracking-wide"
                            >
                                {t('mgmt.cancel')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#080808] text-white overflow-hidden font-display relative animate-fade-in">
            {/* Background Elite Gradient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-10" />

            {/* Header */}
            <div className="relative flex flex-col items-center p-8 pt-16 shrink-0 z-10 text-center">
                {/* Prominent Dismiss Button "X" */}
                <button
                    onClick={() => navigate('/')}
                    className="absolute right-6 top-16 size-12 flex items-center justify-center text-white/60 hover:text-white bg-white/5 rounded-2xl backdrop-blur-2xl border border-white/10 transition-all active:scale-90 shadow-xl"
                    aria-label={t('sub.close')}
                    id="premium-dismiss-button"
                >
                    <X size={24} />
                </button>
                <div className="size-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary mb-4 border border-primary/25 shadow-lg shadow-primary/10">
                    <Crown size={28} />
                </div>
                <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-1 text-white drop-shadow-md">
                    REDCARPET <span className="text-primary font-black italic">PRO</span>
                </h1>
                <p className="text-xs font-bold text-white/40 max-w-[280px] leading-relaxed uppercase tracking-widest mt-1">
                    {t('premium.main_subtitle')}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pb-24 px-6 no-scrollbar z-10 space-y-8 animate-fade-in">
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-shake">
                        <p className="text-red-500 text-[10px] font-black uppercase text-center leading-tight">
                            {error}
                        </p>
                    </div>
                )}

                {/* 1. PREMIUM INDIVIDUAL */}
                <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950 border-2 border-primary/30 rounded-[2rem] p-6 relative overflow-hidden shadow-2xl shadow-primary/5 space-y-5">
                    <div className="absolute -top-12 -right-12 size-36 bg-primary/20 rounded-full blur-2xl" />
                    
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Crown size={24} className="text-primary" />
                            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{t('premium.individual.title')}</h2>
                        </div>
                        <h3 className="text-lg font-black italic text-primary">{t('premium.individual.subtitle')}</h3>
                        <p className="text-sm font-bold text-white/80 mt-1">{t('premium.tech_elite')}</p>
                        <p className="text-xs text-white/60 leading-relaxed font-medium mt-2">
                            {t('premium.features_list.ai_shield')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">{t('sub.includes')}</h4>
                        {[
                            t('sub.f_routes_unlimited'),
                            t('sub.coverage_spain'),
                            t('sub.f_priority'),
                            t('sub.f_sos'),
                            t('sub.f_smart_alerts'),
                            t('sub.f_risk'),
                            t('sub.f_premium_all')
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Check size={14} className="text-primary shrink-0 mt-0.5" />
                                <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">{t('sub.options')}</h4>
                        
                        {/* Option: Individual */}
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h5 className="font-black italic uppercase text-sm">{t('premium.individual.title')}</h5>
                                    <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">{t('premium.cancel_anytime')}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-primary">{monthlyPkg?.product?.priceString ?? '9,99 €'}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">{t('i18nfix.per_month')}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePurchase('monthly', monthlyPkg?.identifier || 'mes_premium')}
                                disabled={processing}
                                className="w-full h-10 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2"
                            >
                                {processing && selectedPlan === 'monthly' ? <Loader2 className="animate-spin size-3" /> : t('sub.choose_individual')}
                            </button>
                        </div>



                        {/* Option: Anual */}
                        <div className="bg-primary/10 rounded-2xl p-4 border border-primary/40 flex flex-col gap-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-primary text-black text-[8px] font-black px-2 py-1 uppercase tracking-widest rounded-bl-lg">{t('sub.most_popular')}</div>
                            <div className="flex justify-between items-start pt-2">
                                <div>
                                    <h5 className="font-black italic uppercase text-sm text-primary">{t('sub.annual')}</h5>
                                    <p className="text-[10px] text-white/60 uppercase tracking-wide mt-1 leading-snug">{t('premium.cancel_anytime')}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-xl text-primary">{annualPkg?.product?.priceString ?? '79,99 €'}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">{t('i18nfix.per_year')}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePurchase('annual', annualPkg?.identifier || 'rc_premium_anual_1y')}
                                disabled={processing}
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            >
                                {processing && selectedPlan === 'annual' ? <Loader2 className="animate-spin size-4" /> : t('sub.choose_annual')}
                            </button>
                        </div>
                    </div>
                    
                    <p className="text-center text-primary/80 font-bold italic text-xs mt-4">
                        {t('i18nfix.tagline_individual')}
                    </p>
                </div>

                {/* 2. PLAN FAMILIAR */}
                <div className="bg-gradient-to-b from-zinc-900/80 to-zinc-900/30 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 relative overflow-hidden shadow-xl space-y-5">
                    <div className="absolute -top-12 -right-12 size-36 bg-green-500/5 rounded-full blur-2xl" />
                    
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Users size={24} className="text-green-400" />
                            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{t('premium.family.title')}</h2>
                        </div>
                        <h3 className="text-lg font-black italic text-green-400">{t('premium.family.subtitle')}</h3>
                        <p className="text-sm font-bold text-white/80 mt-1">{t('premium.family.members')}</p>
                        <p className="text-xs text-white/60 leading-relaxed font-medium mt-2">
                            {t('premium.family.members_desc')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">{t('sub.includes')}</h4>
                        {[
                            t('sub.f_all_for_all'),
                            t('sub.f_shared_routes'),
                            t('sub.coverage_spain'),
                            t('sub.f_arrival'),
                            t('sub.f_tracking'),
                            t('sub.f_protect'),
                            t('sub.f_premium_group')
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Check size={14} className="text-green-400 shrink-0 mt-0.5" />
                                <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">{t('sub.options')}</h4>
                        
                        {/* Option: 1 persona */}
                        <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4 border border-white/10">
                            <div>
                                <h5 className="font-black italic uppercase text-sm">{t('i18nfix.one_person')}</h5>
                                <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">{t('sub.autorenew_1m')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-green-400">{family1Pkg?.product?.priceString ?? '9,99 €'}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">{t('i18nfix.per_month')}</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase('family1', family1Pkg?.identifier || 'rc_familiar_1p_1m')}
                                    disabled={processing}
                                    className="px-4 h-8 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-500/30 transition-all"
                                >
                                    {processing && selectedPlan === 'family1' ? <Loader2 className="animate-spin size-3" /> : t('sub.choose')}
                                </button>
                            </div>
                        </div>

                        {/* Option: 2 personas */}
                        <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4 border border-white/10">
                            <div>
                                <h5 className="font-black italic uppercase text-sm">{t('i18nfix.two_people')}</h5>
                                <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">{t('sub.autorenew_1m')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-green-400">{family2Pkg?.product?.priceString ?? '14,99 €'}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">{t('i18nfix.per_month')}</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase('family2', family2Pkg?.identifier || 'rc_familiar_2p_1m')}
                                    disabled={processing}
                                    className="px-4 h-8 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-500/30 transition-all"
                                >
                                    {processing && selectedPlan === 'family2' ? <Loader2 className="animate-spin size-3" /> : t('sub.choose')}
                                </button>
                            </div>
                        </div>

                        {/* Option: Hasta 6 personas */}
                        <div className="flex justify-between items-center bg-green-400/10 rounded-2xl p-4 border border-green-400/30">
                            <div>
                                <h5 className="font-black italic uppercase text-sm text-green-400">{t('sub.up_to_6')}</h5>
                                <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">{t('sub.autorenew_1m')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-green-400">{family6Pkg?.product?.priceString ?? '19,99 €'}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">{t('i18nfix.per_month')}</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase('family6', family6Pkg?.identifier || 'rc_familiar_6p_1m')}
                                    disabled={processing}
                                    className="px-4 h-8 bg-green-500 text-black rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-400 transition-all shadow-lg shadow-green-500/20"
                                >
                                    {processing && selectedPlan === 'family6' ? <Loader2 className="animate-spin size-3" /> : t('sub.choose')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-green-400/80 font-bold italic text-xs mt-4">
                        {t('i18nfix.tagline_family')}
                    </p>
                </div>

                {/* 3. PASE 72 HORAS */}
                <div className="bg-gradient-to-b from-zinc-900/80 to-zinc-900/30 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 relative overflow-hidden shadow-xl space-y-5">
                    <div className="absolute -top-12 -right-12 size-36 bg-amber-500/5 rounded-full blur-2xl" />
                    
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={24} className="text-amber-500" />
                            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{t('premium.72h.title')}</h2>
                        </div>
                        <h3 className="text-lg font-black italic text-amber-500">{t('premium.72h.subtitle')}</h3>
                        <p className="text-sm font-bold text-white/80 mt-1">{t('premium.72h.promo')}</p>
                        <p className="text-xs text-white/60 leading-relaxed font-medium mt-2">
                            {t('premium.features_list.tactical_nav')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">{t('sub.includes')}</h4>
                            {[
                                t('sub.f_full_access'),
                                t('sub.f_unlimited_routes'),
                                t('sub.coverage_spain'),
                                t('sub.f_sos'),
                                t('sub.f_max_precision')
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <Check size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                    <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight">{feature}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">{t('sub.perfect_for')}</h4>
                            {[
                                t('sub.for_trips'),
                                t('sub.for_festivals'),
                                t('sub.for_getaways'),
                                t('sub.for_emergencies'),
                                t('sub.for_nightlife')
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <div className="size-1.5 rounded-full bg-amber-500/50 shrink-0 mt-1" />
                                    <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 flex flex-col gap-3 mt-2">
                        <div className="flex justify-between items-center">
                            <h5 className="font-black italic uppercase text-sm text-amber-500">{t('sub.price')}</h5>
                            <span className="font-black italic text-xl text-amber-500">{pass72hPkg?.product?.priceString ?? '3,99 €'}</span>
                        </div>
                        <p className="text-[10px] text-amber-500/80 uppercase tracking-wide font-bold text-center">72 horas Premium</p>
                        <button
                            onClick={() => handlePurchase('72h', pass72hPkg?.identifier || 'rc_72h_pass')}
                            disabled={processing}
                            className="w-full h-10 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 mt-1"
                        >
                            {processing && selectedPlan === '72h' ? <Loader2 className="animate-spin size-3" /> : t('sub.activate_pass')}
                        </button>
                    </div>

                    <p className="text-center text-amber-500/80 font-bold italic text-xs mt-4">
                        {t('i18nfix.tagline_72h')}
                    </p>
                </div>

                {/* Subscription Legal Terms for Apple Review */}
                <div className="p-4 rounded-3xl bg-zinc-950/30 border border-white/5 text-left mt-8 space-y-4">
                    <div className="space-y-2 text-[9px] text-white/60 leading-relaxed font-medium">
                        <p><strong>{t('i18nfix.sub_terms_title')}</strong></p>
                        <p>• {t('i18nfix.sub_terms_monthly')}</p>
                        <p>• {t('i18nfix.sub_terms_annual')}</p>
                        <p>• {t('i18nfix.sub_terms_72h')}</p>
                        <p>{t('i18nfix.sub_terms_manage')}</p>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed font-medium border-t border-white/5 pt-3">
                        {Capacitor.getPlatform() === 'android'
                            ? t('premium.legal.iap_disclaimer_android')
                            : t('premium.legal.iap_disclaimer')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-white/5">
                        {/* Enlace al EULA de Apple SOLO en iOS (en Android referenciar Apple = rechazo de Google Play) */}
                        {Capacitor.getPlatform() === 'ios' && (
                            <button onClick={() => window.open('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', '_blank')} className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white underline underline-offset-4">Terms of Use (EULA)</button>
                        )}
                        <button onClick={() => navigate('/privacy')} className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white underline underline-offset-4">Privacy Policy</button>
                        <button onClick={() => navigate('/eula')} className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white underline underline-offset-4">Full EULA</button>
                        <button
                            onClick={() => RevenueCatService.restorePurchases().then(() => navigate('/'))}
                            className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white underline underline-offset-4"
                        >
                            {t('premium.restore_purchases')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};