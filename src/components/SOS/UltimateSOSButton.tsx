import React, { useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { activateSOS } from '../../services/sosService';
import { createFamilyGroup, getFamilyGroup } from '../../services/familyService';
import clsx from 'clsx';

export const UltimateSOSButton: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isActivating, setIsActivating] = useState(false);

    const handleQuickPress = async () => {
        console.log('[Ultimate-SOS] Clicked!');
        if (isActivating) return;
        if (!user) {
            window.alert('Error: Sesión no iniciada');
            return;
        }

        try {
            setIsActivating(true);
            console.log('[Ultimate-SOS] Starting activation...');

            // 1. Get real group (since profile doesn't have group_id column)
            let group = await getFamilyGroup(user.id);
            
            // 2. AUTO-FIX: Create private group if missing
            if (!group) {
                console.log('[Ultimate-SOS] Auto-creating circle...');
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

            // Minimal feedback delay
            await new Promise(r => setTimeout(r, 200));

            const { alert: sosAlert, error } = await activateSOS(user.id, group.id, {
                message: `🚨 EMERGENCIA CRÍTICA\nActivada mediante Botón Directo.`,
                callPolice: true,
                notifyContacts: true,
                shareLocation: true,
                mode: 'visible',
                type: 'security'
            });

            if (error) {
                throw new Error(error);
            }

            if (sosAlert) {
                console.log('[Ultimate-SOS] Success! Redirecting...');
                // Direct navigation with small safety delay
                setTimeout(() => {
                    navigate('/emergency-live', { 
                        state: { 
                            alertId: sosAlert.id,
                            reason: 'security',
                            mode: 'visible'
                        },
                        replace: true 
                    });
                }, 300);
            }
        } catch (err: any) {
            console.error('[Ultimate-SOS] Failed:', err);
            window.alert('SOS Error: ' + (err.message || 'Error desconocido'));
            setIsActivating(false);
        }
    };

    return (
        <>
            <button
                onClick={handleQuickPress}
                onTouchStart={(e) => {
                    handleQuickPress();
                    e.stopPropagation();
                    e.preventDefault();
                }}
                disabled={isActivating}
                className={clsx(
                    "flex items-center gap-3 px-8 py-3.5 bg-red-600 text-white rounded-full text-base font-black uppercase tracking-tighter shrink-0 relative overflow-hidden active:scale-95 transition-all shadow-xl",
                    isActivating && "opacity-50"
                )}
            >
                {isActivating ? (
                    <Loader2 className="animate-spin" size={20} />
                ) : (
                    <ShieldAlert size={20} />
                )}
                
                <span className="relative z-10">
                    {isActivating ? 'ACTIVANDO...' : 'S.O.S'}
                </span>

                {!isActivating && (
                    <div className="absolute inset-0 rounded-full animate-ping bg-white/20 pointer-events-none" />
                )}
            </button>

            {/* Ultra-simple Fullscreen Overlay */}
            {isActivating && (
                <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-8 text-center">
                    <div className="size-20 rounded-full bg-red-600 flex items-center justify-center animate-pulse mb-8">
                        <ShieldAlert size={40} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase mb-4 tracking-tighter">Activando Alerta</h2>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] animate-pulse">
                        Conectando con autoridades y contactos...
                    </p>
                </div>
            )}
        </>
    );
};
