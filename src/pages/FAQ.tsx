import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Minus, Search, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

const faqs = [
    {
        q: "¿Cómo funciona el botón SOS?",
        a: "Al pulsar el botón SOS durante 2 segundos (o doble toque en modo discreto), se activa un protocolo de emergencia que alerta a tus contactos de confianza, inicia una grabación de seguridad y, si está configurado, llama a emergencias (112)."
    },
    {
        q: "¿Mi familia puede ver dónde estoy siempre?",
        a: "Solo si compartes tu ubicación con ellos. Puedes activar o desactivar la visibilidad en tiempo real desde los ajustes de privacidad de tu perfil."
    },
    {
        q: "¿Qué es la Red Premium?",
        a: "La Red Premium incluye IA de detección nocturna, grabación ilimitada en la nube, gestión de múltiples grupos de confianza y acceso prioritario a zonas seguras actualizadas."
    },
    {
        q: "¿Cómo añado contactos de emergencia?",
        a: "Ve a la sección 'Contactos de Confianza' en el menú principal y pulsa el botón '+'. Recibirán una invitación para formar parte de tu red de seguridad."
    }
];

export const FAQ: React.FC = () => {
    const navigate = useNavigate();
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="px-6 pt-12 pb-6 space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-black uppercase italic tracking-tighter">Preguntas Frecuentes</h1>
                </div>

                <div className="flex items-center gap-3 bg-white/5 rounded-2xl border border-white/10 px-4 py-3">
                    <Search size={18} className="text-white/20" />
                    <input 
                        type="text" 
                        placeholder="Buscar ayuda..." 
                        className="bg-transparent outline-none text-sm text-white placeholder-white/20 flex-1"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-12 space-y-3 no-scrollbar">
                {faqs.map((f, i) => (
                    <div 
                        key={i}
                        className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden transition-all animate-slide-up"
                        style={{ animationDelay: `${i * 100}ms` }}
                    >
                        <button 
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left"
                        >
                            <span className="text-sm font-bold text-white/80">{f.q}</span>
                            <div className={clsx(
                                "shrink-0 ml-4 transition-transform",
                                openIndex === i ? 'rotate-180 text-primary' : 'text-white/20'
                            )}>
                                {openIndex === i ? <Minus size={18} /> : <Plus size={18} />}
                            </div>
                        </button>
                        {openIndex === i && (
                            <div
                                className="px-5 pb-5 animate-slide-down"
                            >
                                <p className="text-xs text-white/40 leading-relaxed border-t border-white/5 pt-4">
                                    {f.a}
                                </p>
                            </div>
                        )}
                    </div>
                ))}

                <div className="mt-12 p-6 bg-primary/10 rounded-3xl border border-primary/20 flex flex-col items-center text-center gap-4 animate-fade-in" style={{ animationDelay: '500ms' }}>
                    <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                        <HelpCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-1">¿Aún tienes dudas?</h3>
                        <p className="text-[10px] text-white/40">Nuestro equipo de soporte está disponible las 24h para usuarios Premium.</p>
                    </div>
                    <button className="w-full py-3 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                        Contactar Soporte
                    </button>
                </div>
            </div>
        </div>
    );
};
