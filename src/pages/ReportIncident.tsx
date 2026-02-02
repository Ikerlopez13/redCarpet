import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export const ReportIncident: React.FC = () => {
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = [
        { id: 'light', icon: 'lightbulb', title: 'Poca luz', subtitle: 'Baja visibilidad' },
        { id: 'suspicious', icon: 'visibility', title: 'Sospechoso', subtitle: 'Alerta general' },
        { id: 'fog', icon: 'cloud', title: 'Niebla', subtitle: 'Visual' },
        { id: 'unsafe', icon: 'warning', title: 'Ambiente Inseguro', subtitle: 'Peligro' },
        { id: 'harassment', icon: 'error', title: 'Acoso', subtitle: 'Inseguridad' },
        { id: 'security', icon: 'shield_with_heart', title: 'Seguridad', subtitle: 'Autoridades' },
    ];

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background-dark shadow-2xl font-display text-white">

            {/* Background Map */}
            <div className="absolute inset-0 z-0">
                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <img
                        alt="Abstract dark city map layout"
                        className="w-full h-full object-cover opacity-30 grayscale"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDf00bmb_jBo5saKI_L_20dOtUUT_Q4oyAthSILC0IvtvdWGCixD3K2LBX57bTSTWlEqfbTuSAoFEQYMVja0hMRsVc143S8yGDN5GStvZTMiRZU0K4umCDJr8HaDuT2bfgqdH21MkcT-4U6vWjtBnvn_TrQX8dFG4a1HyGtazD569lWUPgiAH8ZFItNnvkO6kLCSsOuCx702ihCjgQWBP6crnX_JVdhundZaLg0gP2BMJysb-pv0Aw0I_K4aCBwJIShsFGVspy2ZKQ"
                    />
                </div>
            </div>

            {/* Main Content / Bottom Sheet */}
            <div className="relative z-10 flex h-full w-full flex-col justify-end bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-stretch bg-background-light dark:bg-background-dark rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[90%] overflow-y-auto">

                    {/* Drag Handle */}
                    <div className="flex h-8 w-full items-center justify-center shrink-0">
                        <div className="h-1.5 w-12 rounded-full bg-primary/20"></div>
                    </div>

                    {/* Header */}
                    <div className="px-6 pt-2 pb-4 text-center shrink-0">
                        <h4 className="text-primary text-[10px] font-bold uppercase tracking-[0.25em] mb-1">COMUNIDAD DE SEGURIDAD</h4>
                        <h2 className="text-2xl font-bold leading-tight text-white">Reportar un Incidente</h2>
                        <p className="text-slate-400 text-sm mt-1">Ayuda a otros a mantenerse seguros en su ruta</p>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 gap-3 px-6 pt-2 pb-4 shrink-0">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={clsx(
                                    "flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all active:scale-95 group",
                                    selectedCategory === cat.id
                                        ? "bg-primary/10 border-primary"
                                        : "border-primary/10 bg-card-dark hover:bg-primary/5"
                                )}
                            >
                                <div className={clsx(
                                    "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                                    selectedCategory === cat.id ? "bg-primary text-white" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                                )}>
                                    <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-white text-[15px] font-bold leading-tight">{cat.title}</span>
                                    <span className="text-slate-400 text-[9px] uppercase font-bold tracking-wide">{cat.subtitle}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="px-6 pb-4 shrink-0">
                        <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Input personalizado</label>
                        <div className="relative">
                            <input
                                className="w-full bg-card-dark border border-primary/10 rounded-xl h-12 px-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                placeholder="Describe el incidente aquí..."
                                type="text"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 pb-8 flex flex-col gap-3 shrink-0">
                        <button
                            onClick={() => {
                                // Handle submission
                                navigate('/');
                            }}
                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-lg font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] active:brightness-90"
                        >
                            <span className="truncate">Seleccionar Categoría</span>
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-white/5 text-slate-300 text-base font-semibold transition-all active:scale-[0.98] active:brightness-90"
                        >
                            <span className="truncate">Cancelar</span>
                        </button>
                    </div>

                    {/* Bottom Safe Area Spacer */}
                    <div className="h-6 w-full"></div>

                </div>
            </div>
        </div>
    );
};
