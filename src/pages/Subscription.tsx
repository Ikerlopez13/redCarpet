import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RevenueCatService } from '../services/revenueCatService';
import type { PurchasesPackage } from '../services/revenueCatService';
import { useAuth } from '../contexts/AuthContext';
import {
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
    Clock
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
    const { setIsPremium } = useAuth();
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
                    aria-label="Cerrar Premium"
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
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Incluye</h4>
                        {[
                            "Rutas seguras ilimitadas",
                            "Prioridad total en rutas y seguridad",
                            "SOS avanzado",
                            "Alertas inteligentes",
                            "Mejor detección de riesgo en tiempo real",
                            "Mejoras premium en toda la experiencia"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Check size={14} className="text-primary shrink-0 mt-0.5" />
                                <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Opciones</h4>
                        
                        {/* Option: Individual */}
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h5 className="font-black italic uppercase text-sm">{t('premium.individual.title')}</h5>
                                    <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">{t('premium.cancel_anytime')}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-primary">9,99 €</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">/ mes</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePurchase('monthly', monthlyPkg?.identifier || 'mes_premium')}
                                disabled={processing}
                                className="w-full h-10 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2"
                            >
                                {processing && selectedPlan === 'monthly' ? <Loader2 className="animate-spin size-3" /> : "Elegir Individual"}
                            </button>
                        </div>



                        {/* Option: Anual */}
                        <div className="bg-primary/10 rounded-2xl p-4 border border-primary/40 flex flex-col gap-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-primary text-black text-[8px] font-black px-2 py-1 uppercase tracking-widest rounded-bl-lg">Más popular</div>
                            <div className="flex justify-between items-start pt-2">
                                <div>
                                    <h5 className="font-black italic uppercase text-sm text-primary">Premium Anual</h5>
                                    <p className="text-[10px] text-white/60 uppercase tracking-wide mt-1 leading-snug">{t('premium.cancel_anytime')}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-xl text-primary">79,99 €</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">/ año</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePurchase('annual', annualPkg?.identifier || 'rc_premium_anual_1y')}
                                disabled={processing}
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            >
                                {processing && selectedPlan === 'annual' ? <Loader2 className="animate-spin size-4" /> : "Elegir Anual"}
                            </button>
                        </div>
                    </div>
                    
                    <p className="text-center text-primary/80 font-bold italic text-xs mt-4">
                        Cuando nadie pueda acompañarte, Red Carpet siempre estará contigo.
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
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Incluye</h4>
                        {[
                            "Premium completo para todos",
                            "Rutas ilimitadas compartidas",
                            "Avisos si alguien no llega a su destino",
                            "Alertas y seguimiento inteligente",
                            "Protección para hijos, adolescentes y personas mayores",
                            "Mejoras premium para todo el grupo"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Check size={14} className="text-green-400 shrink-0 mt-0.5" />
                                <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Opciones</h4>
                        
                        {/* Option: 1 persona */}
                        <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4 border border-white/10">
                            <div>
                                <h5 className="font-black italic uppercase text-sm">1 persona</h5>
                                <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Suscripción Auto-renovable de 1 Mes</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-green-400">9,99 €</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">/ mes</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase('family1', family1Pkg?.identifier || 'rc_familiar_1p_1m')}
                                    disabled={processing}
                                    className="px-4 h-8 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-500/30 transition-all"
                                >
                                    {processing && selectedPlan === 'family1' ? <Loader2 className="animate-spin size-3" /> : "Elegir"}
                                </button>
                            </div>
                        </div>

                        {/* Option: 2 personas */}
                        <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4 border border-white/10">
                            <div>
                                <h5 className="font-black italic uppercase text-sm">2 personas</h5>
                                <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Suscripción Auto-renovable de 1 Mes</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-green-400">14,99 €</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">/ mes</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase('family2', family2Pkg?.identifier || 'rc_familiar_2p_1m')}
                                    disabled={processing}
                                    className="px-4 h-8 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-500/30 transition-all"
                                >
                                    {processing && selectedPlan === 'family2' ? <Loader2 className="animate-spin size-3" /> : "Elegir"}
                                </button>
                            </div>
                        </div>

                        {/* Option: Hasta 6 personas */}
                        <div className="flex justify-between items-center bg-green-400/10 rounded-2xl p-4 border border-green-400/30">
                            <div>
                                <h5 className="font-black italic uppercase text-sm text-green-400">Hasta 6 personas</h5>
                                <p className="text-[10px] text-white/50 uppercase tracking-wide mt-1">Suscripción Auto-renovable de 1 Mes</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right shrink-0">
                                    <span className="font-black italic text-lg text-green-400">19,99 €</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">/ mes</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase('family6', family6Pkg?.identifier || 'rc_familiar_6p_1m')}
                                    disabled={processing}
                                    className="px-4 h-8 bg-green-500 text-black rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-400 transition-all shadow-lg shadow-green-500/20"
                                >
                                    {processing && selectedPlan === 'family6' ? <Loader2 className="animate-spin size-3" /> : "Elegir"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-green-400/80 font-bold italic text-xs mt-4">
                        La verdadera tranquilidad es saber que todos están bien.
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
                            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Incluye</h4>
                            {[
                                "Acceso completo Premium",
                                "Rutas ilimitadas",
                                "SOS avanzado",
                                "Máxima precisión y protección"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <Check size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                    <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight">{feature}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Perfecto para</h4>
                            {[
                                "Viajes",
                                "Festivales",
                                "Escapadas",
                                "Emergencias",
                                "Eventos nocturnos"
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
                            <h5 className="font-black italic uppercase text-sm text-amber-500">Precio</h5>
                            <span className="font-black italic text-xl text-amber-500">1,99 €</span>
                        </div>
                        <p className="text-[10px] text-amber-500/80 uppercase tracking-wide font-bold text-center">72 horas Premium</p>
                        <button
                            onClick={() => handlePurchase('72h', pass72hPkg?.identifier || 'rc_72h_pass')}
                            disabled={processing}
                            className="w-full h-10 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 mt-1"
                        >
                            {processing && selectedPlan === '72h' ? <Loader2 className="animate-spin size-3" /> : "Activar Pase"}
                        </button>
                    </div>

                    <p className="text-center text-amber-500/80 font-bold italic text-xs mt-4">
                        Hay momentos donde sentirte segur@ lo cambia todo.
                    </p>
                </div>

                {/* Subscription Legal Terms for Apple Review */}
                <div className="p-4 rounded-3xl bg-zinc-950/30 border border-white/5 text-left mt-8 space-y-4">
                    <div className="space-y-2 text-[9px] text-white/60 leading-relaxed font-medium">
                        <p><strong>Auto-Renewable Subscriptions:</strong></p>
                        <p>• Monthly Premium: Auto-renews monthly</p>
                        <p>• Annual Premium: Auto-renews annually</p>
                        <p>• 72-Hour Pass: One-time purchase (non-renewing)</p>
                        <p>Renewal can be managed in Account Settings. Cancel anytime before renewal.</p>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed font-medium border-t border-white/5 pt-3">
                        {t('premium.legal.iap_disclaimer')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-white/5">
                        <button onClick={() => window.open('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', '_blank')} className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white underline underline-offset-4">Terms of Use (EULA)</button>
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