import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar, deleteUserAccount } from '../services/authService';
import { useTranslation } from 'react-i18next';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { initPushNotifications, getPushPermissionStatus } from '../services/pushService';
import { SOSConfigSheet, type SOSConfigData } from '../components/SOSConfigSheet';
import clsx from 'clsx';

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { user, isPremium, logout, refreshProfile } = useAuth(); // Connect to AuthContext
    const [isUploading, setIsUploading] = useState(false);
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);
    const [showSOSConfig, setShowSOSConfig] = useState(false);
    const [fileInputRef] = [useRef<HTMLInputElement>(null)];
    const [notificationStatus, setNotificationStatus] = useState<string>('checker');
    const [useMiles, setUseMiles] = useState<boolean>(localStorage.getItem('use_miles') === 'true');

    useEffect(() => {
        const loadSettings = async () => {
            const { value } = await Preferences.get({ key: 'use_miles' });
            if (value !== null) {
                setUseMiles(value === 'true');
            } else {
                // Fallback to localStorage if Preferences is empty (migration)
                const legacy = localStorage.getItem('use_miles') === 'true';
                setUseMiles(legacy);
                await Preferences.set({ key: 'use_miles', value: String(legacy) });
            }
        };
        loadSettings();
        checkNotificationStatus();
    }, []);

    const checkNotificationStatus = async () => {
        try {
            const status = await getPushPermissionStatus();
            setNotificationStatus(status);
        } catch (err) {
            console.error('Error checking push permissions:', err);
            setNotificationStatus('denied');
        }
    };

    const handleNotificationActivation = async () => {
        try {
            if (notificationStatus === 'denied') {
                // NativeSettings is the correct way, fallback to window.location for now
                if (Capacitor.getPlatform() === 'ios') {
                    window.location.href = 'app-settings:';
                } else {
                    alert(t('settings.notifications.open_settings'));
                }
            } else {
                if (user?.id) {
                    await initPushNotifications(user.id);
                    // We don't have direct access to PushNotifications here,
                    // so we rely on checkNotificationStatus to refresh.
                    setTimeout(checkNotificationStatus, 1000);
                    alert(t('settings.notifications.requested'));
                }
            }
        } catch (err) {
            console.error('Error handling notification activation:', err);
            alert(t('settings.notifications.open_settings'));
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(t('settings.delete_account_confirm'));
        if (!confirmed) return;

        const secondConfirmed = window.confirm(t('settings.delete_account_second_confirm'));
        if (!secondConfirmed) return;

        try {
            const { error } = await deleteUserAccount();
            if (error) {
                alert(t('settings.delete_account_error') + ': ' + error);
            } else {
                alert(t('settings.delete_account_success'));
                navigate('/login');
            }
        } catch (err) {
            console.error('Account deletion error:', err);
            alert(t('settings.delete_account_error'));
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const { error } = await uploadAvatar(file);
        setIsUploading(false);

        if (error) {
            alert(t('settings.avatar_upload_error') + ': ' + error);
        } else {
            // Force reload to see changes (in a real app, context would update)
            window.location.reload();
        }
    };

    const languages = [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'ca', name: 'Català', flag: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="900" height="600" fill="%23fcd116"/><rect width="900" height="66.666" y="66.666" fill="%23ce1126"/><rect width="900" height="66.666" y="200" fill="%23ce1126"/><rect width="900" height="66.666" y="333.333" fill="%23ce1126"/><rect width="900" height="66.666" y="466.666" fill="%23ce1126"/></svg>' },
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'pt', name: 'Português', flag: '🇵🇹' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'it', name: 'Italiano', flag: '🇮🇹' }
    ];

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        setShowLanguageSelector(false);
    };

    const menuItems = [
        {
            title: t('settings.groups.security_circle'),
            items: [
                { icon: "group", label: t('settings.items.circle_management'), subLabel: t('settings.items.circle_management_sub'), path: "/contacts" },
                { 
                    icon: isPremium ? "workspace_premium" : "verified_user", 
                    label: t('settings.items.protection_level'), 
                    subLabel: isPremium ? t('settings.profile_section.premium_member') : t('settings.profile_section.free_member'), 
                    path: "/subscription",
                    iconColor: isPremium ? "text-yellow-400" : "text-primary",
                    isPremiumCTA: !isPremium
                },
                { 
                    icon: "settings_suggest", 
                    label: "Configuración SOS", 
                    subLabel: "Ajustar protocolo y contactos", 
                    action: "reconfigure-sos",
                    iconColor: "text-red-500"
                },
                {
                    icon: "widgets",
                    label: "Widgets y SOS Discreto",
                    subLabel: "Configuración y demo táctil",
                    path: "/widgets",
                    iconColor: "text-amber-500"
                },
            ]
        },
        {
            title: t('settings.groups.account_access'),
            items: [
                { icon: "person", label: t('settings.items.my_account'), subLabel: t('settings.items.my_account_sub'), path: "/account" },
                { 
                    icon: "language", 
                    label: t('settings.items.language'), 
                    subLabel: languages.find(l => l.code === i18n.language.split('-')[0])?.name || t('languages.spanish'), 
                    action: "change-language" 
                },
                { 
                    icon: "notifications", 
                    label: t('settings.items.notifications'), 
                    subLabel: notificationStatus === 'granted' ? t('settings.status.granted') : t('settings.status.denied'),
                    action: "toggle-notifications",
                    iconColor: notificationStatus === 'granted' ? "text-green-400" : "text-amber-400"
                },
                { 
                    icon: "straighten", 
                    label: t('settings.items.measurement_system'), 
                    subLabel: useMiles ? t('settings.items.unit_imperial') : t('settings.items.unit_metric'), 
                    action: "toggle-distance-unit",
                    iconColor: "text-blue-400"
                },
            ]
        },
        {
            title: t('settings.groups.security_network'),
            items: [
                { icon: "group", label: t('settings.items.trusted_contacts'), path: "/contacts" },
                { icon: "smart_toy", label: t('settings.items.ai_chat'), path: "/chat" },
                { icon: "eco", label: t('settings.items.greencarpet'), subLabel: t('settings.items.greencarpet_sub'), path: "/greencarpet", iconColor: "text-green-500" },
            ]
        },
        {
            title: t('settings.groups.support_legal'),
            items: [
                { icon: "mail", label: t('settings.items.contact'), subLabel: "soporte.redcarpet@gmail.com", email: "soporte.redcarpet@gmail.com" },
                { icon: "chat_bubble", label: t('settings.items.feedback'), path: "/feedback" },
                { icon: "help", label: t('settings.items.faq'), path: "/faq" },
                { icon: "verified_user", label: t('settings.items.privacy_policy'), path: "/privacy" },
                { icon: "description", label: t('settings.items.terms_of_use'), path: "/terms" },
                { icon: "gavel", label: t('settings.legal_notice'), path: "/eula" },
            ]
        },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-12">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold">{t('settings.title')}</h1>
                <div className="w-10" /> {/* Spacer to keep title centered */}
            </div>

            <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
                {/* Profile Section */}
                <div className="flex flex-col items-center pt-4 pb-8">
                    <div className="relative mb-4">
                        <div className="size-24 rounded-full border-2 border-primary p-1">
                            <img
                                src={user?.profile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=random`}
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover"
                            />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow-lg border-2 border-background-dark flex items-center justify-center disabled:opacity-50"
                        >
                            {isUploading ? (
                                <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-sm">edit</span>
                            )}
                        </button>
                    </div>
                    <h2 className="text-xl font-bold">{user?.profile?.full_name || user?.email || t('common.user')}</h2>
                    {isPremium ? (
                        <p className="text-primary font-bold text-sm mt-0.5">{t('settings.profile_section.premium_member')}</p>
                    ) : (
                        <p className="text-white/60 font-medium text-sm mt-0.5">{t('settings.profile_section.free_member')}</p>
                    )}
                    <p className="text-white/40 text-xs mt-1">{user?.email}</p>

                </div>

                {/* Groups */}
                <div className="flex flex-col gap-6">
                    {menuItems.map((group, groupIndex) => (
                        <div key={groupIndex} className="flex flex-col">
                            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-6 mb-2">
                                {group.title}
                            </h3>
                            <div className="flex flex-col bg-white/5 border-y border-white/5">
                                {group.items.map((item, itemIndex) => (
                                    <button
                                        key={itemIndex}
                                        onClick={() => {
                                            if ((item as any).email) {
                                                window.location.href = `mailto:${(item as any).email}`;
                                            } else if ((item as any).action === 'change-language') {
                                                setShowLanguageSelector(true);
                                            } else if ((item as any).action === 'toggle-notifications') {
                                                handleNotificationActivation();
                                            } else if ((item as any).action === 'toggle-distance-unit') {
                                                const newValue = !useMiles;
                                                setUseMiles(newValue);
                                                Preferences.set({ key: 'use_miles', value: String(newValue) });
                                                localStorage.setItem('use_miles', String(newValue));
                                            } else if ((item as any).action === 'reconfigure-sos') {
                                                setShowSOSConfig(true);
                                            } else if (item.path) {
                                                navigate(item.path);
                                            }
                                        }}
                                        className={clsx(
                                            "flex items-center gap-4 transition-colors text-left",
                                            (item as any).isPremiumCTA 
                                                ? "bg-primary/10 border border-primary/30 rounded-2xl mx-4 my-3 px-4 py-4 hover:bg-primary/20" 
                                                : "px-6 py-4 hover:bg-white/5",
                                            itemIndex !== group.items.length - 1 && !(item as any).isPremiumCTA && "border-b border-white/5"
                                        )}
                                    >
                                        <div className={clsx(
                                            "flex items-center justify-center size-10 rounded-xl bg-white/5 shrink-0",
                                            (item as any).iconColor || "text-white/80"
                                        )}>
                                            <span className="material-symbols-outlined">{item.icon}</span>
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <span className="text-sm font-semibold">{item.label}</span>
                                            {item.subLabel && (
                                                <span className="text-xs text-white/40 mt-0.5">{item.subLabel}</span>
                                            )}
                                        </div>
                                        <span className="material-symbols-outlined text-white/40 text-sm">arrow_forward_ios</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Logout & Delete */}
                <div className="px-6 mt-8 mb-8 flex flex-col gap-4">
                    <button
                        onClick={handleLogout}
                        className="w-full h-14 bg-white/10 rounded-xl flex items-center justify-center gap-2 font-bold text-lg hover:bg-white/20 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        {t('settings.logout')}
                    </button>

                    <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 px-2">{t('settings.account_actions')}</p>
                        <button
                            onClick={handleDeleteAccount}
                            className="w-full h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center gap-2 font-bold text-lg hover:bg-red-500/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-red-500">delete_forever</span>
                            {t('settings.delete_account')}
                        </button>
                    </div>

                </div>

                {/* Language Selector Overlay */}
                {showLanguageSelector && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pb-24">
                        <div 
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowLanguageSelector(false)}
                        />
                        <div className="relative w-full max-w-sm bg-background-dark/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-white/10">
                                <h3 className="text-xl font-bold">{t('settings.items.language')}</h3>
                                <p className="text-white/40 text-xs mt-1">{t('settings.language_selector_desc')}</p>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => changeLanguage(lang.code)}
                                        className={clsx(
                                            "w-full flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5",
                                            i18n.language.startsWith(lang.code) ? "bg-primary/10 text-primary" : "text-white"
                                        )}
                                    >
                                        {lang.flag.startsWith('http') || lang.flag.startsWith('data:') ? (
                                            <img src={lang.flag} alt={lang.name} className="size-6 rounded-sm object-cover" />
                                        ) : (
                                            <span className="text-2xl">{lang.flag}</span>
                                        )}
                                        <span className="flex-1 text-left font-bold">{lang.name}</span>
                                        {i18n.language.startsWith(lang.code) && (
                                            <span className="material-symbols-outlined">check_circle</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowLanguageSelector(false)}
                                className="w-full py-4 text-white/60 font-medium hover:text-white transition-colors border-t border-white/10"
                            >
                                {t('settings.cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mandated Disclaimer */}
            <div className="px-6 mb-8 mt-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                    <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                        {t('settings.report_disclaimer')}
                    </p>
                </div>
            </div>

            {/* Version / Info */}
            <div className="pb-12 text-center text-white/40 text-xs">
                <p>{t('settings.version')} 1.0.0 ({t('settings.build')} 5)</p>
                <p className="mt-1">© 2026 {t('onboarding.welcome.title')} App.</p>
            </div>

            {/* SOS Config Sheet Overlay */}
            <SOSConfigSheet
                isOpen={showSOSConfig}
                onClose={() => setShowSOSConfig(false)}
                onSave={async (config) => {
                    // 1. Save to Capacitor Preferences
                    await Preferences.set({ key: 'sos_config', value: JSON.stringify(config) });
                    await Preferences.set({ key: 'SOS_PIN', value: config.pin });
                    
                    // 2. Save to localStorage for Web compatibility
                    localStorage.setItem('sos_config', JSON.stringify(config));
                    localStorage.setItem('SOS_PIN', config.pin);
                    
                    // 3. Save to remote Supabase Database & Refresh Profile
                    if (user) {
                        try {
                            const { supabase } = await import('../services/supabaseClient');
                            await supabase.from('profiles').update({ sos_pin: config.pin }).eq('id', user.id);
                            await refreshProfile();
                        } catch (err) {
                            console.error('[Settings] Error updating profile pin:', err);
                        }
                    }
                    
                    setShowSOSConfig(false);
                }}
                currentConfig={(() => {
                    const localRaw = localStorage.getItem('sos_config');
                    if (localRaw) {
                        try {
                            return JSON.parse(localRaw);
                        } catch {}
                    }
                    return undefined;
                })()}
            />
        </div>
    );
};
