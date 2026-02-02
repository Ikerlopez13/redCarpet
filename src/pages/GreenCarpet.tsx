import React from 'react';
import { useNavigate } from 'react-router-dom';

export const GreenCarpet: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">

            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-12 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold">GreenCarpet Impacto</h1>
                <div className="size-10"></div> {/* Spacer for alignment */}
            </div>

            <div className="flex-1 overflow-y-auto pb-24 px-6 no-scrollbar">

                {/* Hero Circle */}
                <div className="flex justify-center py-6">
                    <div className="relative size-64 flex items-center justify-center">
                        {/* Ring SVGs */}
                        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1212" strokeWidth="8" />
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="#FF3131"
                                strokeWidth="8"
                                strokeDasharray="283"
                                strokeDashoffset="70"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">CO2 Ahorrado</span>
                            <div className="flex items-end leading-none mb-2">
                                <span className="text-6xl font-bold">12.5</span>
                                <span className="text-2xl font-bold mb-1 ml-1">kg</span>
                            </div>
                            <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm font-bold">trending_up</span>
                                <span className="text-xs font-bold">+15% este mes</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-white/5">
                        <span className="material-symbols-outlined text-primary text-2xl">directions_bike</span>
                        <div className="text-center">
                            <p className="text-[10px] text-white/60">Km en Bici</p>
                            <p className="text-xl font-bold">45.2</p>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-white/5">
                        <span className="material-symbols-outlined text-primary text-2xl">footprint</span>
                        <div className="text-center">
                            <p className="text-[10px] text-white/60">Pasos</p>
                            <p className="text-xl font-bold">12,400</p>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-white/5">
                        <span className="material-symbols-outlined text-primary text-2xl">directions_bus</span>
                        <div className="text-center">
                            <p className="text-[10px] text-white/60">Viajes Bus</p>
                            <p className="text-xl font-bold">8</p>
                        </div>
                    </div>
                </div>

                {/* Banner */}
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-4 mb-8">
                    <div className="size-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                        <span className="material-symbols-outlined text-white text-2xl">forest</span>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold">¡Gran trabajo!</h3>
                        <p className="text-sm text-white/80 leading-tight">
                            Has salvado <span className="text-primary font-bold">2 árboles</span> con tu movilidad sostenible.
                        </p>
                    </div>
                </div>

                {/* Commitment Section */}
                <h3 className="text-lg font-bold mb-3">Nuestro Compromiso</h3>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8">
                    <p className="text-sm text-white/70 leading-relaxed">
                        En GreenCarpet, nuestra misión es reducir la huella urbana promoviendo formas de transporte sostenibles y un estilo de vida consciente con el planeta. Cada paso cuenta para un futuro más limpio.
                    </p>
                </div>

                {/* Weekly Activity Chart (Simplified Visual) */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base font-bold">Actividad semanal</h3>
                    <button className="text-primary text-xs font-bold">Ver historial</button>
                </div>
                <div className="flex justify-between items-end h-24 mb-8 px-2">
                    {['L', 'M', 'X', 'J', 'V'].map((day, i) => (
                        <div key={day} className="flex flex-col items-center gap-2 w-full">
                            {/* Bars */}
                            <div className="w-2 rounded-full bg-white/10 h-full relative overflow-hidden">
                                <div
                                    className="absolute bottom-0 w-full bg-primary rounded-full"
                                    style={{ height: `${[40, 70, 30, 85, 50][i]}%` }}
                                ></div>
                            </div>
                            <span className="text-[10px] font-bold text-white/40">{day}</span>
                        </div>
                    ))}
                </div>

                {/* Share Button */}
                <button className="w-full h-14 bg-primary rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg hover:bg-primary/90 transition-colors mb-4">
                    <span className="material-symbols-outlined">share</span>
                    Comparte tu impacto
                </button>

            </div>
        </div>
    );
};
