import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { DangerZone } from '../../services/database.types';

interface AlertDetailsModalProps {
    zoneId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onAlertDeleted: () => void;
}

export const AlertDetailsModal: React.FC<AlertDetailsModalProps> = ({ zoneId, isOpen, onClose, onAlertDeleted }) => {
    const { t } = useTranslation();
    const [zone, setZone] = useState<DangerZone | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isVoting, setIsVoting] = useState(false);

    useEffect(() => {
        if (isOpen && zoneId) {
            if (zoneId.startsWith('zone-bcn')) {
                // Mock zone for demo
                setZone({
                    id: zoneId,
                    reporter_id: 'system',
                    lat: 0,
                    lng: 0,
                    radius: 50,
                    type: 'incident',
                    description: zoneId === 'zone-bcn-1' ? 'Poca Luz - MEJORA DE ILUMINACIÓN' : 'Zona de Atención - INCIDENTE VIAL',
                    votes_up: 5,
                    votes_down: 0,
                    created_at: new Date().toISOString(),
                    expires_at: null
                });
                return;
            }

            const fetchZone = async () => {
                setIsLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('danger_zones')
                        .select('*')
                        .eq('id', zoneId)
                        .single();
                    
                    if (error) throw error;
                    setZone(data);
                } catch (error) {
                    console.error("Error fetching zone:", error);
                    onClose();
                } finally {
                    setIsLoading(false);
                }
            };
            fetchZone();
        } else {
            setZone(null);
        }
    }, [zoneId, isOpen]);

    const handleVote = async (isUpvote: boolean) => {
        if (!zone || zone.id.startsWith('zone-bcn')) {
            onClose();
            return;
        }

        setIsVoting(true);
        try {
            if (!isUpvote) {
                // Delete immediately on false alarm
                const { error } = await supabase.from('danger_zones').delete().eq('id', zone.id);
                if (error) throw error;
                onAlertDeleted();
                onClose();
                return;
            }

            const newVotesUp = zone.votes_up + 1;
            
            const { error } = await supabase
                .from('danger_zones')
                .update({ votes_up: newVotesUp })
                .eq('id', zone.id);

            if (error) throw error;
            onClose();
        } catch (error) {
            console.error("Error voting:", error);
            alert("No se pudo registrar el voto.");
        } finally {
            setIsVoting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-sm bg-[#121216] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-10 sm:pb-6 shadow-2xl animate-slide-up sm:animate-scale-in border border-white/10">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden" />
                
                {isLoading ? (
                    <div className="flex justify-center items-center py-10">
                        <div className="animate-spin size-8 border-4 border-red-500 border-t-transparent rounded-full" />
                    </div>
                ) : zone ? (
                    <>
                        <div className="text-center mb-6">
                            <div className="size-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                                <span className="material-symbols-outlined text-3xl font-black">warning</span>
                            </div>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">
                                Alerta Activa
                            </h3>
                            <p className="text-sm text-white/70 font-medium leading-relaxed bg-white/5 rounded-xl p-3 border border-white/10">
                                {zone.description || 'Peligro reportado en esta zona'}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => handleVote(true)}
                                disabled={isVoting}
                                className="w-full py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                Confirmar (Sigue ahí)
                            </button>
                            <button 
                                onClick={() => handleVote(false)}
                                disabled={isVoting}
                                className="w-full py-4 bg-white/5 text-white/60 border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-base">cancel</span>
                                Falsa Alarma / Ya no está
                            </button>
                            
                            <button 
                                onClick={onClose}
                                className="w-full py-3 text-white/40 text-xs uppercase tracking-widest font-bold mt-2"
                            >
                                Cerrar
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-10 text-white/50">
                        No se pudo cargar la alerta
                    </div>
                )}
            </div>
        </div>
    );
};
