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
    onSuccess?: () => void;
}

export const ReportDangerModal: React.FC<ReportDangerModalProps> = ({ isOpen, onClose, userLat, userLng, onSuccess }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    // Cada tipo tiene su color propio (se usa con estilos inline para que Tailwind no purgue las clases)
    const types = [
        { id: 'dark_light', dbType: 'dark', icon: 'lightbulb', label: 'Poca luz', subtitle: 'BAJA VISIBILIDAD', color: '#eab308' },
        { id: 'unsafe_env', dbType: 'incident', icon: 'warning', label: 'Ambiente Inseguro', subtitle: 'PELIGRO', color: '#ef4444' },
        { id: 'limited_mobility', dbType: 'incident', icon: 'accessible', label: 'Acceso limitado', subtitle: 'MOVILIDAD REDUCIDA', color: '#a855f7' },
        { id: 'safe_mobility', dbType: 'incident', icon: 'wheelchair_pickup', label: 'Acceso seguro', subtitle: 'MOVILIDAD REDUCIDA', color: '#22c55e' },
        { id: 'inclusive_zone', dbType: 'incident', icon: 'diversity_3', label: 'Zona inclusiva', subtitle: 'INCLUSIVIDAD', color: '#ec4899' },
        { id: 'street_closed', dbType: 'incident', icon: 'block', label: 'Calle cortada', subtitle: 'VIALIDAD', color: '#f97316' },
        { id: 'street_damaged', dbType: 'incident', icon: 'construction', label: 'Calle en mal estado', subtitle: 'VIALIDAD', color: '#14b8a6' },
        { id: 'security', dbType: 'incident', icon: 'shield', label: 'Autoridades presentes', subtitle: 'SEGURIDAD', color: '#3b82f6' }
    ] as const;

    const handleSubmit = async () => {
        if (!selectedType || !user) return;

        const typeObj = types.find(t => t.id === selectedType);
        if (!typeObj) return;

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

            const { data: newZone, error } = await supabase
                .from('danger_zones')
                .insert({
                    reporter_id: user.id,
                    lat: lat,
                    lng: lng,
                    radius: 100,
                    type: typeObj.dbType,
                    description: `${typeObj.label} - ${typeObj.subtitle}`, // Stores e.g. "Acoso - INSEGURIDAD"
                    expires_at: expiresAt.toISOString(),
                    votes_up: 0,
                    votes_down: 0
                })
                .select()
                .single();

            if (error) {
                console.error("Supabase insert error details:", error);
                throw error;
            }

            // Trigger native push notifications to contacts/family members via edge function
            if (newZone) {
                supabase.functions.invoke('send-sos-notifications', {
                    body: {
                        alertId: newZone.id,
                        userId: user.id,
                        config: {
                            message: `⚠️ Aviso de peligro: ${typeObj.label} (${typeObj.subtitle})`,
                            isDangerZone: true
                        }
                    }
                }).catch(err => console.error("Error triggering push for danger zone:", err));
            }

            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('Error reporting danger:', error);
            alert(`Error reportando incidencia: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-sm bg-[#121216] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-10 sm:pb-6 shadow-2xl animate-slide-up sm:animate-scale-in border border-white/10">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden" />
                
                <div className="text-center mb-6">
                    <div className="size-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl font-black">campaign</span>
                    </div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">
                        {t('home.report_danger') || 'Reportar Peligro'}
                    </h3>
                    <p className="text-sm text-white/50 font-medium leading-relaxed">
                        {t('home.report_danger_desc') || 'Avisa a otros usuarios sobre peligros en tu ubicación actual.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3.5 mb-8">
                    {types.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            style={selectedType === type.id ? { borderColor: type.color, boxShadow: `0 0 20px ${type.color}26` } : undefined}
                            className={clsx(
                                "flex flex-col items-center justify-center p-4 rounded-[1.8rem] border transition-all h-[135px]",
                                selectedType === type.id
                                    ? "bg-white/10 text-white scale-[1.02]"
                                    : "bg-[#18181f]/80 border-white/[0.04] text-white/80 hover:bg-white/5"
                            )}
                        >
                            {/* Circular Icon Container */}
                            <div
                                className="size-10 rounded-full flex items-center justify-center mb-3"
                                style={{ backgroundColor: `${type.color}${selectedType === type.id ? '33' : '1f'}`, color: type.color }}
                            >
                                <span className="material-symbols-outlined text-lg font-bold">{type.icon}</span>
                            </div>
                            
                            {/* Text Group */}
                            <span className="text-sm font-bold text-white mb-0.5">{type.label}</span>
                            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/40">{type.subtitle}</span>
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
                        className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                    >
                        {isSubmitting ? '...' : (t('common.report') || 'Reportar')}
                    </button>
                </div>
            </div>
        </div>
    );
};
