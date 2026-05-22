import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ShieldAlert, 
    ChevronLeft, 
    Info, 
    Settings, 
    Zap, 
    Activity,
    Lock,
    Shield,
    Grid
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext.base';
import { executeSOSProtocol } from '../services/sosService';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export const Emergency: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    const { familyGroup } = useSOS();
    const [isActivating, setIsActivating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStartSOS = async () => {
        if (!user || isActivating) return;
        
        setIsActivating(true);
        setError(null);

        try {
            console.log('[Emergency-Page] Single-click SOS Triggered');
            
            // 1. Get or create group to ensure it never fails
            const { getFamilyGroup, createFamilyGroup } = await import('../services/familyService');
            let group = familyGroup;
            if (!group) {
                group = await getFamilyGroup(user.id);
            }
            if (!group) {
                console.log('[Emergency-Page] Auto-creating circle...');
                const { group: newGroup, error: groupError } = await createFamilyGroup(
                    "Mi Círculo",
                    "parental", 
                    user.id
                );
                if (groupError || !newGroup) {
                    throw new Error(groupError || "No se pudo crear el grupo de seguridad.");
                }
                group = newGroup;
            }

            // Execute the full SOS protocol (112 + Contacts + Location)
            const { alert, error: sosError } = await executeSOSProtocol(user.id, group.id, 'security');

            if (sosError || !alert) {
                throw new Error(sosError || 'Error al activar el protocolo SOS');
            }

            console.log('[Emergency-Page] SOS Activated successfully');
            
            // Redirect to the live tracking page
            navigate('/emergency-live', { 
                state: { 
                    alertId: alert.id,
                    reason: 'security',
                    mode: 'visible'
                },
                replace: true
            });
        } catch (err: any) {
            console.error('[Emergency-Page] SOS Activation failed:', err);
            setError(err.message || 'Error al activar SOS. Por favor, intenta de nuevo.');
            setIsActivating(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display relative">
            {/* Rich Background with Animated Gradients */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_40%,_rgba(220,38,38,0.15)_0%,_transparent_70%)]" />
                <div className="absolute -bottom-[20%] -left-[10%] size-[80vw] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute top-[10%] -right-[10%] size-[60vw] bg-red-600/5 rounded-full blur-[100px]" />
                
                {/* Grid Pattern Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-12 pb-6 backdrop-blur-sm bg-black/20">
                <button 
                    onClick={() => navigate(-1)} 
                    className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-xl font-black uppercase italic tracking-tighter text-white/90">Central de Seguridad</h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">En Línea • Escudo IA Activo</span>
                    </div>
                </div>
                <button 
                    onClick={() => navigate('/settings')}
                    className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors"
                >
                    <Settings size={20} />
                </button>
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center">
                {/* Main SOS Launcher */}
                <div className="relative group mb-12">
                    {/* Multi-layered animations for the button */}
                    <div className="absolute inset-0 bg-red-600 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                    <div className="absolute inset-0 bg-red-600 rounded-full blur-[80px] opacity-10 animate-pulse delay-700" />
                    
                    <button
                        onClick={handleStartSOS}
                        disabled={isActivating}
                        className={clsx(
                            "relative size-64 rounded-full flex flex-col items-center justify-center transition-all duration-500",
                            "bg-gradient-to-br from-red-500 via-red-600 to-red-800",
                            "border-8 border-white/10 shadow-[0_20px_50px_rgba(220,38,38,0.5)]",
                            "active:scale-90 active:shadow-inner disabled:opacity-50",
                            isActivating && "animate-pulse"
                        )}
                    >
                        {isActivating ? (
                            <Zap size={64} className="text-white animate-bounce" />
                        ) : (
                            <>
                                <h2 className="text-7xl font-black text-white italic tracking-tighter mb-1 drop-shadow-2xl">SOS</h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Pulsar para lanzar</p>
                            </>
                        )}
                        
                        {/* Internal decorative ring */}
                        <div className="absolute inset-4 rounded-full border border-white/20 pointer-events-none" />
                        <div className="absolute inset-8 rounded-full border border-white/10 pointer-events-none" />
                    </button>
                </div>

                {/* Status & Messages */}
                <div className="max-w-[280px] space-y-6">
                    {error ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 animate-shake">
                            <p className="text-red-500 text-xs font-bold uppercase tracking-tight">{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-white/90">Protocolo de Emergencia</p>
                            <p className="text-[10px] text-white/40 font-medium leading-relaxed uppercase tracking-widest">
                                En un solo clic se avisará al 112 y a tu círculo de seguridad compartiendo tu ubicación real.
                            </p>
                        </div>
                    )}

                    {/* Feature Indicators */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                            <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                                <Activity size={14} />
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-white/40">GPS Vivo</span>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                            <div className="p-1.5 bg-orange-500/20 rounded-lg text-orange-400">
                                <Shield size={14} />
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-white/40">112 Enlace</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Widgets & Discreet SOS banner */}
            <div className="relative z-10 px-8">
                <button
                    onClick={() => navigate('/widgets')}
                    className="w-full flex items-center justify-between p-5 rounded-[2rem] bg-gradient-to-r from-amber-500/20 to-amber-700/10 border border-amber-500/30 hover:from-amber-500/30 transition-all active:scale-[0.98]"
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className="size-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                            <Grid size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-black italic uppercase tracking-tighter text-white">Widgets y SOS Discreto</p>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Configurar widgets y patrón secreto</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-white/40">chevron_right</span>
                </button>
            </div>

            {/* Footer Legal/Info */}
            <div className="relative z-10 p-8 pb-32">
                <div className="bg-white/5 border border-white/5 rounded-3xl p-4 flex gap-4 items-center">
                    <div className="size-10 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 shrink-0">
                        <Info size={20} />
                    </div>
                    <p className="text-[9px] text-white/30 font-medium leading-relaxed uppercase tracking-wider">
                        Urban Guide no es un servicio de emergencias oficial. Facilita la comunicación con tus contactos y autoridades.
                    </p>
                </div>
            </div>
        </div>
    );
};