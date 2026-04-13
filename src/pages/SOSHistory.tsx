import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, History, ShieldAlert, Calendar, MapPin, Clock } from 'lucide-react';

const historyData = [
    {
        id: '1',
        type: 'Seguridad',
        date: '12 Feb 2024',
        time: '23:15',
        location: 'Carrer de Mallorca, Barcelona',
        status: 'Resuelto',
    },
    {
        id: '2',
        type: 'Médico',
        date: '05 Jan 2024',
        time: '14:20',
        location: 'Plaça de Catalunya, Barcelona',
        status: 'Resuelto',
    }
];

export const SOSHistory: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 pt-12 pb-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-black uppercase italic tracking-tighter">Historial de Alertas</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {historyData.length > 0 ? (
                    historyData.map((item, index) => (
                        <div
                            key={item.id}
                            className="bg-white/5 rounded-2xl border border-white/5 p-5 space-y-4 animate-slide-up"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-600/10 rounded-lg text-red-500">
                                        <ShieldAlert size={18} />
                                    </div>
                                    <h3 className="font-bold text-white/90">{item.type}</h3>
                                </div>
                                <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full">
                                    {item.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Calendar size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.date}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/40">
                                    <Clock size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.time}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/40 col-span-2">
                                    <MapPin size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">{item.location}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-20 animate-fade-in">
                        <History size={64} />
                        <p className="text-sm font-bold uppercase tracking-widest">No hay historial disponible</p>
                    </div>
                )}
            </div>

            <div className="p-6 pb-12">
                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest text-center leading-relaxed">
                    Tus alertas se guardan de forma encriptada<br/>por un periodo de 12 meses (RGPD).
                </p>
            </div>
        </div>
    );
};
