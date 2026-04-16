import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, ChevronLeft, Star } from 'lucide-react';

export const Feedback: React.FC = () => {
    const navigate = useNavigate();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (rating === 0) return;
        
        // Success state
        setSubmitted(true);
        
        // If high rating, redirect to store after a short delay
        if (rating >= 4) {
            setTimeout(() => {
                const confirmReview = window.confirm('¡Muchas gracias por tu valoración! ¿Te gustaría dedicarnos 1 minuto y dejarnos una reseña positiva en la tienda? Nos ayudaría muchísimo.');
                if (confirmReview) {
                    // For demo purposes, we'll use a generic store link
                    window.open('https://apps.apple.com/app/id6479100000?action=write-review', '_blank');
                }
                navigate(-1);
            }, 1000);
        } else {
            setTimeout(() => navigate(-1), 2000);
        }
    };

    if (submitted) {
        return (
            <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white items-center justify-center p-8 text-center animate-fade-in">
                <div
                    className="size-24 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-6 animate-scale-in"
                >
                    <Star size={48} fill="currentColor" />
                </div>
                <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-2">¡Gracias!</h1>
                <p className="text-white/40 text-sm">Tu opinión nos ayuda a hacer RedCarpet cada vez más seguro.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 pt-12 pb-6">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white transition-transform active:scale-90">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-black uppercase italic tracking-tighter">Feedback</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="space-y-2">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 animate-fade-in">Califica tu experiencia</h2>
                    <div className="flex gap-4">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <button 
                                key={s}
                                onClick={() => setRating(s)}
                                className={`size-12 rounded-2xl flex items-center justify-center transition-all ${
                                    rating >= s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-white/20 border border-white/5'
                                }`}
                            >
                                <Star size={24} fill={rating >= s ? 'currentColor' : 'none'} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">¿Cómo podemos mejorar?</h2>
                    <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Escribe aquí tus sugerencias..."
                        className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-primary transition-colors resize-none"
                    />
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={rating === 0}
                    className="w-full py-5 bg-white text-black font-black text-lg rounded-2xl shadow-xl shadow-white/5 active:scale-95 transition-all uppercase italic tracking-tighter disabled:opacity-20 disabled:scale-100 animate-slide-up"
                    style={{ animationDelay: '200ms' }}
                >
                    Enviar Comentario
                </button>
            </div>
        </div>
    );
};
