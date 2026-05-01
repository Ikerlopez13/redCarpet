import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, Sparkles, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export const AIChat: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [messages, setMessages] = useState([
        { role: 'bot', text: t('chat.welcome') }
    ]);
    const [input, setInput] = useState('');
    const [supportRequired, setSupportRequired] = useState(false);

    const handleSend = () => {
        if (!input.trim()) return;
        const newMessages = [...messages, { role: 'user', text: input }];
        setMessages(newMessages);
        const userMsg = input.toLowerCase();
        setInput('');
        
        setTimeout(() => {
            let response = t('chat.default_fallback');
            let matched = false;
            
            if (userMsg.includes('sos') || userMsg.includes('ayuda') || userMsg.includes('emergencia')) {
                response = t('chat.faq_sos'); matched = true;
            } else if (userMsg.includes('ruta') || userMsg.includes('camino') || userMsg.includes('ir a')) {
                response = t('chat.faq_route'); matched = true;
            } else if (userMsg.includes('familia') || userMsg.includes('hijo') || userMsg.includes('hija') || userMsg.includes('contacto')) {
                response = t('chat.faq_family'); matched = true;
            } else if (userMsg.includes('premium') || userMsg.includes('pago') || userMsg.includes('suscribir')) {
                response = t('chat.faq_premium'); matched = true;
            } else if (userMsg.includes('hola') || userMsg.includes('buenos dias')) {
                response = t('chat.faq_greeting'); matched = true;
            }

            // Fallback to support if no match on subsequent tries
            if (!matched && newMessages.filter(m => m.role === 'user').length >= 2) {
                setSupportRequired(true);
            }

            setMessages(prev => [...prev, { 
                role: 'bot', 
                text: response 
            }]);
        }, 800);
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
                            "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
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
                                href="mailto:soporte.urbanguide@gmail.com"
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
