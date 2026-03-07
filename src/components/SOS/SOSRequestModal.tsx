import { useState, useEffect } from 'react';
import { X, ShieldAlert, Eye, EyeOff, Mic, Video } from 'lucide-react';
import { activateSOS, startRecording, stopAndUploadRecording, updateSOSAlertMedia, captureSecuritySnapshot } from '../../services/sosService';
import { useAuth } from '../../contexts/AuthContext';

interface SOSRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRequestUpgrade?: () => void;
}

import type { FamilyGroup } from '../../services/database.types';
import { getFamilyData } from '../../services/familyService';

export function SOSRequestModal({ isOpen, onClose, onRequestUpgrade }: SOSRequestModalProps) {
    const { user, isPremium } = useAuth();
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [mode, setMode] = useState<'visible' | 'discrete'>('visible');
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const [isActive, setIsActive] = useState(false);
    const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);

    useEffect(() => {
        if (user && isOpen) {
            getFamilyData(user.id).then(({ group }) => {
                if (group) setFamilyGroup(group);
            });
        }
    }, [user, isOpen]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isCountingDown && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        } else if (isCountingDown && countdown === 0) {
            handleActivate();
        }
        return () => clearTimeout(timer);
    }, [isCountingDown, countdown]);

    const handleStart = () => {
        setIsCountingDown(true);
    };

    const handleCancel = () => {
        setIsCountingDown(false);
        setCountdown(5);
        setIsActive(false);
        setCurrentAlertId(null);
        onClose();
    };

    const handleActivate = async () => {
        setIsCountingDown(false);
        setIsActive(true);

        // Start recording
        const recordingStarted = await startRecording();
        if (recordingStarted) {
            console.log('🎙️ Recording started');
        }

        if (user && familyGroup) {
            const name = user.profile?.full_name || user.email?.split('@')[0] || 'Un usuario';
            const { alert } = await activateSOS(user.id, familyGroup.id, {
                message: `🚨 EMERGENCIA
${name} está en peligro.

Ha activado una alerta de seguridad.`,
                callPolice: false, // Make configurable
                notifyContacts: true,
                shareLocation: true,
                mode: mode
            });
            if (alert) {
                setCurrentAlertId(alert.id);
                // Si es Premium, captura una foto de seguridad silenciosa
                if (isPremium) {
                    captureSecuritySnapshot(user.id).then(async (url) => {
                        if (url) {
                            await updateSOSAlertMedia(alert.id, url);
                            console.log('📸 Security Snapshot uploaded and linked to alert');
                        }
                    });
                }
            }
        }
    };

    const handleStop = async () => {
        if (user) {
            const url = await stopAndUploadRecording(user.id);
            console.log('✅ Recording uploaded:', url);

            if (url && currentAlertId) {
                // Import this dynamically or assume it's imported (I need to check imports)
                await updateSOSAlertMedia(currentAlertId, url);
                console.log('✅ Evidence linked to alert');
            }
        }
        handleCancel();
    };

    if (!isOpen) return null;

    // Discrete Mode UI (Black Screen - Stealth)
    if (isActive && mode === 'discrete') {
        return (
            <div
                className="fixed inset-0 bg-black z-[9999] flex items-center justify-center cursor-pointer"
                onClick={handleStop}
            >
                {/* Completely black screen to simulate screen off */}
                <div className="w-full h-full bg-black" />
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 ${isActive ? 'bg-red-600 animate-pulse' : 'bg-black/60 backdrop-blur-sm'}`}>
            <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl ${isActive ? 'border-none bg-transparent shadow-none' : ''}`}>
                {!isActive && !isCountingDown ? (
                    // Selection Mode
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-start">
                            <h2 className="text-2xl font-bold text-white">Activar Emergencia</h2>
                            <button onClick={onClose} className="text-zinc-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setMode('visible')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${mode === 'visible'
                                    ? 'border-red-500 bg-red-500/10 text-white'
                                    : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                                    }`}
                            >
                                <Eye size={32} />
                                <span className="font-semibold">Modo Visible</span>
                                <span className="text-xs text-center opacity-70">Disuasorio. Pantalla encendida.</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (!isPremium && onRequestUpgrade) {
                                        onRequestUpgrade();
                                    } else {
                                        setMode('discrete');
                                    }
                                }}
                                className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${mode === 'discrete'
                                    ? 'border-red-500 bg-red-500/10 text-white'
                                    : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                                    }`}
                            >
                                <div className="absolute top-2 right-2 size-6 rounded-full bg-zinc-700 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xs text-yellow-500">lock</span>
                                </div>
                                <EyeOff size={32} />
                                <span className="font-semibold">Modo Discreto</span>
                                <span className="text-xs text-center opacity-70">Pantalla apagada. Sin señales.</span>
                            </button>
                        </div>

                        <div className="bg-zinc-800/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-zinc-300 mb-2">
                                <Mic size={16} /> <span>Grabación de audio automática</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-300">
                                <Video size={16} /> <span>Grabación de vídeo (si es posible)</span>
                            </div>
                        </div>

                        <button
                            onClick={handleStart}
                            className="w-full py-4 text-xl font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
                        >
                            ACTIVAR AHORA
                        </button>
                    </div>
                ) : (
                    // Countdown or Active Visible Mode
                    <div className="flex flex-col items-center text-center space-y-8 w-full">
                        {isCountingDown ? (
                            <div className="p-8 bg-red-600 w-full rounded-2xl">
                                <h2 className="text-white text-3xl font-bold mb-4">Activando en...</h2>
                                <div className="text-9xl font-black text-white mb-8">{countdown}</div>
                                <button
                                    onClick={handleCancel}
                                    className="px-8 py-3 bg-white text-red-600 font-bold rounded-full text-xl"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        ) : (
                            // Active Visible Mode (Deterrent)
                            <div className="fixed inset-0 bg-red-600 animate-pulse flex flex-col items-center justify-center z-50 space-y-12">
                                <ShieldAlert size={120} className="text-white" />
                                <div>
                                    <h1 className="text-5xl font-black text-white mb-4 tracking-wider">AYUDA</h1>
                                    <h2 className="text-3xl font-bold text-white mb-2">EMERGENCIA</h2>
                                    <p className="text-white/90 text-xl font-medium">Enviando ubicación y audio...</p>
                                </div>
                                <button
                                    onClick={handleStop}
                                    className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-xl transform active:scale-95 transition-transform"
                                >
                                    <div className="w-8 h-8 bg-red-600 rounded-sm" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
