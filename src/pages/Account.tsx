import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Mail, Shield, Smartphone, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Account: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const sections = [
        { icon: User, label: 'Perfil', value: user?.email?.split('@')[0] || 'Usuario' },
        { icon: Mail, label: 'Email', value: user?.email || '-' },
        { icon: Shield, label: 'PIN de Seguridad', value: '****' },
        { icon: Smartphone, label: 'Dispositivo', value: 'iPhone 15 Pro' },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 pt-12 pb-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-black uppercase italic tracking-tighter">Cuenta</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* Profile Header */}
                <div className="flex flex-col items-center gap-4 py-6">
                    <div className="size-24 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center relative">
                        <User size={48} className="text-white/20" />
                        <div className="absolute -bottom-1 -right-1 size-8 rounded-2xl bg-primary flex items-center justify-center text-white border-2 border-[#0d0d0d]">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">{user?.email?.split('@')[0] || 'Usuario'}</h2>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Miembro desde 2024</p>
                    </div>
                </div>

                {/* Info Sections */}
                <div className="space-y-3">
                    {sections.map((s, i) => (
                        <div 
                            key={i}
                            className="bg-white/5 rounded-2xl border border-white/5 p-4 flex items-center justify-between group active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white/5 rounded-xl text-white/40 group-hover:text-white transition-colors">
                                    <s.icon size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{s.label}</p>
                                    <p className="text-sm font-bold text-white/80">{s.value}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-white/10" />
                        </div>
                    ))}
                </div>

                {/* Logout */}
                <button 
                    onClick={handleSignOut}
                    className="w-full py-5 bg-red-600/10 border border-red-600/20 text-red-500 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all mt-12"
                >
                    <LogOut size={20} />
                    <span className="text-sm font-black uppercase tracking-widest">Cerrar Sesión</span>
                </button>

                <div className="text-center py-8">
                    <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.4em]">RedCarpet Infrastructure v3.5.0</p>
                </div>
            </div>
        </div>
    );
};
