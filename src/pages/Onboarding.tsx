import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

type OnboardingStep = 'intro' | 'usage-type' | 'relationship' | 'complete';
type UsageType = 'individual' | 'family';
type RelationshipType = 'parental' | 'couple' | 'roommates' | 'extended';

interface RelationshipOption {
    id: RelationshipType;
    icon: string;
    label: string;
    description: string;
    defaultPermissions: string[];
}

const relationshipOptions: RelationshipOption[] = [
    {
        id: 'parental',
        icon: 'family_restroom',
        label: 'Parental',
        description: 'Padres e hijos menores',
        defaultPermissions: ['ubicación 24/7', 'historial completo', 'alertas automáticas', 'geofencing'],
    },
    {
        id: 'couple',
        icon: 'favorite',
        label: 'Pareja',
        description: 'Parejas que conviven',
        defaultPermissions: ['ubicación compartida', 'SOS bidireccional', 'check-in'],
    },
    {
        id: 'roommates',
        icon: 'home',
        label: 'Convivencia',
        description: 'Compañeros de piso',
        defaultPermissions: ['ubicación bajo demanda', 'check-in', 'SOS grupal'],
    },
    {
        id: 'extended',
        icon: 'groups',
        label: 'Familia extendida',
        description: 'Familiares adultos',
        defaultPermissions: ['ubicación opcional', 'emergencias', 'contacto'],
    },
];

