import React, { useState, useEffect } from 'react';
import { 
    X, 
    ShieldAlert, 
    ShieldCheck, 
    AlertTriangle, 
    Shield,
    MoreHorizontal,
    Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { activateSOS, executeSOSProtocol } from '../../services/sosService';
import { useSOS } from '../../contexts/SOSContext.base';

interface SOSRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    refreshProfile?: () => void;
}

type SOSReason = 'security' | 'medical' | 'fire' | 'other';

const REASONS: { id: SOSReason; label: string; icon: any; color: string }[] = [
    { id: 'security', label: 'Seguridad', icon: ShieldAlert, color: 'bg-red-500' },
    { id: 'medical', label: 'Médico', icon: ShieldCheck, color: 'bg-blue-500' },
    { id: 'fire', label: 'Fuego', icon: AlertTriangle, color: 'bg-orange-500' },
    { id: 'other', label: 'Otro', icon: MoreHorizontal, color: 'bg-zinc-500' },
];

export const SOSRequestModal: React.FC<SOSRequestModalProps> = ({ 
    isOpen, 
    onClose,
    refreshProfile 
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { familyGroup } = useSOS();
    const [isDiscrete, setIsDiscrete] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    useEffect(() => {
        if (isOpen && refreshProfile) {
            refreshProfile();
        }
    }, [isOpen, refreshProfile]);

    const handleActivate = async (reason: SOSReason) => {
        if (!user || !familyGroup) return;
        setIsActivating(true);
        
        const mode = isDiscrete ? 'discrete' : 'visible';

        console.log('[SOS-Modal] Activating Full Protocol...', { reason, mode });

        // Execute Unified Protocol: 112 + Notify Contacts + Location
        const { alert, error } = await executeSOSProtocol(user.id, familyGroup.id, reason);

        if (!error && alert) {
            console.log('[SOS-Modal] Alert created:', alert.id);
            
            // Close modal and redirect to active page
            onClose();
            navigate('/emergency-live', { 
                state: { 
                    alertId: alert.id, 
                    reason: reason,
                    mode: mode
                } 
            });
        } else {
            console.error('[SOS-Modal] Error activating SOS:', error);
            setIsActivating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Content */}
            <div
                className="relative w-full max-w-lg bg-zinc-900 sm:rounded-[32px] overflow-hidden shadow-2xl border-t border-white/10 sm:border animate-slide-up"
            >
                <div className="p-8 space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                                <Shield className="text-red-500" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Confirmar SOS</h2>
                                <p className="text-white/40 text-sm font-medium">Selecciona el motivo de la emergencia</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setIsDiscrete(false)}
                            className={clsx(
                                "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                !isDiscrete ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                            )}
                        >
                            Modo Visible
                        </button>
                        <button
                            onClick={() => setIsDiscrete(true)}
                            className={clsx(
                                "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                isDiscrete ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                            )}
                        >
                            Modo Discreto
                        </button>
                    </div>

                    {/* Reasons Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {REASONS.map((reason) => (
                            <button
                                key={reason.id}
                                onClick={() => handleActivate(reason.id)}
                                disabled={isActivating}
                                className={clsx(
                                    "flex flex-col items-center justify-center p-6 rounded-[24px] border border-white/5 transition-all active:scale-95 text-center space-y-4",
                                    "bg-white/5 hover:bg-white/10 group",
                                    isActivating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <div className={clsx(
                                    "size-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                                    reason.color,
                                    "shadow-lg"
                                )}>
                                    <reason.icon className="text-white" size={28} />
                                </div>
                                <span className="text-sm font-bold text-white uppercase tracking-wider">{reason.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Activating Overlay */}
                    {isActivating && (
                        <div
                            className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center space-y-6 text-center p-12 z-[1001] animate-fade-in"
                        >
                            <div className="relative">
                                <div className="size-24 rounded-full border-4 border-white/10" />
                                <div className="absolute inset-0 border-4 border-red-500 rounded-full border-t-transparent animate-spin" />
                                <ShieldAlert className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 text-white" size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Activando SOS</h3>
                                <p className="text-white/40 text-sm font-medium">Alertando a tus contactos de emergencia y grabando evidencias...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Safe Area Spacer for iOS Home Indicator */}
                <div className="h-safe-bottom bg-black/40" />
            </div>
        </div>
    );
};
