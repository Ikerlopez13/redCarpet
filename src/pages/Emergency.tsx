import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Loader2, Info, MapPin, Users, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { activateSOS } from '../services/sosService';
import { createFamilyGroup, getFamilyGroup } from '../services/familyService';
import clsx from 'clsx';

export const Emergency: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isActivating, setIsActivating] = useState(false);
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { exact: 'user' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsCameraInitialized(true);
            } catch (err) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'user' } }
                    });
                    if (videoRef.current) videoRef.current.srcObject = stream;
                    setIsCameraInitialized(true);
                } catch (fallbackErr) {
                    console.error('[SOS-Camera] All camera attempts failed:', fallbackErr);
                }
            }
        };
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleStartSOS = async () => {
        if (isActivating || showSuccessOverlay) return;
        if (!user) {
            window.alert('Error: Sesión no iniciada');
            return;
        }
        setIsActivating(true);
        setStatusMessage("Verificando grupo...");
        try {
            let group = await getFamilyGroup(user.id);
            if (!group) {
                setStatusMessage("Creando Círculo...");
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
            setStatusMessage("Alertando...");
            const { alert: sosAlert, error } = await activateSOS(user.id, group.id, {
                message: `🚨 SOS ACTIVADO\nUbicación y cámara en vivo compartidas.`,
                callPolice: true,
                notifyContacts: true,
                shareLocation: true,
                mode: 'visible',
                type: 'security'
            });
            if (error) throw new Error(error);
            if (sosAlert) {
                setShowSuccessOverlay(true);
                await new Promise(r => setTimeout(r, 2500));
                navigate('/emergency-live', {
                    state: {
                        alertId: sosAlert.id,
                        reason: 'security',
                        mode: 'visible'
                    },
                    replace: true
                });
            }
        } catch (err: any) {
            console.error('[SOS-Handle] Activation failed:', err);
            window.alert('Fallo al activar SOS: ' + (err.message || 'Error desconocido'));
            setIsActivating(false);
            setStatusMessage(null);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-black text-white font-display overflow-hidden relative">
            {showSuccessOverlay && (
                <div className="absolute inset-0 z-50 bg-red-600/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                    <div className="size-24 rounded-3xl bg-white flex items-center justify-center text-red-600 mb-8 shadow-2xl">
                        <CheckCircle2 size={64} strokeWidth={3} />
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic mb-4 leading-none">
                        Protocolo Iniciado
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                            <p className="text-lg font-bold">🚨 Se ha alertado a las autoridades</p>
                        </div>
                        <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                            <p className="text-lg font-bold">📱 Se ha avisado a tus contactos</p>
                        </div>
                    </div>
                    <p className="mt-12 text-sm font-black text-white/50 uppercase tracking-[0.3em] animate-pulse">
                        Sincronizando Streaming...
                    </p>
                </div>
            )}
            <div className="absolute inset-0 z-0">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1] opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none" />
            </div>
            <div className="relative z-10 flex flex-col h-full w-full p-6 pt-12">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                         <div className="p-2.5 bg-red-600/20 backdrop-blur-md rounded-2xl text-red-500 border border-red-500/20">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Seguridad Directa</h1>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1">Lanzador Frontal Preparado</p>
                        </div>
                    </div>
                </div>
                {isActivating && !showSuccessOverlay && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 flex items-center gap-3 animate-bounce">
                        <Loader2 className="animate-spin text-red-500" size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">{statusMessage}</span>
                    </div>
                )}
                <div className="mt-auto space-y-8 flex flex-col items-center pb-8 border-t border-white/5 pt-8 backdrop-blur-sm bg-black/20 rounded-t-[3rem]">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 italic mb-4">Pulsa para Alertar</span>
                        <button
                            onClick={handleStartSOS}
                            disabled={isActivating}
                            className="group relative size-24 active:scale-90 transition-all outline-none"
                        >
                            <div className="absolute inset-0 rounded-full border-[4px] border-white/20 group-active:scale-110 transition-all" />
                            <div className={clsx(
                                "absolute inset-2 rounded-full flex items-center justify-center transition-all",
                                isActivating ? "bg-red-700" : "bg-white"
                            )}>
                                {isActivating ? (
                                    <Loader2 className="animate-spin text-white" size={32} />
                                ) : (
                                    <div className="size-12 rounded-full border-[8px] border-black/5 flex items-center justify-center">
                                        <div className="size-4 rounded-[2px] bg-red-600" />
                                    </div>
                                )}
                            </div>
                            {!isActivating && (
                                <div className="absolute inset-0 rounded-full border border-red-500/50 animate-[ping_3s_infinite]" />
                            )}
                        </button>
                    </div>
                    <div className="w-full max-w-xs grid grid-cols-2 gap-2 mt-4">
                         <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-xl p-3 flex items-center gap-2">
                            <MapPin size={12} className="text-red-500" />
                            <span className="text-[10px] font-black tracking-tighter text-white/60">GPS OK</span>
                         </div>
                         <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-xl p-3 flex items-center gap-2">
                            <Users size={12} className="text-red-500" />
                            <span className="text-[10px] font-black tracking-tighter text-white/60">CIRCULO OK</span>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};