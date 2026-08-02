import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, User, Mail, Shield, Smartphone, LogOut, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '../services/supabaseClient';

export const Account: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout, refreshProfile } = useAuth();
    const [isEditingPin, setIsEditingPin] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user?.profile?.full_name || '');
    const [newPin, setNewPin] = useState('');
    const [currentPin, setCurrentPin] = useState('****');
    const [isLoading, setIsLoading] = useState(false);

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
            alert(t('account.update_success'));
        } catch (err: any) {
            alert(t('account.update_error') + ': ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        await logout();
        navigate('/login');
    };

    const handleUpdatePin = async () => {
        if (newPin.length < 4) {
            alert(t('account.pin_min_length'));
            return;
        }
        setIsLoading(true);
        try {
            // 1. Save to Capacitor Preferences (SOS_PIN and sos_config)
            await Preferences.set({ key: 'SOS_PIN', value: newPin });
            const { value: configRaw } = await Preferences.get({ key: 'sos_config' });
            if (configRaw) {
                try {
                    const parsed = JSON.parse(configRaw);
                    parsed.pin = newPin;
                    await Preferences.set({ key: 'sos_config', value: JSON.stringify(parsed) });
                } catch (e) {
                    console.warn('[Account] Could not sync PIN into existing sos_config:', e);
                }
            }
            
            // 2. Save to localStorage for Web compatibility
            localStorage.setItem('SOS_PIN', newPin);
            if (configRaw) {
                try {
                    const parsed = JSON.parse(configRaw);
                    parsed.pin = newPin;
                    localStorage.setItem('sos_config', JSON.stringify(parsed));
                } catch {}
            }

            // 3. Save to remote Supabase Database & Refresh Profile
            if (user) {
                const { error } = await supabase.from('profiles').update({ sos_pin: newPin }).eq('id', user.id);
                if (error) throw error;
                await refreshProfile();
            }

            setCurrentPin(newPin);
            setNewPin('');
            setIsEditingPin(false);
            alert(t('account.pin_success'));
        } catch (err: any) {
            console.error('[Account] Error updating PIN:', err);
            alert(t('account.pin_error'));
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
                <h1 className="text-xl font-black uppercase italic tracking-tighter">{t('account.title')}</h1>
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
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">{user?.profile?.full_name || user?.email?.split('@')?.[0] || t('common.user')}</h2>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">{t('account.active_member')}</p>
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
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{t('account.full_name')}</p>
                                    <p className="text-sm font-bold text-white/80">{user?.profile?.full_name || t('account.not_configured')}</p>
                                </div>
                            </div>
                            {!isEditingName && (
                                <button onClick={() => setIsEditingName(true)} className="text-primary text-xs font-bold uppercase tracking-wider">{t('account.change')}</button>
                            )}
                        </div>
                        {isEditingName && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <input 
                                    type="text" 
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary font-bold"
                                    placeholder={t('account.name_placeholder')}
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
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{t('account.email')}</p>
                                    <p className="text-sm font-bold text-white/80">{user?.email}</p>
                                </div>
                            </div>
                            <div className="text-white/20 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                {t('account.verified')}
                            </div>
                        </div>
                    </div>

                    {/* PIN */}
                    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white/5 rounded-xl text-white/40">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{t('account.security_pin')}</p>
                                    <p className="text-sm font-bold text-white/80 tracking-widest">{isEditingPin ? '****' : currentPin.replace(/./g, '*')}</p>
                                </div>
                            </div>
                            {!isEditingPin && (
                                <button onClick={() => setIsEditingPin(true)} className="text-primary text-xs font-bold uppercase tracking-wider">{t('account.edit')}</button>
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
                                    placeholder={t('account.pin_placeholder')}
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
                                <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{t('account.device')}</p>
                                <p className="text-sm font-bold text-white/80">{t('account.companion_v1')}</p>
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
                    <span className="text-sm font-black uppercase tracking-widest">{t('account.logout')}</span>
                </button>

                <div className="text-center py-8">
                    <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.4em]">{t('account.secure_protocol')}</p>
                </div>
            </div>
        </div>
    );
};
