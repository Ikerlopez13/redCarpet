import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface Plan {
    id: string;
    name: string;
    children: string;
    price: string;
    priceValue: number;
    features: string[];
    popular?: boolean;
    savings?: string;
}

const plans: Plan[] = [
    {
        id: '1-child',
        name: 'Plan Parental',
        children: '1 hijo',
        price: '12,99€',
        priceValue: 12.99,
        features: [
            'Localización en tiempo real',
            'Zonas de seguridad',
            'Alertas de peligro',
            'Rutas seguras GPS',
            'Historial de ubicación',
        ],
    },
    {
        id: '2-children',
        name: 'Plan Parental',
        children: '2 hijos',
        price: '17,99€',
        priceValue: 17.99,
        popular: true,
        savings: 'Ahorra 8€/mes',
        features: [
            'Todo del plan 1 hijo',
            'Localización de 2 dispositivos',
            'Alertas cruzadas familiares',
            'Chat familiar seguro',
            'Informes de seguridad',
        ],
    },
    {
        id: 'unlimited',
        name: 'Plan Parental',
        children: 'Ilimitado',
        price: '24,99€',
        priceValue: 24.99,
        savings: '3+ hijos',
        features: [
            'Todo del plan 2 hijos',
            'Dispositivos ilimitados',
            'Soporte prioritario 24/7',
            'Funciones exclusivas beta',
            'Sin límites de historial',
        ],
    },
];