const introSlides = [
    {
        id: 1,
        title: "Tu seguridad, reimaginada",
        description: "La protección avanzada que te acompaña a ti y a los tuyos, en cada paso del camino.",
        icon: "shield",
        color: "text-primary"
    },
    {
        id: 2,
        title: "Siempre conectados",
        description: "Visualiza a tu familia en tiempo real. Sin llamadas, sin mensajes. Solo tranquilidad.",
        icon: "groups",
        color: "text-blue-400"
    },
    {
        id: 3,
        title: "Respuesta inmediata",
        description: "En caso de emergencia, cada segundo cuenta. Alertas instantáneas y respuesta prioritaria.",
        icon: "sos",
        color: "text-red-500"
    }
];

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<OnboardingStep>('intro');
    const [introSlide, setIntroSlide] = useState(0);
    const [usageType, setUsageType] = useState<UsageType | null>(null);
    const [relationshipType, setRelationshipType] = useState<RelationshipType | null>(null);

    const handleNextSlide = () => {
        if (introSlide < introSlides.length - 1) {
            setIntroSlide(prev => prev + 1);
        } else {
            setStep('usage-type');
        }
    };

    const handleComplete = () => {
        localStorage.setItem('onboarding_complete', 'true');
        localStorage.setItem('usage_type', usageType || 'individual');
        if (relationshipType) {
            localStorage.setItem('relationship_type', relationshipType);
        }
        navigate('/');
    };

    const variants = {
        enter: { opacity: 0, x: 20 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    // Intro Carousel Step
    if (step === 'intro') {
        const slide = introSlides[introSlide];

        return (
            <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display pt-8">

                {/* Skip button */}
                <div className="flex justify-end px-6 mb-4">
                    <button
                        onClick={() => setStep('usage-type')}
                        className="text-white/40 text-sm font-medium hover:text-white transition-colors"
                    >
                        Saltar
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pb-12">
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={slide.id}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            variants={variants}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col items-center w-full"
                        >
                            {/* Icon Animation Container */}
                            <div className="relative mb-12">
                                <div className={clsx("absolute inset-0 blur-[60px] opacity-40 rounded-full", slide.color.replace('text', 'bg'))} />
                                <div className="size-32 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center relative backdrop-blur-sm shadow-2xl">
                                    <span className={clsx("material-symbols-outlined text-6xl", slide.color)} style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {slide.icon}
                                    </span>
                                </div>
                            </div>

                            <h1 className="text-3xl font-bold mb-4 tracking-tight">{slide.title}</h1>
                            <p className="text-white/60 text-lg leading-relaxed max-w-sm">
                                {slide.description}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="px-8 pb-12 w-full">
                    {/* Pagination Dots */}
                    <div className="flex justify-center gap-2 mb-8">
                        {introSlides.map((_, idx) => (
                            <div
                                key={idx}
                                className={clsx(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    idx === introSlide ? "w-6 bg-primary" : "w-1.5 bg-white/20"
                                )}
                            />
                        ))}
                    </div>

                    <button
                        onClick={handleNextSlide}
                        className="w-full py-4 bg-white text-black font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-all"
                    >
                        {introSlide === introSlides.length - 1 ? 'Empezar' : 'Siguiente'}
                    </button>
                </div>
            </div>
        );
    }

    // Usage Type Step
    if (step === 'usage-type') {
        return (
            <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
                <div className="flex items-center gap-4 px-4 pt-4 pb-6 shrink-0">
                    <button onClick={() => setStep('intro')} className="p-2 -ml-2 rounded-full hover:bg-white/5">
                        <span className="material-symbols-outlined text-white/60">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-primary rounded-full transition-all duration-500" />
                        </div>
                    </div>
                    <div className="w-8" />
                </div>

                <div className="flex-1 px-6 overflow-y-auto">
                    <h2 className="text-3xl font-bold mb-3">Tu experiencia</h2>
                    <p className="text-white/50 text-lg mb-8">¿Cómo prefieres usar RedCarpet?</p>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={() => {
                                setUsageType('individual');
                                setStep('complete');
                            }}
                            className={clsx(
                                "group relative overflow-hidden flex items-start gap-4 p-5 rounded-[1.5rem] border-2 text-left transition-all duration-300",
                                usageType === 'individual'
                                    ? "border-primary bg-primary/10"
                                    : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
                            )}
                        >
                            <div className="size-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0 border border-white/5">
                                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    person
                                </span>
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">Personal</h3>
                                <p className="text-sm text-white/50">
                                    Seguridad avanzada solo para ti. Rutas, SOS y alertas.
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                setUsageType('family');
                                setStep('relationship');
                            }}
                            className={clsx(
                                "group relative overflow-hidden flex items-start gap-4 p-5 rounded-[1.5rem] border-2 text-left transition-all duration-300",
                                usageType === 'family'
                                    ? "border-primary bg-primary/10"
                                    : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
                            )}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-[100px] text-primary">groups</span>
                            </div>

                            <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center shrink-0 border border-white/5">
                                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    groups
                                </span>
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">Familiar / Grupo</h3>
                                <p className="text-sm text-white/50">
                                    Protege a los tuyos. Ubicación compartida y alertas grupales.
                                </p>
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 mt-3 bg-primary/20 rounded-full text-primary text-xs font-bold ring-1 ring-primary/30">
                                    <span className="material-symbols-outlined text-[14px] fill-current">star</span>
                                    Recomendado
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Relationship Type Step
    if (step === 'relationship') {
        return (
            <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
                <div className="flex items-center gap-4 px-4 pt-4 pb-6 shrink-0">
                    <button onClick={() => setStep('usage-type')} className="p-2 -ml-2 rounded-full hover:bg-white/5">
                        <span className="material-symbols-outlined text-white/60">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full w-2/3 bg-primary rounded-full transition-all duration-500" />
                        </div>
                    </div>
                    <div className="w-8" />
                </div>

                <div className="flex-1 px-6 overflow-y-auto pb-32">
                    <h2 className="text-2xl font-bold mb-2">Configuración del grupo</h2>
                    <p className="text-white/50 mb-6">Elige el tipo de grupo para adaptar los permisos.</p>

                    <div className="grid grid-cols-1 gap-3">
                        {relationshipOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setRelationshipType(option.id)}
                                className={clsx(
                                    "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all",
                                    relationshipType === option.id
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                        : "border-white/5 bg-white/5 hover:bg-white/10"
                                )}
                            >
                                <div className={clsx(
                                    "size-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                    relationshipType === option.id ? "bg-primary text-white" : "bg-white/10 text-white/60"
                                )}>
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {option.icon}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-bold truncate">{option.label}</h3>
                                    <p className="text-xs text-white/40 truncate">{option.description}</p>
                                </div>
                                {relationshipType === option.id && (
                                    <div className="bg-primary rounded-full p-1">
                                        <span className="material-symbols-outlined text-white text-xs block">check</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 pt-8 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent">
                    <button
                        onClick={() => setStep('complete')}
                        disabled={!relationshipType}
                        className="w-full py-4 bg-primary text-white font-bold text-lg rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale transition-all"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        );
    }

    // Complete Step
    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display relative">
            {/* Confetti effect placeholder could go here */}

            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center z-10">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-green-500/30 blur-[40px] rounded-full animate-pulse" />
                    <div className="size-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl relative scale-100 animate-bounce-short">
                        <span className="material-symbols-outlined text-white text-5xl font-bold">check</span>
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-3">¡Todo listo!</h1>
                <p className="text-white/60 text-lg mb-8 max-w-sm leading-relaxed">
                    Hemos configurado tu perfil {usageType === 'family' ? 'familiar' : 'personal'} correctamente.
                </p>

                {usageType === 'family' && relationshipType && (
                    <div className="w-full max-w-[280px] p-4 rounded-2xl bg-white/5 border border-white/10 text-left backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-sm">settings</span>
                            </div>
                            <span className="font-bold text-sm">Ajustes aplicados</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {relationshipOptions.find(r => r.id === relationshipType)?.defaultPermissions.slice(0, 3).map((perm, i) => (
                                <span key={i} className="px-2 py-1 bg-white/10 rounded-md text-[10px] uppercase font-bold text-white/60 tracking-wide">
                                    {perm}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="shrink-0 px-6 pb-12 z-20">
                <button
                    onClick={handleComplete}
                    className="w-full py-4 bg-white text-black font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-all"
                >
                    Entrar a RedCarpet
                </button>
            </div>
        </div>
    );
};
