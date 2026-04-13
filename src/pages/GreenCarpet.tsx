import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TreePine,
    Droplets,
    Car,
    Users,
    User as UserIcon,
    TrendingUp,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Globe,
    Zap as ZapIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

type TabType = 'community' | 'personal';

export const GreenCarpet: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('community');

    return (
        <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden font-display relative">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pt-12 shrink-0 z-20">
                <button 
                    onClick={() => navigate(-1)} 
                    className="size-12 flex items-center justify-center text-white/60 bg-white/5 rounded-2xl border border-white/10"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
                        <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black tracking-widest uppercase text-green-400">GreenCarpet Live</span>
                    </div>
                </div>
                <div className="size-12"></div>
            </div>

            <div className="px-6 mb-8 text-center">
                <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-2">Impacto Social</h1>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">Transformando pasos en seguridad</p>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 mb-8 z-20">
                <div className="bg-white/5 p-1.5 rounded-[2rem] flex border border-white/10">
                    <button
                        onClick={() => setActiveTab('community')}
                        className={clsx(
                            "flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab === 'community' ? 'bg-green-500 text-white shadow-lg' : 'text-white/40'
                        )}
                    >
                        Comunidad
                    </button>
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={clsx(
                            "flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab === 'personal' ? 'bg-green-500 text-white shadow-lg' : 'text-white/40'
                        )}
                    >
                        Mi Aporte
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-24 px-6 no-scrollbar">
                {activeTab === 'community' ? (
                    <div className="space-y-6">
                        {/* Main Stats */}
                        <div className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] flex flex-col items-center text-center">
                            <ZapIcon size={40} className="text-green-500 mb-4" />
                            <span className="text-5xl font-black italic tracking-tighter">12,450.8</span>
                            <span className="text-sm font-bold text-green-500 uppercase mb-6">kg de CO₂ evitado</span>
                            
                            <div className="grid grid-cols-2 gap-8 w-full border-t border-white/5 pt-8">
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black">85k</span>
                                    <span className="text-[10px] text-white/30 uppercase">Kilómetros</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black">12.4k</span>
                                    <span className="text-[10px] text-white/30 uppercase">Trayectos</span>
                                </div>
                            </div>
                        </div>

                        {/* Equivalencies */}
                        <div className="space-y-3">
                            {[
                                { icon: TreePine, title: '568 Árboles', desc: 'Capacidad de absorción', color: 'text-green-400' },
                                { icon: Droplets, title: '4,200 Litros', desc: 'Combustible ahorrado', color: 'text-blue-400' },
                                { icon: Globe, title: '125,000 Km', desc: 'Emisiones evitadas', color: 'text-orange-400' }
                            ].map((item, i) => (
                                <div key={i} className="bg-white/5 p-5 rounded-[2rem] border border-white/5 flex items-center gap-5">
                                    <div className={`size-12 rounded-xl bg-white/5 flex items-center justify-center ${item.color}`}>
                                        <item.icon size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black uppercase italic text-sm">{item.title}</p>
                                        <p className="text-[10px] text-white/30 uppercase">{item.desc}</p>
                                    </div>
                                    <ChevronRight size={18} className="text-white/20" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Personal Hero */}
                        <div className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] flex flex-col items-center">
                            <div className="size-20 rounded-[2rem] border-2 border-green-500 p-1 mb-6 overflow-hidden">
                                <img
                                    src={user?.profile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}&background=random`}
                                    className="size-full rounded-[1.5rem] object-cover"
                                    alt="User"
                                />
                            </div>
                            <span className="text-4xl font-black italic tracking-tighter">42.3</span>
                            <span className="text-xs font-bold text-green-500 uppercase">Tus Kilogramos CO₂</span>
                        </div>

                        {/* Achievements */}
                        <div className="bg-green-500 p-8 rounded-[3rem] text-black shadow-lg shadow-green-500/20">
                            <ShieldCheck size={40} className="mb-4" />
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Eco-Elite</h3>
                            <p className="text-sm font-bold uppercase opacity-60 leading-tight">
                                Contribuyes activamente al desarrollo de ciudades seguras.
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer Share */}
                <button className="mt-8 w-full py-5 bg-white text-black rounded-[2rem] font-black uppercase italic tracking-tighter flex items-center justify-center gap-2">
                    Compartir Impacto
                </button>
            </div>
        </div>
    );
};