export const Subscription: React.FC = () => {
    const navigate = useNavigate();
    const [selectedPlan, setSelectedPlan] = useState<string>('2-children');
    const [isLoading, setIsLoading] = useState(false);

    // Debug state
    const [debugMode, setDebugMode] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [currentPlanId, setCurrentPlanId] = useState<string>('2-children');
    const [showCancelPopup, setShowCancelPopup] = useState(false);
    const [showRetentionOffer, setShowRetentionOffer] = useState(false);

    const handleSubscribe = () => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            if (debugMode) {
                setIsSubscribed(true);
                setCurrentPlanId(selectedPlan);
            } else {
                navigate('/settings');
            }
        }, 2000);
    };

    const handleCancelAttempt = () => {
        setShowCancelPopup(true);
    };

    const handleConfirmCancel = () => {
        setShowCancelPopup(false);
        setShowRetentionOffer(true);
    };

    const handleAcceptRetention = () => {
        setShowRetentionOffer(false);
        // User accepted 7 days free - stays subscribed
    };

    const handleFinalCancel = () => {
        setShowRetentionOffer(false);
        setIsSubscribed(false);
    };

    const selected = plans.find(p => p.id === selectedPlan);
    const currentPlan = plans.find(p => p.id === currentPlanId);

    // SUBSCRIBED VIEW
    if (isSubscribed && debugMode) {
        return (
            <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pt-12 shrink-0">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                        <span className="material-symbols-outlined">arrow_back_ios_new</span>
                    </button>
                    <h1 className="text-lg font-bold">Mi Suscripción</h1>
                    <div className="w-10" />
                </div>

                <div className="flex-1 overflow-y-auto pb-8 no-scrollbar">
                    {/* Current Plan Card */}
                    <div className="mx-4 mt-4 p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="text-xs text-primary font-bold uppercase tracking-wider">Plan Activo</p>
                                <h2 className="text-2xl font-bold mt-1">{currentPlan?.children}</h2>
                            </div>
                            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold">
                                ACTIVO
                            </div>
                        </div>

                        <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-3xl font-black">{currentPlan?.price}</span>
                            <span className="text-white/40">/mes</span>
                        </div>

                        <div className="flex items-center gap-2 text-white/60 text-sm">
                            <span className="material-symbols-outlined text-lg">calendar_today</span>
                            Próxima renovación: 26 de febrero, 2026
                        </div>
                    </div>

                    {/* Plan Features */}
                    <div className="mx-4 mt-6">
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-4">
                            Incluido en tu plan
                        </h3>
                        <div className="flex flex-col gap-3">
                            {currentPlan?.features.map((feature, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        check_circle
                                    </span>
                                    <span className="text-sm">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Usage Stats */}
                    <div className="mx-4 mt-6">
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-4">
                            Uso este mes
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-xl bg-white/5">
                                <p className="text-2xl font-bold">248</p>
                                <p className="text-xs text-white/40">Ubicaciones compartidas</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5">
                                <p className="text-2xl font-bold">12</p>
                                <p className="text-xs text-white/40">Alertas enviadas</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5">
                                <p className="text-2xl font-bold">3</p>
                                <p className="text-xs text-white/40">Rutas seguras creadas</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5">
                                <p className="text-2xl font-bold">2</p>
                                <p className="text-xs text-white/40">Dispositivos activos</p>
                            </div>
                        </div>
                    </div>

                    {/* Change Plan */}
                    <div className="mx-4 mt-6">
                        <button
                            onClick={() => setIsSubscribed(false)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-white/60">swap_horiz</span>
                                <span className="font-semibold">Cambiar de plan</span>
                            </div>
                            <span className="material-symbols-outlined text-white/40">chevron_right</span>
                        </button>
                    </div>

                    {/* Cancel Subscription */}
                    <div className="mx-4 mt-4 mb-8">
                        <button
                            onClick={handleCancelAttempt}
                            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <span className="material-symbols-outlined">cancel</span>
                            <span className="font-semibold">Cancelar suscripción</span>
                        </button>
                    </div>
                </div>

                {/* Debug Banner - Always visible when debug is on */}
                <div className="shrink-0 px-4 py-3 bg-purple-500/20 border-t border-purple-500/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-400 text-sm">bug_report</span>
                            <span className="text-xs text-purple-400 font-bold">DEBUG: Suscrito a {currentPlan?.children}</span>
                        </div>
                        <button
                            onClick={() => setDebugMode(false)}
                            className="text-xs text-purple-400 underline"
                        >
                            Salir debug
                        </button>
                    </div>
                </div>

                {/* Cancel Confirmation Popup */}
                {showCancelPopup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelPopup(false)} />
                        <div className="relative bg-background-dark rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
                            <div className="flex flex-col items-center text-center">
                                <div className="size-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-red-400 text-3xl">warning</span>
                                </div>
                                <h3 className="text-xl font-bold mb-2">¿Cancelar suscripción?</h3>
                                <p className="text-white/60 text-sm mb-6">
                                    Perderás acceso a todas las funciones premium y no podrás proteger a tu familia.
                                </p>

                                <div className="flex flex-col gap-3 w-full">
                                    <button
                                        onClick={() => setShowCancelPopup(false)}
                                        className="w-full py-4 rounded-xl bg-primary text-white font-bold"
                                    >
                                        Mantener suscripción
                                    </button>
                                    <button
                                        onClick={handleConfirmCancel}
                                        className="w-full py-3 text-red-400 font-semibold"
                                    >
                                        Continuar con la cancelación
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Retention Offer Popup - 7 days free */}
                {showRetentionOffer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                        <div className="relative bg-background-dark rounded-3xl p-6 w-full max-w-sm border border-primary/30 shadow-2xl overflow-hidden">
                            {/* Confetti-like decoration */}
                            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/20 to-transparent" />

                            <div className="relative flex flex-col items-center text-center">
                                <div className="size-20 rounded-full bg-primary/20 flex items-center justify-center mb-4 ring-4 ring-primary/30">
                                    <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        redeem
                                    </span>
                                </div>

                                <h3 className="text-2xl font-bold mb-2">¡Espera!</h3>
                                <p className="text-white/60 text-sm mb-4">
                                    Antes de irte, queremos ofrecerte algo especial
                                </p>

                                <div className="w-full p-4 rounded-2xl bg-primary/10 border border-primary/30 mb-6">
                                    <p className="text-primary font-black text-3xl mb-1">7 DÍAS GRATIS</p>
                                    <p className="text-white/60 text-sm">
                                        Disfruta de tu plan {currentPlan?.children} sin coste durante una semana más
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 text-left w-full mb-6">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-green-400 text-sm">check</span>
                                        <span className="text-sm text-white/80">Sin compromiso</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-green-400 text-sm">check</span>
                                        <span className="text-sm text-white/80">Cancela cuando quieras</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-green-400 text-sm">check</span>
                                        <span className="text-sm text-white/80">Mantén todas las funciones</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 w-full">
                                    <button
                                        onClick={handleAcceptRetention}
                                        className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/30"
                                    >
                                        🎉 ¡Quiero mis 7 días gratis!
                                    </button>
                                    <button
                                        onClick={handleFinalCancel}
                                        className="w-full py-3 text-white/40 text-sm"
                                    >
                                        No, cancelar de todos modos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // DEFAULT VIEW - Not subscribed / Plan selection
    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-12 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h1 className="text-lg font-bold">Planes Familiares</h1>
                <button className="p-2 -mr-2 text-primary font-semibold text-sm">
                    Restaurar
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-8 no-scrollbar">
                {/* Debug Toggle */}
                <div className="mx-4 mb-4">
                    <button
                        onClick={() => setDebugMode(!debugMode)}
                        className={clsx(
                            "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                            debugMode
                                ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                                : "bg-white/5 border-white/10 text-white/40"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">bug_report</span>
                            <span className="text-sm font-semibold">Modo Debug</span>
                        </div>
                        <div className={clsx(
                            "w-10 h-6 rounded-full flex items-center px-1 transition-colors",
                            debugMode ? "bg-purple-500" : "bg-white/20"
                        )}>
                            <div className={clsx(
                                "size-4 bg-white rounded-full transition-transform",
                                debugMode ? "translate-x-4" : "translate-x-0"
                            )} />
                        </div>
                    </button>
                    {debugMode && (
                        <p className="text-xs text-purple-400/60 mt-2 px-1">
                            Al suscribirte, simularás tener ese plan activo para ver la gestión
                        </p>
                    )}
                </div>

                {/* Hero Section */}
                <div className="flex flex-col items-center px-6 pt-4 pb-8 text-center">
                    <div className="size-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                            family_restroom
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Protege a toda tu familia</h2>
                    <p className="text-white/60 text-sm max-w-xs">
                        Elige el plan que mejor se adapte a tu familia y mantén a todos seguros
                    </p>
                </div>

                {/* Plans */}
                <div className="flex flex-col gap-4 px-4">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={clsx(
                                "relative flex flex-col p-5 rounded-2xl border-2 transition-all text-left",
                                selectedPlan === plan.id
                                    ? "border-primary bg-primary/10"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                            )}
                        >
                            {/* Popular Badge */}
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                    Más Popular
                                </div>
                            )}

                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-xs text-white/40 uppercase tracking-wider font-bold">{plan.name}</p>
                                    <h3 className="text-xl font-bold">{plan.children}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black">{plan.price}</p>
                                    <p className="text-xs text-white/40">/mes</p>
                                </div>
                            </div>

                            {plan.savings && (
                                <div className={clsx(
                                    "inline-flex self-start px-2 py-1 rounded-full text-xs font-bold mb-3",
                                    plan.id === 'unlimited'
                                        ? "bg-purple-500/20 text-purple-400"
                                        : "bg-green-500/20 text-green-400"
                                )}>
                                    {plan.savings}
                                </div>
                            )}

                            {/* Features */}
                            <div className="flex flex-col gap-2 mt-2">
                                {plan.features.slice(0, 3).map((feature, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            check_circle
                                        </span>
                                        <span className="text-sm text-white/80">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Selection indicator */}
                            <div className={clsx(
                                "absolute top-5 right-5 size-6 rounded-full border-2 flex items-center justify-center transition-all",
                                selectedPlan === plan.id
                                    ? "border-primary bg-primary"
                                    : "border-white/30"
                            )}>
                                {selectedPlan === plan.id && (
                                    <span className="material-symbols-outlined text-white text-sm">check</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-6 px-6 py-8">
                    <div className="flex flex-col items-center">
                        <span className="material-symbols-outlined text-white/40 text-2xl mb-1">lock</span>
                        <span className="text-[10px] text-white/40 uppercase font-bold">Pago Seguro</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="material-symbols-outlined text-white/40 text-2xl mb-1">sync</span>
                        <span className="text-[10px] text-white/40 uppercase font-bold">Cancela cuando quieras</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="material-symbols-outlined text-white/40 text-2xl mb-1">verified</span>
                        <span className="text-[10px] text-white/40 uppercase font-bold">Garantía 30 días</span>
                    </div>
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="shrink-0 px-6 pb-10 pt-4 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
                <button
                    onClick={handleSubscribe}
                    disabled={isLoading}
                    className={clsx(
                        "w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2",
                        isLoading
                            ? "bg-primary/50 text-white/50"
                            : "bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]"
                    )}
                >
                    {isLoading ? (
                        <>
                            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            Suscribirse por {selected?.price}/mes
                        </>
                    )}
                </button>
                <p className="text-center text-xs text-white/40 mt-4 px-4">
                    Suscripción mensual. Se renueva automáticamente hasta que la canceles.
                    Al continuar, aceptas los <span className="underline">Términos de uso</span> y la <span className="underline">Política de privacidad</span>.
                </p>
            </div>
        </div>
    );
};
