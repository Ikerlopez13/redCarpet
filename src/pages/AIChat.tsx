import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, Sparkles, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

// ── ASISTENTE RED IA — COSTE 0 ESTRUCTURAL ────────────────────────────────
// No usa ningún LLM ni API de pago: es un matcher de reglas/FAQ 100% en el
// cliente. Coste 0 real y sostenible por diseño (no depende de una cuota
// gratuita que pueda agotarse ni de una API que pueda facturar por request).
//
// CRITERIO DE DERIVACIÓN A SOPORTE (explícito):
//   Una pregunta "no se puede responder" cuando NO coincide con ninguna
//   categoría de la base de FAQ (confianza = 0). En ese caso NO se inventa una
//   respuesta: se muestra un mensaje honesto y el botón de soporte, que abre
//   un email con la PREGUNTA ORIGINAL y el HILO de conversación capturados.
//
// Trade-off (dicho claro): al ser FAQ+reglas y no un LLM libre, responde bien
// las consultas frecuentes de RedCarpet y deriva el resto a soporte. Es la
// única forma de garantizar coste 0 REAL a cualquier volumen; un LLM de pago
// daría respuestas más abiertas pero rompería el requisito de coste.

const SUPPORT_EMAIL = 'soporte.redcarpet@gmail.com';

// Base de conocimiento: categoría → palabras clave (es + algo de en) → respuesta.
const FAQ_RULES: { keys: string[]; answer: string }[] = [
    { answer: 'faq_sos',     keys: ['sos', 'ayuda', 'emergencia', 'peligro', 'auxilio', 'help', 'emergency'] },
    { answer: 'faq_route',   keys: ['ruta', 'camino', 'ir a', 'llegar', 'navegar', 'trayecto', 'route', 'directions'] },
    { answer: 'faq_family',  keys: ['familia', 'hijo', 'hija', 'contacto', 'grupo', 'circulo', 'família', 'family', 'contact'] },
    { answer: 'faq_premium', keys: ['premium', 'pago', 'pagar', 'suscribir', 'suscripción', 'precio', 'plan', 'subscribe', 'price'] },
    { answer: 'faq_greeting',keys: ['hola', 'buenos dias', 'buenas', 'hey', 'hello', 'hi'] },
];

type Msg = { role: 'bot' | 'user'; text: string };

export const AIChat: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [messages, setMessages] = useState<Msg[]>([{ role: 'bot', text: t('chat.welcome') }]);
    const [input, setInput] = useState('');
    const [supportRequired, setSupportRequired] = useState(false);

    // Devuelve la clave de respuesta FAQ o null si no hay coincidencia (baja
    // confianza). Normaliza a " palabra palabra " (solo letras) y busca la
    // clave rodeada de espacios → límites de palabra, sin falsos positivos por
    // subcadena (ej. "hi" dentro de "chiste").
    const matchFaq = (msg: string): string | null => {
        const q = ` ${msg.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim()} `;
        for (const rule of FAQ_RULES) {
            if (rule.keys.some(k => q.includes(` ${k} `))) return rule.answer;
        }
        return null;
    };

    const handleSend = () => {
        const question = input.trim();
        if (!question) return;
        const withUser: Msg[] = [...messages, { role: 'user', text: question }];
        setMessages(withUser);
        setInput('');

        setTimeout(() => {
            const answerKey = matchFaq(question);
            if (answerKey) {
                // Coincidencia → respuesta útil de la FAQ.
                setMessages(prev => [...prev, { role: 'bot', text: t(`chat.${answerKey}`) }]);
            } else {
                // Sin coincidencia (confianza 0) → NO inventar: honesto + derivar a soporte.
                setMessages(prev => [...prev, { role: 'bot', text: t('chat.no_answer') }]);
                setSupportRequired(true);
            }
        }, 500);
    };

    // Construye el mailto a soporte con la pregunta original + el hilo completo,
    // para que el equipo responda con contexto real. Coste 0 (no hay backend).
    const buildSupportMailto = (): string => {
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        const transcript = messages
            .map(m => `${m.role === 'user' ? 'Usuario' : 'RED IA'}: ${m.text}`)
            .join('\n');
        const subject = `Consulta desde el chat de RedCarpet`;
        const body =
            `Pregunta del usuario:\n${lastUser?.text || '(sin texto)'}\n\n` +
            `--- Conversación completa ---\n${transcript}\n\n` +
            `(Enviado automáticamente desde el chat RED IA de RedCarpet)`;
        return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 pt-12 pb-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase italic tracking-tighter">{t('chat.name')}</h1>
                        <div className="flex items-center gap-1.5">
                            <div className="size-1.5 bg-green-500 rounded-full animate-pulse" />
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t('chat.online')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={clsx(
                            "flex animate-scale-in",
                            m.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                    >
                        <div className={clsx(
                            "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line",
                            m.role === 'user'
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold'
                                : 'bg-white/5 border border-white/10 text-white/80 font-medium'
                        )}>
                            {m.text}
                        </div>
                    </div>
                ))}

                {supportRequired && (
                    <div className="flex flex-col items-center gap-4 py-6 px-4 bg-primary/5 border border-primary/20 rounded-3xl animate-slide-up">
                        <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <Sparkles size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold uppercase tracking-tight mb-1">{t('chat.not_found_prompt')}</p>
                            <p className="text-xs text-white/40 mb-4 px-4 font-medium italic">{t('chat.contact_support_desc')}</p>
                            <a
                                href={buildSupportMailto()}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-95 transition-all"
                            >
                                {t('chat.contact_support_btn')}
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 pb-10 bg-zinc-900/50 backdrop-blur-xl border-t border-white/5">
                <div className="flex items-center gap-3 bg-white/5 rounded-2xl border border-white/10 p-2 pl-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={t('chat.placeholder')}
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/20"
                    />
                    <button
                        onClick={handleSend}
                        className="size-10 rounded-xl bg-white flex items-center justify-center text-black active:scale-95 transition-all"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 opacity-20">
                    <Sparkles size={12} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">{t('chat.powered_by')}</p>
                </div>
            </div>
        </div>
    );
};
