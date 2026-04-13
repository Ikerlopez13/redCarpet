import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { getCurrentPosition } from '../services/locationService';
import type { Database } from '../services/database.types';

type DangerZoneType = Database['public']['Tables']['danger_zones']['Row']['type'];

export const ReportIncident: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [customInput, setCustomInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const categories = [
        { id: 'light', dbType: 'dark', icon: 'lightbulb', title: 'Poca luz', subtitle: 'Baja visibilidad' },
        { id: 'suspicious', dbType: 'incident', icon: 'visibility', title: 'Sospechoso', subtitle: 'Alerta general' },
        { id: 'fog', dbType: 'traffic', icon: 'cloud', title: 'Niebla', subtitle: 'Visual' },
        { id: 'unsafe', dbType: 'incident', icon: 'warning', title: 'Ambiente Inseguro', subtitle: 'Peligro' },
        { id: 'harassment', dbType: 'incident', icon: 'error', title: 'Acoso', subtitle: 'Inseguridad' },
        { id: 'security', dbType: 'incident', icon: 'shield_with_heart', title: 'Seguridad', subtitle: 'Autoridades' },
    ];

    const showMessage = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleReport = async () => {
        if (!selectedCategory || !user) return;

        setIsSubmitting(true);
        try {
            // 1. Get location
            const position = await getCurrentPosition();
            const { latitude, longitude } = position.coords;

            // 2. Prepare data
            const categoryData = categories.find(c => c.id === selectedCategory);
            const dbType = (categoryData?.dbType || 'incident') as DangerZoneType;

            // Append category title to description if present
            const fullDescription = customInput
                ? `[${categoryData?.title}] ${customInput}`
                : categoryData?.title || 'Incidente reportado';

            // 3. Insert into Supabase
            const { error } = await (supabase.from('danger_zones') as any)
                .insert({
                    reporter_id: user.id,
                    lat: latitude,
                    lng: longitude,
                    radius: 50, // Default radius
                    type: dbType,
                    description: fullDescription,
                    votes_up: 0,
                    votes_down: 0,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                });

            if (error) throw error;

            showMessage('Incidente reportado exitosamente', 'success');

            // Navigate back after delay
            setTimeout(() => navigate('/'), 1500);

        } catch (error: any) {
            console.error('Error reporting incident:', error);
            
            let userMessage = error.message || 'Error al reportar incidente';
            if (error.code === '23503') {
                userMessage = 'Error de perfil: No se encontró tu perfil de usuario. Contacta con soporte.';
            }
            
            showMessage(userMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCategoryData = categories.find(c => c.id === selectedCategory);

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-black font-display text-white">

            {/* Background Map - Darkened */}
            <div className="absolute inset-0 z-0">
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <img
                        alt="Abstract dark city map layout"
                        className="w-full h-full object-cover opacity-20 grayscale"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDf00bmb_jBo5saKI_L_20dOtUUT_Q4oyAthSILC0IvtvdWGCixD3K2LBX57bTSTWlEqfbTuSAoFEQYMVja0hMRsVc143S8yGDN5GStvZTMiRZU0K4umCDJr8HaDuT2bfgqdH21MkcT-4U6vWjtBnvn_TrQX8dFG4a1HyGtazD569lWUPgiAH8ZFItNnvkO6kLCSsOuCx702ihCjgQWBP6crnX_JVdhundZaLg0gP2BMJysb-pv0Aw0I_K4aCBwJIShsFGVspy2ZKQ"
                    />
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex h-full w-full flex-col pt-12 px-6 overflow-y-auto no-scrollbar">

                {/* Drag Handle / Top Indicator */}
                <div className="flex w-full items-center justify-center shrink-0 mb-6">
                    <div className="h-1.5 w-12 rounded-full bg-zinc-800"></div>
                </div>

                {/* Header */}
                <div className="text-center shrink-0 mb-8">
                    <h2 className="text-3xl font-bold leading-tight text-white mb-2">Reportar un Incidente</h2>
                    <p className="text-zinc-500 text-sm">Ayuda a otros a mantenerse seguros en su ruta</p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-4 shrink-0 mb-8">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            disabled={isSubmitting}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center transition-all bg-zinc-900/80 border",
                                selectedCategory === cat.id
                                    ? "border-red-600 bg-red-900/10"
                                    : "border-transparent hover:bg-zinc-800",
                                isSubmitting && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <div className={clsx(
                                "flex items-center justify-center size-12 rounded-full transition-colors mb-1",
                                selectedCategory === cat.id ? "bg-red-600/20 text-red-600" : "bg-red-900/20 text-red-700/70"
                            )}>
                                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className={clsx("text-[15px] font-bold leading-tight", selectedCategory === cat.id ? "text-white" : "text-zinc-200")}>{cat.title}</span>
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">{cat.subtitle}</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Input */}
                <div className="shrink-0 mb-auto">
                    <label className="block text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3 ml-1">INPUT PERSONALIZADO</label>
                    <div className="relative">
                        <input
                            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl h-14 px-5 text-base text-white placeholder:text-zinc-700 focus:outline-none focus:border-red-600 transition-all disabled:opacity-50"
                            placeholder="Describe el incidente aquí..."
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="pb-10 flex flex-col gap-3 shrink-0">
                    <button
                        onClick={handleReport}
                        disabled={!selectedCategory || isSubmitting}
                        className={clsx(
                            "flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-16 px-5 text-lg font-bold shadow-lg transition-all active:scale-[0.98]",
                            selectedCategory && !isSubmitting
                                ? "bg-red-600 text-white shadow-red-900/20 hover:bg-red-500"
                                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        )}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-2">
                                <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                <span>Enviando...</span>
                            </div>
                        ) : (
                            <span className="truncate">
                                {selectedCategoryData ? `Reportar ${selectedCategoryData.title}` : 'Seleccionar Categoría'}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={clsx(
                    "absolute bottom-28 left-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300",
                    toast.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
                )}>
                    <span className="material-symbols-outlined">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <p className="font-medium text-sm">{toast.message}</p>
                </div>
            )}
        </div>
    );
};
