import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TreePine,
    Droplets,
    Car,
    Zap,
    Users,
    User as UserIcon,
    Building2,
    TrendingUp,
    Award,
    ShieldCheck,
    ChevronRight,
    Bike,
    Footprints,
    Bus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'community' | 'personal' | 'future';

const Counter = ({ value, unit, label, delay = 0 }: { value: number; unit: string; label: string; delay?: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            let start = 0;
            const end = value;
            const duration = 2000;
            const increment = end / (duration / 16);

            const handle = setInterval(() => {
                start += increment;
                if (start >= end) {
                    setCount(end);
                    clearInterval(handle);
                } else {
                    setCount(start);
                }
            }, 16);
            return () => clearInterval(handle);
        }, delay * 1000);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return (
        <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">{count.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className="text-sm font-bold text-green-500">{unit}</span>
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">{label}</span>
        </div>
    );
};

export const GreenCarpet: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('community');

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'community', label: 'Comunidad', icon: Users },
        { id: 'personal', label: 'Mi Impacto', icon: UserIcon },
        { id: 'future', label: 'Proyecciones', icon: TrendingUp },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-zinc-950 text-white overflow-hidden font-display relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-green-500/10 blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between p-6 pt-12 shrink-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white bg-white/5 rounded-full backdrop-blur-md">
                    <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
                </button>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5">
                        <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                        <h1 className="text-sm font-black tracking-[0.2em] uppercase">GreenCarpet</h1>
                    </div>
                </div>
                <div className="size-10"></div>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 mb-6 z-10">
                <div className="bg-white/5 p-1 rounded-2xl flex backdrop-blur-md border border-white/5">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${activeTab === tab.id
                                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20'
                                : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            <tab.icon size={16} />
                            <span className="text-xs font-bold">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-24 px-6 no-scrollbar z-10">
                <AnimatePresence mode="wait">
                    {activeTab === 'community' && (
                        <motion.div
                            key="community"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            {/* Hero Stats */}
                            <div className="bg-gradient-to-br from-green-500/10 to-transparent p-8 rounded-[2.5rem] border border-green-500/10 flex flex-col items-center text-center">
                                <div className="size-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-900/40 mb-6">
                                    <Zap size={32} className="text-white fill-white" />
                                </div>
                                <Counter value={12450.8} unit="kg" label="CO₂ Evitado Total" />
                                <div className="mt-8 grid grid-cols-2 gap-8 w-full border-t border-white/5 pt-8">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl font-bold">85,240</span>
                                        <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">Kilómetros</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl font-bold">12.4k</span>
                                        <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">Trayectos</span>
                                    </div>
                                </div>
                            </div>

                            {/* Equivalencies */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-2">Equivalencias de Impacto</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/5 flex items-center gap-4">
                                        <div className="size-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500">
                                            <TreePine size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white">568 Árboles Plantados</p>
                                            <p className="text-[10px] text-white/40">Equivalente en absorción de CO2 anual.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/5 flex items-center gap-4">
                                        <div className="size-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                                            <Droplets size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white">4,200 Litros de Gasolina</p>
                                            <p className="text-[10px] text-white/40">Ahorrados por el uso de transporte público.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/5 flex items-center gap-4">
                                        <div className="size-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                                            <Car size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white">125k Km de Coche Evitados</p>
                                            <p className="text-[10px] text-white/40">Trayectos urbanos que no usaron vehículo privado.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* City Impact Preview */}
                            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4">
                                    <Building2 size={64} className="text-white/5 -rotate-12" />
                                </div>
                                <div className="relative z-10 flex flex-col gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Building2 size={14} className="text-green-500" />
                                            <h3 className="text-sm font-bold uppercase tracking-wider">Impacto en la Ciudad</h3>
                                        </div>
                                        <p className="text-xs text-white/50 leading-relaxed">Próximamente estaremos colaborando con ayuntamientos para mostrar métricas por barrios y distritos.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-white/40">MADRID</span>
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-white/40">BARCELONA</span>
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-white/40">VALENCIA</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'personal' && (
                        <motion.div
                            key="personal"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            {/* My Personal Counter */}
                            <div className="bg-zinc-900 border border-white/5 p-8 rounded-[2.5rem] flex flex-col items-center">
                                <div className="size-12 rounded-full border border-green-500/50 p-1 mb-4 overflow-hidden">
                                    <img
                                        src={user?.profile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}&background=random`}
                                        className="size-full rounded-full object-cover"
                                        alt="Yo"
                                    />
                                </div>
                                <Counter value={42.3} unit="kg" label="Tu CO₂ Evitado" delay={0.2} />
                            </div>

                            {/* Activity Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
                                    <div className="size-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                                        <Footprints size={20} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black">28k</p>
                                        <p className="text-[10px] font-bold text-white/40 uppercase">Pasos Sostenibles</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
                                    <div className="size-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                                        <Bike size={20} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black">15.2</p>
                                        <p className="text-[10px] font-bold text-white/40 uppercase">Km en Bici</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
                                    <div className="size-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                                        <Bus size={20} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black">12</p>
                                        <p className="text-[10px] font-bold text-white/40 uppercase">Trayectos Bus/Metro</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
                                    <div className="size-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                                        <Award size={20} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black">6</p>
                                        <p className="text-[10px] font-bold text-white/40 uppercase">Medallas Eco</p>
                                    </div>
                                </div>
                            </div>

                            {/* Certificate Banner */}
                            <div className="bg-green-600 p-6 rounded-3xl shadow-xl shadow-green-900/20 flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={28} className="text-white" />
                                    <h3 className="text-lg font-black uppercase tracking-tight">Compromiso GreenCarpet</h3>
                                </div>
                                <p className="text-white/80 text-xs leading-relaxed font-medium">
                                    RedCarpet certifica que contribuyes activamente a reducir emisiones urbanas fomentando desplazamientos sostenibles y seguros.
                                </p>
                                <button className="flex items-center justify-between bg-black/20 hover:bg-black/30 p-4 rounded-2xl transition-all">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Ver Certificado Digital</span>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'future' && (
                        <motion.div
                            key="future"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div className="space-y-2 text-center py-4">
                                <h2 className="text-2xl font-black italic tracking-tighter uppercase">Potencial de Futuro</h2>
                                <p className="text-white/40 text-xs px-6">¿Qué impacto tendríamos si todos usáramos RedCarpet?</p>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex flex-col gap-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-white/40 uppercase">Escenario Base</span>
                                            <span className="text-xl font-bold">100k Usuarios</span>
                                        </div>
                                        <span className="px-3 py-1 bg-green-500/20 text-green-500 rounded-full text-[10px] font-bold">PROYECCIÓN</span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                                <span>CO2 Evitado</span>
                                                <span className="text-green-500">120 Toneladas / año</span>
                                            </div>
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: '40%' }} className="h-full bg-green-600" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                                <span>Km Sostenibles</span>
                                                <span className="text-blue-500">5.4 Millones km</span>
                                            </div>
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} className="h-full bg-blue-600" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-zinc-900 border border-white/5 p-6 rounded-[2rem] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8">
                                        <TrendingUp size={80} className="text-white/5" />
                                    </div>
                                    <div className="relative z-10 space-y-3">
                                        <h4 className="text-sm font-black uppercase tracking-widest text-white/80">Valor Social para Inversores</h4>
                                        <p className="text-xs text-white/40 leading-relaxed pr-12">
                                            La red mejora la seguridad mientras reduce la huella de carbono, alineándose con los objetivos ESG y agendas urbanas 2030.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Share */}
                <div className="mt-12 mb-6">
                    <button className="w-full py-5 bg-white text-zinc-950 rounded-2xl flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase shadow-2xl active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-lg">share</span>
                        Compartir Impacto
                    </button>
                </div>
            </div>
        </div>
    );
};
