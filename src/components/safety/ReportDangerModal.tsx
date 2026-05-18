import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Geolocation } from '@capacitor/geolocation';
import clsx from 'clsx';

interface ReportDangerModalProps {
    isOpen: boolean;
    onClose: () => void;
    userLat: number;
    userLng: number;
    onSuccess: () => void;
}

export const ReportDangerModal: React.FC<ReportDangerModalProps> = ({ isOpen, onClose, userLat, userLng, onSuccess }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [selectedType, setSelectedType] = useState<'dark' | 'incident' | 'construction' | 'traffic' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const types = [
        { id: 'incident', icon: 'warning', label: t('map.incident') || 'Incidente' },
        { id: 'dark', icon: 'brightness_3', label: t('map.light_notice') || 'Zona Oscura' },
        { id: 'traffic', icon: 'traffic', label: t('map.traffic') || 'Tráfico' },
        { id: 'construction', icon: 'construction', label: t('map.construction') || 'Obras' }
    ] as const;

    const handleSubmit = async () => {
        if (!selectedType || !user) return;

        setIsSubmitting(true);
        try {
            // Get precise real-time location to place the marker
            let lat = userLat;
            let lng = userLng;
            
            try {
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
                if (pos) {
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                }
            } catch (err) {
                console.warn("Could not get high accuracy location for report, falling back to cached location", err);
            }

            if (!lat || !lng) {
                alert(t('common.error') || 'No se ha podido determinar tu ubicación.');
                setIsSubmitting(false);
                return;
            }

            // Expires in 4 hours
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 4);

            const { error } = await supabase.from('danger_zones').insert({
                reporter_id: user.id,
                lat: lat,
                lng: lng,
                radius: 100,
                type: selectedType,
                description: t(`map.${selectedType}_desc`) || 'Incidencia reportada por usuario',
                expires_at: expiresAt.toISOString()
            });

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error reporting danger:', error);
            alert('Error reportando incidencia. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-10 sm:pb-6 shadow-2xl animate-slide-up sm:animate-scale-in border border-white/10">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden" />
                
                <div className="text-center mb-6">
                    <div className="size-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl font-black">campaign</span>
                    </div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">
                        {t('home.report_danger') || 'Reportar Peligro'}
                    </h3>
                    <p className="text-sm text-white/50 font-medium leading-relaxed">
                        {t('home.report_danger_desc') || 'Avisa a otros usuarios sobre peligros en tu ubicación actual.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    {types.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            className={clsx(
                                "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all",
                                selectedType === type.id 
                                    ? "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                            )}
                        >
                            <span className="material-symbols-outlined text-3xl mb-2">{type.icon}</span>
                            <span className="text-xs font-bold uppercase tracking-widest">{type.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/10 active:scale-95 transition-all"
                    >
                        {t('common.cancel') || 'Cancelar'}
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={!selectedType || isSubmitting}
                        className="flex-[2] py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                    >
                        {isSubmitting ? '...' : (t('common.report') || 'Reportar')}
                    </button>
                </div>
            </div>
        </div>
    );
};
