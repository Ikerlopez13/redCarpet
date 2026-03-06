import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RevenueCatService } from '../services/revenueCatService';
import type { PurchasesPackage } from '../services/revenueCatService';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import clsx from 'clsx';

export const Subscription: React.FC = () => {
    const navigate = useNavigate();
    const { isPremium, setIsPremium } = useAuth();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const FEATURES = [
        "Cámaras de Seguridad SOS integradas",
        "Navegación inteligente con IA",
        "Avisos de peligros e incidentes ilimitados",
        "Panel avanzado de la Familia",
        "Alertas de entrada y salida geovalladas",
        "Historial de ubicaciones (1 mes)",
    ];

    useEffect(() => {
        const fetchOfferings = async () => {
            if (isPremium) {
                setLoading(false);
                return;
            }

            try {
                // Fetch packages from RevenueCat
                const packages = await RevenueCatService.getOfferings();

                if (packages && packages.length > 0) {
                    setOfferings(packages);
                    // Default to Annual if it exists, otherwise the first one
                    const defaultPackage = packages.find(p => p.identifier.toLowerCase().includes('annual') || p.identifier.toLowerCase().includes('year')) || packages[0];
                    setSelectedPackageId(defaultPackage.identifier);
                } else {
                    setError('No se han encontrado planes de suscripción disponibles en este momento.');
                }
            } catch (err: any) {
                console.error("Error fetching packages:", err);
                setError('Hubo un error cargando las suscripciones.');
            } finally {
                setLoading(false);
            }
        };

        fetchOfferings();
    }, [isPremium]);

    const handlePurchase = async () => {
        const selectedPackage = offerings.find(p => p.identifier === selectedPackageId);
        if (!selectedPackage) return;

        setProcessing(true);
        setError(null);

        try {
            const purchaseResult = await RevenueCatService.purchasePackage(selectedPackage);
            if (purchaseResult) {
                // Redirect user to home or back smoothly
                setIsPremium(true);
                navigate('/');
            }
        } catch (err: any) {
            console.error("Purchase failed:", err);
            setError('La compra ha fallado o fue cancelada.');
        } finally {
            setProcessing(false);
        }
    };

    const handleRestore = async () => {
        setProcessing(true);
        setError(null);
        try {
            const customerInfo = await RevenueCatService.restorePurchases();
            if (customerInfo && customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_ID]) {
                setIsPremium(true);
                navigate('/');
            } else {
                setError('No se encontró ninguna compra previa para restaurar.');
            }
        } catch (err) {
            setError('Error restaurando compras.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full w-full bg-background-dark flex flex-col items-center justify-center text-white">
                <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
                <p className="text-white/60">Conectando de forma segura...</p>
            </div>
        );
    }

    // PREMIUM STATE
    if (isPremium) {
        return (
            <div className="h-full w-full bg-background-dark p-6 flex flex-col items-center justify-center animate-in fade-in duration-500 text-white overflow-y-auto">
                <div className="size-24 rounded-full bg-primary/20 flex items-center justify-center mb-8 ring-4 ring-primary/30 shadow-[0_0_50px_rgba(255,0,0,0.4)]">
                    <span className="material-symbols-outlined text-primary text-5xl">verified</span>
                </div>

                <h1 className="text-3xl font-black mb-4 text-center">¡Ya eres RedCarpet Pro!</h1>
                <p className="text-lg font-medium mb-8 text-center text-white/80">
                    Disfruta de protección ilimitada, rutas seguras inteligentes y control familiar avanzado.
                </p>

                {Capacitor.isNativePlatform() && (
                    <>
                        <p className="text-sm text-center text-white/50 mb-6 max-w-xs">
                            Gestiona tu suscripción cómodamente.
                        </p>
                        <button
                            onClick={async () => {
                                await RevenueCatService.presentCustomerCenter();
                            }}
                            className="w-full max-w-xs py-4 mb-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all text-white border border-white/20 flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">manage_accounts</span>
                            Gestionar Suscripción
                        </button>
                    </>
                )}

                <button
                    onClick={() => navigate('/')}
                    className="w-full max-w-xs py-4 bg-primary text-white hover:bg-primary/90 shadow-[0_0_30px_rgba(255,0,0,0.3)] rounded-xl font-bold transition-all"
                >
                    Volver al Mapa
                </button>
            </div>
        );
    }

    // PAYWALL STATE
    return (
        <div className="h-full w-full bg-background-dark flex flex-col overflow-y-auto pb-24 relative">

            {/* Dark background header w/ graphic */}
            <div className="relative pt-12 pb-6 px-6 flex flex-col items-center justify-center z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-6 left-6 size-10 flex items-center justify-center bg-black/40 rounded-full text-white/70 hover:text-white backdrop-blur-md transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">close</span>
                </button>

                <div className="size-20 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,0,0,0.3)] backdrop-blur-md">
                    <span className="material-symbols-outlined text-primary text-4xl">shield_locked</span>
                </div>
                <h1 className="text-3xl font-black text-center text-white mb-2 tracking-tight">
                    RedCarpet <span className="text-primary">Pro</span>
                </h1>
                <p className="text-white/60 text-center max-w-xs text-sm">
                    Desbloquea la seguridad definitiva de inteligencia artificial para ti y los tuyos.
                </p>
            </div>

            <div className="px-6 flex-1 flex flex-col z-10 w-full max-w-md mx-auto">
                {/* Features List */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 mb-6 backdrop-blur-md">
                    <ul className="space-y-4">
                        {FEATURES.map((feature, idx) => (
                            <li key={idx} className="flex items-start text-sm text-white/90">
                                <span className="material-symbols-outlined text-primary text-base mr-3 mt-0.5 opacity-90">check_circle</span>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm text-center backdrop-blur-md">
                        {error}
                    </div>
                )}

                {/* Packages Selection */}
                <div className="space-y-3 mb-8">
                    {offerings.map((pkg) => {
                        const isSelected = selectedPackageId === pkg.identifier;
                        const isPopular = pkg.identifier.toLowerCase().includes('annual') || pkg.identifier.toLowerCase().includes('year');

                        return (
                            <button
                                key={pkg.identifier}
                                onClick={() => setSelectedPackageId(pkg.identifier)}
                                disabled={processing}
                                className={clsx(
                                    "w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden",
                                    isSelected
                                        ? "bg-primary/10 border-primary"
                                        : "bg-white/5 border-white/10 hover:border-white/30"
                                )}
                            >
                                {isPopular && (
                                    <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg tracking-wider">
                                        MÁS POPULAR
                                    </div>
                                )}

                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                        isSelected ? "border-primary" : "border-white/30"
                                    )}>
                                        {isSelected && <div className="size-2.5 rounded-full bg-primary" />}
                                    </div>
                                    <div>
                                        <h3 className={clsx("font-semibold", isSelected ? "text-white" : "text-white/80")}>
                                            {pkg.product.title.replace('(RedCarpet)', '').trim()}
                                        </h3>
                                        <p className="text-white/50 text-xs mt-0.5">{pkg.product.description}</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className={clsx("font-bold text-lg", isSelected ? "text-primary text-shadow-glow" : "text-white")}>
                                        {pkg.product.priceString}
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    {/* Fallback mock UI for Web environment where packages might be empty */}
                    {!Capacitor.isNativePlatform() && offerings.length === 0 && !error && (
                        <div className="w-full flex items-center justify-between p-4 rounded-xl border border-primary bg-primary/10 text-left">
                            <div className="flex items-center gap-4">
                                <div className="size-5 rounded-full border-2 border-primary flex items-center justify-center">
                                    <div className="size-2.5 rounded-full bg-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Suscripción Premium (Simulada Web)</h3>
                                    <p className="text-white/50 text-xs">Desbloquea todas las funciones</p>
                                </div>
                            </div>
                            <div className="font-bold text-lg text-primary text-shadow-glow">4,99 €</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Floating CTA & Legal */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-20 flex flex-col items-center">
                <button
                    onClick={handlePurchase}
                    disabled={processing || (offerings.length > 0 && !selectedPackageId)}
                    className="w-full max-w-md py-4 bg-primary text-white hover:bg-primary/90 shadow-[0_0_30px_rgba(255,0,0,0.3)] rounded-2xl font-bold text-lg mb-4 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                    {processing ? (
                        <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            Procesando...
                        </>
                    ) : (
                        'Suscribirse Ahora'
                    )}
                </button>

                <div className="flex flex-col items-center space-y-3 w-full max-w-md">
                    <button
                        onClick={handleRestore}
                        disabled={processing}
                        className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                    >
                        Restaurar compras
                    </button>

                    <div className="flex items-center gap-3 text-xs text-white/40">
                        <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors underline decoration-white/20 underline-offset-2">Términos de Servicio</button>
                        <span>•</span>
                        <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors underline decoration-white/20 underline-offset-2">Política de Privacidad</button>
                    </div>
                </div>
            </div>

        </div>
    );
};
