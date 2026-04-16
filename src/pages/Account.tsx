import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Mail, Shield, Smartphone, LogOut, ChevronRight, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '../services/supabaseClient';

export const Account: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [isEditingPin, setIsEditingPin] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newEmail, setNewEmail] = useState(user?.email || '');
    const [newPin, setNewPin] = useState('');
    const [newName, setNewName] = useState(user?.profile?.full_name || '');
    const [currentPin, setCurrentPin] = useState('****');
    const [isLoading, setIsLoading] = useState(false);
    const { refreshProfile } = useAuth();

    useEffect(() => {
        const loadPin = async () => {
            const { value } = await Preferences.get({ key: 'SOS_PIN' });
            if (value) setCurrentPin(value);
        };
        loadPin();
    }, []);

    const handleUpdateName = async () => {
        if (!newName.trim() || newName === user?.profile?.full_name) {
            setIsEditingName(false);
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.from('profiles').update({ full_name: newName }).eq('id', user?.id);
            if (error) throw error;
            await refreshProfile();
            setIsEditingName(false);
            alert('Nombre actualizado correctamente');
        } catch (err: any) {
            alert('Error al actualizar nombre: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        await logout();
        navigate('/login');
    };

    const handleUpdateEmail = async () => {
        if (!newEmail || newEmail === user?.email) {
            setIsEditingEmail(false);
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;
            alert('Se ha enviado un correo de confirmación a tu nueva dirección.');
            setIsEditingEmail(false);
        } catch (err: any) {
            alert('Error al actualizar email: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdatePin = async () => {
        if (newPin.length < 4) {
            alert('El PIN debe tener al menos 4 dígitos');
            return;
        }
        setIsLoading(true);
        try {
            await Preferences.set({ key: 'SOS_PIN', value: newPin });
            setCurrentPin(newPin);
            setNewPin('');
            setIsEditingPin(false);
            alert('PIN actualizado correctamente');
        } catch (err: any) {
            alert('Error al actualizar PIN');
        } finally {
            setIsLoading(false);
        }
    };

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
                        {user?.profile?.avatar_url ? (
                             <img src={user.profile.avatar_url} alt="Profile" className="w-full h-full rounded-[2.5rem] object-cover" />
                        ) : (
                            <User size={48} className="text-white/20" />
                        )}
                        <div className="absolute -bottom-1 -right-1 size-8 rounded-2xl bg-primary flex items-center justify-center text-white border-2 border-[#0d0d0d]">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">{user?.profile?.full_name || user?.email?.split('@')[0] || 'Usuario'}</h2>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Miembro Activo</p>
                    </div>
                </div>

                {/* Info Sections */}
                <div className="space-y-3">
                    {/* Perfil */}
                    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white/5 rounded-xl text-white/40">
                                    <User size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Nombre Completo</p>
                                    <p className="text-sm font-bold text-white/80">{user?.profile?.full_name || 'No configurado'}</p>
                                </div>
                            </div>
                            {!isEditingName && (
                                <button onClick={() => setIsEditingName(true)} className="text-primary text-xs font-bold uppercase tracking-wider">Cambiar</button>
                            )}
                        </div>
                        {isEditingName && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <input 
                                    type="text" 
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary font-bold"
                                    placeholder="Tu nombre..."
                                />
                                <button onClick={handleUpdateName} disabled={isLoading} className="size-10 bg-primary rounded-xl flex items-center justify-center text-white">
                                    {isLoading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Email */}
                    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white/5 rounded-xl text-white/40">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Email</p>
                                    <p className="text-sm font-bold text-white/80">{user?.email}</p>
                                </div>
                            </div>
                            {!isEditingEmail && (
                                <button onClick={() => setIsEditingEmail(true)} className="text-primary text-xs font-bold uppercase tracking-wider">Cambiar</button>
                            )}
                        </div>
                        {isEditingEmail && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <input 
                                    type="email" 
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary"
                                    placeholder="Nuevo email..."
                                />
                                <button onClick={handleUpdateEmail} disabled={isLoading} className="size-10 bg-primary rounded-xl flex items-center justify-center text-white">
                                    {isLoading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
                                </button>
                                <button onClick={() => setIsEditingEmail(false)} className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* PIN */}
                    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white/5 rounded-xl text-white/40">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">PIN de Seguridad</p>
                                    <p className="text-sm font-bold text-white/80 tracking-widest">{isEditingPin ? '****' : currentPin.replace(/./g, '*')}</p>
                                </div>
                            </div>
                            {!isEditingPin && (
                                <button onClick={() => setIsEditingPin(true)} className="text-primary text-xs font-bold uppercase tracking-wider">Editar</button>
                            )}
                        </div>
                        {isEditingPin && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <input 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary tracking-widest"
                                    placeholder="Nuevo PIN..."
                                />
                                <button onClick={handleUpdatePin} disabled={isLoading} className="size-10 bg-primary rounded-xl flex items-center justify-center text-white">
                                    {isLoading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
                                </button>
                                <button onClick={() => setIsEditingPin(false)} className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-white/5 rounded-xl text-white/40">
                                <Smartphone size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Dispositivo</p>
                                <p className="text-sm font-bold text-white/80">RedCarpet Guard v1</p>
                            </div>
                        </div>
                    </div>
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
                    <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.4em]">RedCarpet Secure Protocol v3.5</p>
                </div>
            </div>
        </div>
    );
};
