import { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert, Video, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { activateSOS, startRecording, stopAndUploadRecording, updateSOSAlertMedia, captureSecuritySnapshot } from '../../services/sosService';
import { useAuth } from '../../contexts/AuthContext';
import { useSOS } from '../../contexts/SOSContext';

interface SOSRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'discrete' | 'visible';
    onRequestUpgrade?: () => void;
}

export type SOSReason = 'medical' | 'security' | 'fire' | 'accident' | 'harassment' | 'other';

export function SOSRequestModal({ isOpen, onClose, initialMode }: SOSRequestModalProps) {
    const { user, isPremium, refreshProfile } = useAuth();
    const { familyGroup } = useSOS();
    const [mode] = useState<'visible' | 'discrete'>(initialMode || 'visible');
    const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
    const [step, setStep] = useState<'reason' | 'active' | 'pin'>('reason');

    // PIN Verification
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);

    // Live Camera Feeds
    const [userStream, setUserStream] = useState<MediaStream | null>(null);
    const [envStream, setEnvStream] = useState<MediaStream | null>(null);
    const userVideoRef = useRef<HTMLVideoElement>(null);
    const envVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (refreshProfile) refreshProfile();
            setStep('reason');
            setCurrentAlertId(null);
            setPinInput('');
            setPinError(false);
            stopDualCamera();
        } else {
            stopDualCamera();
        }
    }, [isOpen]);

    // Handle video feed assignment
    useEffect(() => {
        if (userStream && userVideoRef.current) {
            userVideoRef.current.srcObject = userStream;
        }
    }, [userStream]);

    useEffect(() => {
        if (envStream && envVideoRef.current) {
            envVideoRef.current.srcObject = envStream;
        }
    }, [envStream]);

    const stopDualCamera = () => {
        userStream?.getTracks().forEach(t => t.stop());
        envStream?.getTracks().forEach(t => t.stop());
        setUserStream(null);
        setEnvStream(null);
    };

    const handleActivate = async (reason: SOSReason) => {
        setStep('active');

        const recordingResult = await startRecording(isPremium);
        if (recordingResult.success && recordingResult.stream) {
            setUserStream(recordingResult.stream);

            if (isPremium && navigator.mediaDevices.getUserMedia) {
                try {
                    const eStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' },
                        audio: false
                    });
                    setEnvStream(eStream);
                } catch (e) {
                    console.warn('Could not launch environment camera for dual preview', e);
                }
            }
        }

        if (user && familyGroup) {
            const name = user.profile?.full_name || user.email?.split('@')[0] || 'Un usuario';
            const { alert } = await activateSOS(user.id, familyGroup.id, {
                message: `⚠️ ALERTA: ${reason.toUpperCase()}
Nombre: ${name}
                
Ha activado una alerta de seguridad de alta prioridad.`,
                callPolice: false,
                notifyContacts: true,
                shareLocation: true,
                mode: mode,
                type: reason
            });

            if (alert) {
                setCurrentAlertId(alert.id);
                if (isPremium) {
                    captureSecuritySnapshot(user.id).then(async (url) => {
                        if (url) {
                            await updateSOSAlertMedia(alert.id, url);
                        }
                    });
                }
            }
        }
    };

    const handleStopAttempt = () => {
        const userPin = user?.profile?.sos_pin;
        if (userPin) {
            setStep('pin');
        } else {
            handleFinalStop();
        }
    };

    const handlePinKeyPress = (key: string) => {
        setPinError(false);
        if (pinInput.length < 4) {
            const newPin = pinInput + key;
            setPinInput(newPin);

            if (newPin.length === 4) {
                if (newPin === user?.profile?.sos_pin) {
                    handleFinalStop();
                } else {
                    setPinError(true);
                    setTimeout(() => {
                        setPinInput('');
                        setPinError(false);
                    }, 1000);
                }
            }
        }
    };

    const handleFinalStop = async () => {
        if (user) {
            const url = await stopAndUploadRecording(user.id);
            if (url && currentAlertId) {
                await updateSOSAlertMedia(currentAlertId, url);
            }
        }
        stopDualCamera();
        onClose();
    };

    if (!isOpen) return null;

    const reasons: { id: SOSReason; label: string; icon: string; subtitle: string }[] = [
        { id: 'security', label: 'Seguridad', icon: 'shield', subtitle: 'Peligro Directo' },
        { id: 'medical', label: 'Médica', icon: 'medical_services', subtitle: 'Urgencia Salud' },
        { id: 'harassment', label: 'Acoso', icon: 'visibility', subtitle: 'Ambiente Hostil' },
        { id: 'fire', label: 'Fuego', icon: 'local_fire_department', subtitle: 'Incendio' },
        { id: 'accident', label: 'Accidente', icon: 'minor_crash', subtitle: 'Vial / Caída' },
        { id: 'other', label: 'Otro', icon: 'warning', subtitle: 'Ayuda General' },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={clsx(
                    "fixed inset-0 z-50 flex flex-col items-center justify-center p-0",
                    step === 'active' || step === 'pin' ? "bg-red-600" : "bg-black"
                )}
            >
                {/* Background Map */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="w-full h-full bg-black flex items-center justify-center">
                        <img
                            alt="Abstract dark city map layout"
                            className="w-full h-full object-cover opacity-20 grayscale"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDf00bmb_jBo5saKI_L_20dOtUUT_Q4oyAthSILC0IvtvdWGCixD3K2LBX57bTSTWlEqfbTuSAoFEQYMVja0hMRsVc143S8yGDN5GStvZTMiRZU0K4umCDJr8HaDuT2bfgqdH21MkcT-4U6vWjtBnvn_TrQX8dFG4a1HyGtazD569lWUPgiAH8ZFItNnvkO6kLCSsOuCx702ihCjgQWBP6crnX_JVdhundZaLg0gP2BMJysb-pv0Aw0I_K4aCBwJIShsFGVspy2ZKQ"
                        />
                        <div className={clsx(
                            "absolute inset-0 transition-all duration-700",
                            step === 'active' || step === 'pin' ? "bg-red-600/60" : "bg-black/60",
                            "backdrop-blur-md"
                        )} />
                    </div>
                </div>

                <div className="relative z-10 flex h-full w-full flex-col pt-12 px-6 overflow-y-auto no-scrollbar max-w-lg mx-auto text-white">
                    {step === 'reason' && (
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col h-full">
                            <div className="flex w-full items-center justify-center shrink-0 mb-6">
                                <div className="h-1.5 w-12 rounded-full bg-zinc-800"></div>
                            </div>
                            <button onClick={onClose} className="absolute top-4 right-0 text-white/40 hover:text-white p-2">
                                <X size={24} />
                            </button>
                            <div className="text-center shrink-0 mb-8">
                                <h2 className="text-4xl font-black leading-tight mb-2">SOS</h2>
                                <p className="text-white/50 text-sm font-medium">Pulsa el motivo para activar la protección instantánea</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-10 pb-10">
                                {reasons.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleActivate(cat.id)}
                                        className="flex flex-col items-center justify-center gap-3 rounded-[32px] p-6 text-center transition-all bg-zinc-900/80 border border-white/5 hover:border-red-600/50 hover:bg-zinc-800 active:scale-95 group"
                                    >
                                        <div className="flex items-center justify-center size-14 rounded-full bg-red-600/10 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all shadow-lg shadow-red-900/10">
                                            <span className="material-symbols-outlined text-3xl font-light">{cat.icon}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            <span className="text-lg font-black">{cat.label}</span>
                                            <span className="text-[10px] text-white/40 uppercase font-black tracking-widest leading-none">{cat.subtitle}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 'active' && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center h-full pt-10">
                            {mode === 'visible' ? (
                                <>
                                    <div className="text-center space-y-2 mb-10">
                                        <motion.div
                                            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                                            transition={{ repeat: Infinity, duration: 1 }}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-red-600 font-black text-xs tracking-widest uppercase shadow-xl"
                                        >
                                            <div className="size-2 rounded-full bg-red-600 animate-pulse" />
                                            ALERTA ACTIVA
                                        </motion.div>
                                        <h1 className="text-5xl font-black tracking-tighter pt-2 uppercase">Ayuda Activada</h1>
                                    </div>

                                    <div className="relative w-full aspect-[3/4] max-h-[50vh] rounded-[40px] overflow-hidden bg-zinc-900 shadow-2xl border-4 border-white/10">
                                        <div className="absolute inset-0 bg-black flex items-center justify-center">
                                            {envStream ? (
                                                <video ref={envVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-white/20">
                                                    <Video size={48} />
                                                    <span className="text-xs font-bold uppercase tracking-widest">Cámara Principal</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute bottom-6 right-6 w-32 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
                                            {userStream ? (
                                                <video ref={userVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-white/20">
                                                    <span className="material-symbols-outlined text-2xl">person</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full animate-pulse shadow-lg">
                                            <div className="size-2 rounded-full bg-white" />
                                            <span className="text-[10px] font-black tracking-widest uppercase">REC</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto pb-12 flex flex-col items-center gap-4">
                                        <button
                                            onClick={handleStopAttempt}
                                            className="group relative size-24 transform active:scale-95 transition-all outline-none"
                                        >
                                            <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
                                            <div className="relative h-full w-full rounded-full bg-white flex items-center justify-center shadow-2xl">
                                                <div className="size-8 bg-red-600 rounded-lg group-hover:scale-110 transition-transform" />
                                            </div>
                                        </button>
                                        <p className="text-white font-black text-xs tracking-widest uppercase opacity-60">
                                            Pulsa para Terminar
                                        </p>
                                    </div>
                                </>
                            ) : (
                                /* DISCRETE MODE UI (Looks like a normal app or background) */
                                <div className="flex flex-col items-center justify-center h-full w-full">
                                    <div className="text-center space-y-4 mb-20 px-8">
                                        <h1 className="text-2xl font-bold text-white/20">Bienvenido de nuevo</h1>
                                        <p className="text-white/10 text-sm">Tu sesión se ha cerrado correctamente.</p>
                                    </div>

                                    {/* Secret Stop Trigger for Discrete Mode */}
                                    <button
                                        onClick={handleStopAttempt}
                                        className="mt-auto mb-20 p-8 text-white/5 hover:text-white/20 transition-colors uppercase font-black tracking-[0.3em] text-[10px]"
                                    >
                                        Pulsa para desbloquear sesión
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 'pin' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center h-full pt-10"
                        >
                            <div className="text-center space-y-4 mb-12">
                                <div className="inline-flex items-center justify-center size-16 rounded-full bg-white/20 mb-4">
                                    <ShieldAlert size={32} />
                                </div>
                                <h1 className="text-3xl font-black uppercase tracking-tight">Introduce el PIN</h1>
                                <p className="text-white/70 font-medium">Código de seguridad para desactivar el SOS</p>
                            </div>

                            {/* PIN Display */}
                            <div className="flex gap-4 mb-12">
                                {[0, 1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            "size-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all",
                                            pinError ? "border-white bg-white text-red-600" :
                                                pinInput.length > i ? "border-white bg-white text-red-600" : "border-white/20 bg-black/20"
                                        )}
                                    >
                                        {pinInput.length > i ? "●" : ""}
                                    </div>
                                ))}
                            </div>

                            {/* PIN Pad */}
                            <div className="grid grid-cols-3 gap-4 w-full max-w-[320px]">
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"].map((key, i) => (
                                    key === "" ? <div key={i} /> :
                                        <button
                                            key={i}
                                            onClick={() => key === "delete" ? setPinInput(p => p.slice(0, -1)) : handlePinKeyPress(key)}
                                            className="size-20 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl font-black transition-colors active:scale-90"
                                        >
                                            {key === "delete" ? <Delete size={24} /> : key}
                                        </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setStep('active')}
                                className="mt-12 text-white/50 font-black text-xs tracking-widest uppercase hover:text-white"
                            >
                                Volver a la Alerta
                            </button>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
