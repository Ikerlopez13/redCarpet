import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Geolocation } from '@capacitor/geolocation';
import {
    Lightbulb, AlertTriangle, Accessibility, Users,
    Ban, Wrench, Shield, Megaphone
} from 'lucide-react';

interface ReportDangerModalProps {
    isOpen: boolean;
    onClose: () => void;
    userLat: number | null;
    userLng: number | null;
    onSuccess?: () => void;
}

const TYPES = [
    {
        id: 'dark_light',
        dbType: 'dark',
        label: 'Poca luz',
        subtitle: 'BAJA VISIBILIDAD',
        Icon: Lightbulb,
        iconColor: 'text-yellow-400',
        circleBg: 'bg-yellow-900/70',
    },
    {
        id: 'unsafe_env',
        dbType: 'incident',
        label: 'Ambiente Inseguro',
        subtitle: 'PELIGRO',
        Icon: AlertTriangle,
        iconColor: 'text-red-500',
        circleBg: 'bg-red-900/70',
    },
    {
        id: 'limited_access',
        dbType: 'incident',
        label: 'Acceso limitado',
        subtitle: 'MOVILIDAD REDUCIDA',
        Icon: Accessibility,
        iconColor: 'text-purple-400',
        circleBg: 'bg-purple-900/70',
    },
    {
        id: 'safe_access',
        dbType: 'safe',
        label: 'Acceso seguro',
        subtitle: 'MOVILIDAD REDUCIDA',
        Icon: Accessibility,
        iconColor: 'text-green-400',
        circleBg: 'bg-green-900/70',
    },
    {
        id: 'inclusive_zone',
        dbType: 'incident',
        label: 'Zona inclusiva',
        subtitle: 'INCLUSIVIDAD',
        Icon: Users,
        iconColor: 'text-pink-400',
        circleBg: 'bg-purple-800/70',
    },
    {
        id: 'road_closed',
        dbType: 'incident',
        label: 'Calle cortada',
        subtitle: 'VIALIDAD',
        Icon: Ban,
        iconColor: 'text-orange-400',
        circleBg: 'bg-orange-900/70',
    },
    {
        id: 'bad_road',
        dbType: 'incident',
        label: 'Calle en mal estado',
        subtitle: 'VIALIDAD',
        Icon: Wrench,
        iconColor: 'text-teal-400',
        circleBg: 'bg-teal-900/70',
    },
    {
        id: 'authorities',
        dbType: 'safe',
        label: 'Autoridades presentes',
        subtitle: 'SEGURIDAD',
        Icon: Shield,
        iconColor: 'text-blue-400',
        circleBg: 'bg-blue-900/70',
    },
] as const;

export const ReportDangerModal: React.FC<ReportDangerModalProps> = ({ isOpen, onClose, userLat, userLng, onSuccess }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!selectedType || !user) return;

        const typeObj = TYPES.find(t => t.id === selectedType);
        if (!typeObj) return;

        setIsSubmitting(true);
        try {
            let lat: number | null = userLat;
            let lng: number | null = userLng;

            try {
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
                if (pos) {
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                }
            } catch (err) {
                console.warn('Could not get high accuracy location for report, falling back to cached location', err);
            }

            if (lat == null || lng == null) {
                alert('No se ha podido determinar tu ubicación. Activa el GPS e inténtalo de nuevo.');
                setIsSubmitting(false);
                return;
            }

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 2);

            const { IncidentQueueService } = await import('../../services/incidentQueueService');
            await IncidentQueueService.enqueueIncident({
                reporter_id: user.id,
                lat,
                lng,
                radius: 100,
                type: typeObj.dbType as any,
                description: `${typeObj.label} - ${typeObj.subtitle}`,
                expires_at: expiresAt.toISOString(),
                votes_up: 0,
                votes_down: 0,
            });

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
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-fade-in">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-[#0e0e12] rounded-t-[2rem] flex flex-col max-h-[92vh] shadow-2xl">
                {/* Drag handle */}
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-2">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="size-16 rounded-full bg-red-950 flex items-center justify-center mb-4">
                            <Megaphone size={28} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">
                            REPORTAR INCIDENCIA
                        </h3>
                        <p className="text-sm text-white/60 font-normal leading-relaxed max-w-xs">
                            Avisa a otros usuarios sobre peligros en tu ubicación actual.
                        </p>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {TYPES.map(({ id, label, subtitle, Icon, iconColor, circleBg }) => {
                            const selected = selectedType === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setSelectedType(id)}
                                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-[1.4rem] border transition-all active:scale-95 ${
                                        selected
                                            ? 'bg-white/10 border-white/30'
                                            : 'bg-[#18181f] border-white/[0.06] hover:bg-white/5'
                                    }`}
                                >
                                    <div className={`size-12 rounded-full ${circleBg} flex items-center justify-center`}>
                                        <Icon size={22} className={iconColor} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-white leading-snug">{label}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mt-0.5">{subtitle}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom buttons */}
                <div className="flex gap-3 px-5 pt-4 pb-8 shrink-0 bg-[#0e0e12]">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-white font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedType || isSubmitting}
                        className="flex-[2.5] py-4 bg-red-900 text-white/70 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                    >
                        {isSubmitting ? '...' : 'REPORTAR'}
                    </button>
                </div>
            </div>
        </div>
    );
};
