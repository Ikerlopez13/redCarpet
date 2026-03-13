import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RevenueCatService } from '../services/revenueCatService';
import type { PurchasesPackage } from '../services/revenueCatService';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import {
    CheckCircle2,
    X,
    ShieldCheck,
    Users,
    MapPin,
    Bell
} from 'lucide-react';
import clsx from 'clsx';

export const Subscription: React.FC = () => {
    const navigate = useNavigate();
    const { isPremium, setIsPremium } = useAuth();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [individualPeriod, setIndividualPeriod] = useState<'monthly' | 'annual'>('annual');

    const COMMON_FEATURES = [
        "Alertas de zonas peligrosas en tiempo real",
        "Navegación segura con rutas alternativas",
        "Botón SOS con aviso a policía y contactos",
        "Historial de ubicación (1 mes)",
        "Soporte prioritario 24/7"
    ];

    useEffect(() => {
        const fetchOfferings = async () => {
            if (isPremium) {
                setLoading(false);
                return;
            }
            try {
                const packages = await RevenueCatService.getOfferings();
                if (packages && packages.length > 0) {
                    setOfferings(packages);
                }
            } catch (err: any) {
                console.error("Error fetching packages:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchOfferings();
    }, [isPremium]);

    const handlePurchase = async (packageId: string) => {
        setProcessing(true);
        setError(null);
        try {
            const selectedPackage = offerings.find(p => p.identifier === packageId);
            if (selectedPackage && Capacitor.isNativePlatform()) {
                const purchaseResult = await RevenueCatService.purchasePackage(selectedPackage);
                if (purchaseResult) {
                    setIsPremium(true);
                    navigate('/');
                }
            } else {
                console.log(`Mocking purchase of ${packageId}`);
                await new Promise(resolve => setTimeout(resolve, 1500));
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

    if (loading) {
        return (
            <div className="h-full w-full bg-background-dark flex flex-col items-center justify-center text-white">
                <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
                <p className="text-white/40 font-bold tracking-widest uppercase text-xs">Asegurando conexión...</p>
            </div>
        );
    }

    if (isPremium) {
        return (
            <div className="h-full w-full bg-background-dark p-8 flex flex-col items-center justify-center text-white overflow-y-auto">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="size-32 rounded-full bg-primary/20 flex items-center justify-center mb-10 shadow-[0_0_60px_rgba(255,49,49,0.3)]"
                >
                    <ShieldCheck size={64} className="text-primary" />
                </motion.div>
                <h1 className="text-4xl font-black mb-4 text-center tracking-tighter uppercase italic">RedCarpet PRO</h1>
                <p className="text-white/50 text-center max-w-xs mb-12">
                    Todas las funciones de defensa e inteligencia artificial están activas en tu dispositivo.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="w-full max-w-xs py-5 bg-white text-black font-black rounded-2xl text-lg active:scale-95 transition-all shadow-2xl uppercase tracking-tighter"
                >
                    Volver al Mapa
                </button>
            </div>
        );
    }

    const FeatureItem = ({ text, blue = false }: { text: string; blue?: boolean }) => (
        <li className="flex items-start gap-3">
            <CheckCircle2 size={18} className={clsx("shrink-0 mt-0.5", blue ? "text-blue-500" : "text-primary")} />
            <span className="text-[13px] font-medium text-white/90 leading-tight">{text}</span>
        </li>
    );

    return (
        <div className="h-full w-full bg-background-dark flex flex-col overflow-y-auto no-scrollbar pb-12">
            {/* Header */}
            <div className="flex flex-col items-center px-8 pt-20 pb-12 text-center space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-primary/5 blur-[100px] pointer-events-none" />

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-14 left-6 p-3 bg-white/5 backdrop-blur-md rounded-full text-white/60 hover:text-white transition-all shadow-lg active:scale-95"
                >
                    <X size={20} />
                </button>

                <h1 className="text-4xl font-bold tracking-tight text-white uppercase">Premium</h1>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">
                    Tecnología de élite para tu seguridad
                </p>
            </div>

            <div className="px-5 space-y-8">

                {/* Error Banner */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold text-center"
                    >
                        {error}
                    </motion.div>
                )}

                {/* 1. PREMIUM INDIVIDUAL (RECOMENDADO) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-card-dark border border-white/5 rounded-[2.5rem] p-8 overflow-hidden shadow-2xl"
                >
                    <div className="absolute top-0 right-0 bg-primary px-6 py-2.5 font-bold text-[10px] tracking-[0.2em] uppercase rounded-bl-3xl shadow-lg">
                        RECOMENDADO
                    </div>

                    <div className="space-y-1 mb-8">
                        <h2 className="text-3xl font-extrabold tracking-tight text-white uppercase leading-tight">Premium<br />Individual</h2>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-2">Seguridad personal 24/7</p>
                    </div>

                    <ul className="space-y-4 mb-8">
                        {COMMON_FEATURES.map((f, i) => <FeatureItem key={i} text={f} />)}
                    </ul>

                    {/* Selector Individual */}
                    <div className="flex gap-4 mb-8">
                        <button
                            onClick={() => setIndividualPeriod('monthly')}
                            className={clsx(
                                "flex-1 p-6 rounded-3xl flex flex-col items-center gap-1 transition-all",
                                individualPeriod === 'monthly' ? "bg-white text-black shadow-xl" : "bg-white/5 border border-white/5 hover:border-white/10 text-white"
                            )}
                        >
                            <span className="text-2xl font-bold leading-none">9,99€</span>
                            <span className={clsx("text-[10px] font-bold uppercase tracking-widest mt-1", individualPeriod === 'monthly' ? "text-black/40" : "text-white/40")}>Mensual</span>
                        </button>
                        <button
                            onClick={() => setIndividualPeriod('annual')}
                            className={clsx(
                                "flex-1 p-6 rounded-3xl flex flex-col items-center gap-1 transition-all relative border",
                                individualPeriod === 'annual' ? "bg-primary border-primary shadow-lg shadow-primary/30 text-white" : "bg-white/5 border border-white/5 hover:border-white/10 text-white"
                            )}
                        >
                            <span className="text-2xl font-bold leading-none">89,99€</span>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={clsx("text-[10px] font-bold uppercase tracking-widest", individualPeriod === 'annual' ? "text-white/60" : "text-white/40")}>Anual</span>
                                <span className="text-[10px] bg-black/20 px-1 rounded text-white font-bold">(-25%)</span>
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={() => handlePurchase(individualPeriod === 'monthly' ? 'rc_individual_monthly' : 'rc_individual_annual')}
                        disabled={processing}
                        className="w-full py-5 bg-white text-black font-bold rounded-2xl text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest"
                    >
                        {processing ? 'PROCESANDO...' : 'COMENZAR AHORA'}
                    </button>
                </motion.div>

                {/* 2. PLAN ESTUDIANTES */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card-dark border border-white/5 rounded-[2.5rem] p-8 shadow-2xl"
                >
                    <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-extrabold tracking-tight text-white uppercase leading-tight">Plan Estudiantes</h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Protección en campus</p>
                        </div>
                        <div className="px-4 py-2 bg-white/5 rounded-full font-black text-sm border border-white/10">
                            4,99 €
                        </div>
                    </div>

                    <ul className="space-y-4 mb-10">
                        {COMMON_FEATURES.map((f, i) => <FeatureItem key={i} text={f} />)}
                    </ul>

                    <button
                        onClick={() => handlePurchase('rc_student_discount')}
                        disabled={processing}
                        className="w-full py-5 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl text-xl transition-all border border-white/10 disabled:opacity-50 uppercase tracking-tighter"
                    >
                        {processing ? 'PROCESANDO...' : 'SUSCRIBIRSE COMO ESTUDIANTE'}
                    </button>
                </motion.div>

                {/* 3. PASE 72H (BROWN THEME) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-amber-950/40 to-card-dark border border-amber-900/40 rounded-[2.5rem] p-8 shadow-2xl"
                >
                    <div className="space-y-1 mb-6">
                        <h2 className="text-2xl font-extrabold tracking-tight text-white uppercase">Pase 72h</h2>
                    </div>

                    <div className="bg-amber-600/10 border border-amber-600/20 p-6 rounded-3xl space-y-2 mb-8">
                        <h4 className="text-amber-500 font-black text-lg leading-tight uppercase italic">Actívalo cuando más lo necesites.</h4>
                        <p className="text-amber-500/60 text-[10px] font-bold uppercase tracking-widest mt-1">Pase temporal, tranquilidad total.</p>
                    </div>

                    <p className="text-[11px] text-white/40 font-bold mb-6 italic px-2 leading-relaxed">Incluye todas las funciones del Premium Individual a precio reducido.</p>

                    <ul className="space-y-4 mb-10">
                        {COMMON_FEATURES.map((f, i) => <FeatureItem key={i} text={f} />)}
                    </ul>

                    <button
                        onClick={() => handlePurchase('rc_72h_pass')}
                        disabled={processing}
                        className="w-full py-5 bg-gradient-to-r from-orange-600 to-primary text-white font-black rounded-2xl text-xl shadow-xl shadow-red-900/40 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-tighter"
                    >
                        {processing ? 'PROCESANDO...' : 'OBTENER PASE POR 2,99€'}
                    </button>
                </motion.div>

                {/* 4. PLAN FAMILIAR (BLUE THEME) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-indigo-950/40 to-card-dark border border-indigo-900/40 rounded-[2.5rem] p-8 shadow-2xl"
                >
                    <div className="space-y-1 mb-6">
                        <h2 className="text-2xl font-extrabold tracking-tight text-white uppercase">Plan Familiar</h2>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Protección compartida</p>
                    </div>

                    <div className="bg-indigo-600/10 border border-indigo-600/20 p-6 rounded-3xl space-y-1 mb-8">
                        <p className="text-indigo-400 font-bold text-sm">La seguridad de tus seres queridos y la tuya sí importa.</p>
                    </div>

                    <div className="space-y-6 mb-10">
                        <div className="flex items-center gap-4 group">
                            <div className="size-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Users size={20} />
                            </div>
                            <span className="text-sm font-bold">Hasta 5 miembros de la familia</span>
                        </div>
                        <div className="flex items-center gap-4 group">
                            <div className="size-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <MapPin size={20} />
                            </div>
                            <span className="text-sm font-bold">Ubicación en tiempo real de todos</span>
                        </div>
                        <div className="flex items-center gap-4 group">
                            <div className="size-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Bell size={20} />
                            </div>
                            <span className="text-sm font-bold">Alertas cuando llegan o salen</span>
                        </div>

                        <hr className="border-white/5" />

                        <ul className="space-y-4">
                            {COMMON_FEATURES.map((f, i) => <FeatureItem key={i} text={f} blue />)}
                        </ul>
                    </div>

                    <button
                        onClick={() => handlePurchase('rc_family_plan')}
                        disabled={processing}
                        className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl text-xl shadow-xl shadow-indigo-900/40 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-tighter"
                    >
                        {processing ? 'PROCESANDO...' : 'PROTEGER A MI FAMILIA (14,99€)'}
                    </button>
                </motion.div>

                {/* Bottom Legal */}
                <div className="flex flex-col items-center gap-4 py-8">
                    <div className="flex gap-4">
                        <button onClick={() => navigate('/terms')} className="text-white/20 text-[10px] font-bold tracking-widest uppercase hover:text-white transition-all underline decoration-white/10 underline-offset-4">Términos</button>
                        <button onClick={() => navigate('/privacy')} className="text-white/20 text-[10px] font-bold tracking-widest uppercase hover:text-white transition-all underline decoration-white/10 underline-offset-4">Privacidad</button>
                    </div>
                    <p className="text-[10px] text-white/10 font-black">© 2026 REDCARPET SECURITY</p>
                </div>

            </div>
        </div>
    );
};
