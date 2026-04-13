import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, Sparkles, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

export const AIChat: React.FC = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hola, soy Red, tu asistente de seguridad IA. ¿En qué puedo ayudarte hoy?' }
    ]);
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages([...messages, { role: 'user', text: input }]);
        setInput('');
        
        // Simulate bot response
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                role: 'bot', 
                text: 'Entiendo tu consulta. Como asistente de RedCarpet, estoy aquí para guiarte en rutas seguras y protocolos de emergencia. Actualmente estamos optimizando mis respuestas para tu zona.' 
            }]);
        }, 1000);
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
                        <h1 className="text-lg font-black uppercase italic tracking-tighter">RED IA</h1>
                        <div className="flex items-center gap-1.5">
                            <div className="size-1.5 bg-green-500 rounded-full animate-pulse" />
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">En línea</p>
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
                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                : 'bg-white/5 border border-white/10 text-white/80'
                        )}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-6 pb-10 bg-zinc-900/50 backdrop-blur-xl border-t border-white/5">
                <div className="flex items-center gap-3 bg-white/5 rounded-2xl border border-white/10 p-2 pl-4">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Pregunta a Red..."
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
                    <p className="text-[10px] font-bold uppercase tracking-widest">Powered by RedCarpet AI Engine</p>
                </div>
            </div>
        </div>
    );
};
