import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ChevronLeft, 
    Shield, 
    Mic, 
    Volume2, 
    Navigation2, 
    History, 
    Smartphone, 
    Check, 
    Play,
    Zap,
    Lock,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext.base';
import { createFamilyGroup, getFamilyGroup } from '../services/familyService';
import { activateSOS, executeSOSProtocol } from '../services/sosService';
import { Preferences } from '@capacitor/preferences';
import clsx from 'clsx';

export const WidgetsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { familyGroup } = useSOS();
    
    // Config States
    const [decoyType, setDecoyType] = useState<'calculator' | 'weather' | 'blank'>('calculator');
    const [patternEnabled, setPatternEnabled] = useState(true);
    const [voiceTriggerEnabled, setVoiceTriggerEnabled] = useState(true);
    const [currentStep, setCurrentStep] = useState<number>(0); // 0: Idle, 1..4: corner tapping sequence
    const [simulationActive, setSimulationActive] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Corners click tracker for the 4x2 / 2x2 widget pattern
    // Pattern: Top-Left (1) -> Top-Right (2) -> Bottom-Right (3) -> Bottom-Left (4) => forming an X / Box sequence
    const [sequence, setSequence] = useState<number[]>([]);

    useEffect(() => {
        const loadPrefs = async () => {
            const { value: decoy } = await Preferences.get({ key: 'DECOY_TYPE' });
            if (decoy) setDecoyType(decoy as any);

            const { value: pattern } = await Preferences.get({ key: 'PATTERN_ENABLED' });
            if (pattern !== null) setPatternEnabled(pattern === 'true');

            const { value: voice } = await Preferences.get({ key: 'VOICE_TRIGGER_ENABLED' });
            if (voice !== null) setVoiceTriggerEnabled(voice === 'true');
        };
        loadPrefs();
    }, []);

    const triggerToast = (msg: string) => {
        setToastMessage(msg);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
    };

    const handleDecoyChange = async (type: 'calculator' | 'weather' | 'blank') => {
        setDecoyType(type);
        await Preferences.set({ key: 'DECOY_TYPE', value: type });
        triggerToast(`Señuelo cambiado a: ${type === 'calculator' ? 'Calculadora' : type === 'weather' ? 'Clima' : 'Pantalla Apagada'}`);
    };

    const togglePattern = async () => {
        const next = !patternEnabled;
        setPatternEnabled(next);
        await Preferences.set({ key: 'PATTERN_ENABLED', value: String(next) });
        triggerToast(next ? 'Activación secreta habilitada' : 'Activación secreta deshabilitada');
    };

    const toggleVoice = async () => {
        const next = !voiceTriggerEnabled;
        setVoiceTriggerEnabled(next);
        await Preferences.set({ key: 'VOICE_TRIGGER_ENABLED', value: String(next) });
        triggerToast(next ? 'Comando "Oye RedCarpet" habilitado' : 'Comando de voz desactivado');
    };

    // Discreet Corner Tap Handler
    const handleCornerTap = (cornerId: number) => {
        if (!patternEnabled) return;
        
        const nextSeq = [...sequence, cornerId];
        setSequence(nextSeq);
        
        // Visual indicator of sequence progress
        if (cornerId === 1 && sequence.length === 0) {
            // First step OK (Top-Left)
            triggerToast('🔒 Secuencia iniciada (1/4)...');
        } else if (cornerId === 2 && sequence[0] === 1 && sequence.length === 1) {
            // Second step OK (Top-Right)
            triggerToast('🔒 Secuencia (2/4)...');
        } else if (cornerId === 3 && sequence[0] === 1 && sequence[1] === 2 && sequence.length === 2) {
            // Third step OK (Bottom-Left)
            triggerToast('🔒 Secuencia (3/4)...');
        } else if (cornerId === 4 && sequence[0] === 1 && sequence[1] === 2 && sequence[2] === 3 && sequence.length === 3) {
            // Fourth step OK -> SUCCESS! TRIGGER SILENT SOS
            triggerToast('🚨 SECUENCIA COMPLETA: SOS Discreto Iniciado');
            setSequence([]);
            handleLaunchSOS(true);
        } else {
            // Failed sequence, reset
            setSequence([]);
            if (cornerId === 1) {
                setSequence([1]);
                triggerToast('🔒 Secuencia iniciada (1/4)...');
            } else {
                triggerToast('❌ Patrón incorrecto. Pulsa en orden: Arriba-Izquierda -> Arriba-Derecha -> Abajo-Derecha -> Abajo-Izquierda');
            }
        }
    };

    const handleLaunchSOS = async (discrete: boolean = false) => {
        if (!user) {
            window.alert('Debes iniciar sesión para activar el SOS');
            return;
        }

        try {
            let group = await getFamilyGroup(user.id);
            if (!group) {
                const { group: newGroup } = await createFamilyGroup("Mi Círculo", "parental", user.id);
                group = newGroup;
            }
            if (!group) return;

            const mode = discrete ? 'discrete' : 'visible';
            const { alert, error } = await activateSOS(user.id, group.id, {
                message: discrete 
                    ? `🚨 SOS SILENCIOSO / DISCRETO\nActivado discretamente mediante patrón de esquinas.` 
                    : `🚨 SOS DIRECTO\nActivado desde Widget de Acceso Rápido.`,
                highPriority: true,
                notifyContacts: true,
                shareLocation: true,
                mode: mode,
                type: 'security'
            });

            if (alert) {
                navigate('/emergency-live', {
                    state: {
                        alertId: alert.id,
                        reason: 'security',
                        mode: mode
                    },
                    replace: true
                });
            }
        } catch (err) {
            console.error('Widget SOS trigger failed:', err);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#080808] text-white overflow-hidden font-display animate-fade-in relative">
            
            {/* Background ambient lighting */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[90vw] h-[40vh] bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] -left-[20%] w-[60vw] h-[40vh] bg-red-950/10 rounded-full blur-[80px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-12 pb-6 border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black uppercase italic tracking-tighter">Widgets & SOS Secreto</h1>
                        <p className="text-[9px] font-bold text-white/30 tracking-widest uppercase">Centro de Control de Acceso Rápido</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
                        PREMIUM
                    </span>
                </div>
            </div>

            {/* Main Area */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6 space-y-8 no-scrollbar pb-32">
                
                {/* Intro Card */}
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Sparkles size={48} />
                    </div>
                    <h2 className="text-sm font-black uppercase italic tracking-tight text-white mb-2 flex items-center gap-2">
                        <Smartphone className="text-primary size-4" /> Acceso Rápido en tu Teléfono
                    </h2>
                    <p className="text-xs text-white/60 leading-relaxed font-medium">
                        Instala los widgets de RedCarpet en tu pantalla de inicio para alertar a tu círculo al instante. 
                        Configura el <span className="text-red-400 font-bold">Patrón Discreto "X"</span> para pedir auxilio silenciosamente en momentos de extremo peligro.
                    </p>
                </div>

                {/* SECTION 1: THE WIDGET SHOWCASE */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 italic">Tu Widget de Acceso Rápido</h3>
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                            <span className="size-2 rounded-full bg-green-500 animate-ping" /> Activo
                        </span>
                    </div>

                    {/* MASSIVE WIDGET DEMO */}
                    <div className="relative flex flex-col items-center justify-center aspect-square p-8 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 backdrop-blur-md border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden group select-none">
                        {/* Background glow */}
                        <div className="absolute inset-0 bg-red-600 rounded-full blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity animate-pulse" />
                        
                        <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                            <span className="text-[12px] font-black text-white/40 tracking-wider font-mono">REDCARPET</span>
                            <div className="size-6 rounded-full bg-red-600/20 flex items-center justify-center border border-red-500/30">
                                <span className="text-[10px] text-red-500 font-bold">★</span>
                            </div>
                        </div>

                        {/* HUGE Core SOS button */}
                        <button 
                            onClick={() => handleLaunchSOS(false)}
                            className="size-48 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-8 border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] active:scale-95 transition-transform z-20 hover:scale-105"
                        >
                            <span className="text-5xl font-black text-white italic tracking-tighter drop-shadow-md">SOS</span>
                        </button>

                        <div className="absolute bottom-8 text-center w-full">
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">PULSAR EN EMERGENCIA</span>
                        </div>
                    </div>
                    
                    <div className="text-center px-4 pt-2">
                        <p className="text-xs text-white/50 leading-relaxed">
                            Añade este widget a la pantalla de inicio de tu iPhone manteniendo pulsado el fondo de pantalla y seleccionando RedCarpet.
                        </p>
                    </div>
                </section>



            </div>

            {/* Float Success Toast */}
            {showSuccessToast && (
                <div className="fixed bottom-28 left-6 right-6 z-[9999] bg-zinc-950/90 border border-white/20 text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl backdrop-blur-xl animate-slide-up">
                    <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse">
                        <Zap size={12} />
                    </div>
                    <span className="text-xs font-bold leading-normal">{toastMessage}</span>
                </div>
            )}

        </div>
    );
};
