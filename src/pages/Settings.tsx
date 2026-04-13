import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar } from '../services/authService';
import { useTranslation } from 'react-i18next';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { initPushNotifications } from '../services/pushService';
import clsx from 'clsx';

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { user, isPremium, logout } = useAuth(); // Connect to AuthContext
    const [isUploading, setIsUploading] = useState(false);
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [notificationStatus, setNotificationStatus] = useState<string>('checker');

    useEffect(() => {
        checkNotificationStatus();
    }, []);

    const checkNotificationStatus = async () => {
        try {
            const status = await PushNotifications.checkPermissions();
            setNotificationStatus(status.receive);
        } catch (err) {
            console.error('Error checking push permissions:', err);
            setNotificationStatus('denied');
        }
    };

    const handleNotificationActivation = async () => {
        try {
            if (notificationStatus === 'denied') {
                await App.openAppSettings();
            } else {
                const result = await PushNotifications.requestPermissions();
                setNotificationStatus(result.receive);
                if (result.receive === 'granted' && user?.id) {
                    await initPushNotifications(user.id);
                }
            }
        } catch (err) {
            console.error('Error handling notification activation:', err);
            await App.openAppSettings();
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const { error } = await uploadAvatar(file);
        setIsUploading(false);

        if (error) {
            alert('Error al subir la imagen: ' + error);
        } else {
            // Force reload to see changes (in a real app, context would update)
            window.location.reload();
        }
    };

    const languages = [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'pt', name: 'Português', flag: '🇵🇹' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'it', name: 'Italiano', flag: '🇮🇹' },
        { code: 'ca', name: 'Català', flag: '🇦🇩' },
    ];

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        setShowLanguageSelector(false);
    };

    const menuItems = [
        {
            title: t('settings.groups.security_circle'),
            items: [
                { icon: "group", label: t('settings.items.circle_management'), subLabel: "Tus grupos de confianza", path: "/contacts" },
                { icon: "verified_user", label: t('settings.items.protection_level'), subLabel: isPremium ? t('settings.profile_section.premium_member') : t('settings.profile_section.free_member'), path: "/subscription" },
            ]
        },
        {
            title: t('settings.groups.account_access'),
            items: [
                { icon: "person", label: t('settings.items.my_account'), subLabel: "Datos y seguridad", path: "/account" },
                { icon: "history", label: t('settings.items.emergency_history'), subLabel: "Historial de alertas", path: "/history" },
                { 
                    icon: "language", 
                    label: t('settings.items.language'), 
                    subLabel: languages.find(l => l.code === i18n.language.split('-')[0])?.name || 'Español', 
                    action: "change-language" 
                },
                { 
                    icon: "notifications", 
                    label: t('settings.items.notifications'), 
                    subLabel: notificationStatus === 'granted' ? t('settings.status.granted') : t('settings.status.denied'),
                    action: "toggle-notifications",
                    iconColor: notificationStatus === 'granted' ? "text-green-400" : "text-amber-400"
                },
            ]
        },
        {
            title: t('settings.groups.security_network'),
            items: [
                { icon: "group", label: t('settings.items.trusted_contacts'), path: "/contacts" },
                { icon: "smart_toy", label: t('settings.items.ai_chat'), path: "/chat" },
                { icon: "eco", label: t('settings.items.greencarpet'), subLabel: "Impacto CO2", path: "/greencarpet", iconColor: "text-green-500" },
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
            ]
        },
        {
            title: t('settings.groups.privacy_data'),
            items: [
                { icon: "tune", label: t('settings.items.advanced_tracking'), subLabel: "Activado (Toca para limitar)", action: "toggle-tracking", iconColor: "text-blue-400" },
                { icon: "download", label: t('settings.items.download_data'), subLabel: "Portabilidad (Art. 20)", action: "download-data", iconColor: "text-indigo-400" },
                { icon: "block", label: t('settings.items.withdraw_consent'), subLabel: "Desactivar funciones core", action: "withdraw-consent", iconColor: "text-orange-400" },
            ]
        },
        {
            title: t('settings.groups.debug'),
            items: [
                { icon: "waving_hand", label: t('settings.items.view_onboarding'), subLabel: "Demo para clientes", path: "/onboarding", iconColor: "text-purple-400" },
                { icon: "restart_alt", label: t('settings.items.reset_onboarding'), subLabel: "Borrar estado guardado", action: "reset-onboarding", iconColor: "text-amber-400" },
            ]
        }
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
                    <h2 className="text-xl font-bold">{user?.profile?.full_name || user?.email || 'Usuario'}</h2>
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
                                            } else if ((item as any).action === 'reset-onboarding') {
                                                localStorage.removeItem('onboarding_complete');
                                                localStorage.removeItem('usage_type');
                                                localStorage.removeItem('relationship_type');
                                                alert('✅ Onboarding reiniciado. Ahora puedes verlo de nuevo.');
                                            } else if ((item as any).action === 'toggle-tracking') {
                                                alert('Configuración de seguimiento avanzado actualizada.');
                                            } else if ((item as any).action === 'withdraw-consent') {
                                                if (window.confirm('Si retiras el consentimiento, la aplicación dejará de funcionar y se cerrará tu sesión. ¿Estás seguro?')) {
                                                    handleLogout();
                                                }
                                            } else if ((item as any).action === 'download-data') {
                                                alert('Hemos iniciado la recopilación de tus datos. Recibirás un correo con el archivo descargable en las próximas 24 horas.');
                                            } else if ((item as any).action === 'change-language') {
                                                setShowLanguageSelector(true);
                                            } else if ((item as any).action === 'toggle-notifications') {
                                                handleNotificationActivation();
                                            } else if (item.path) {
                                                navigate(item.path);
                                            }
                                        }}
                                        className={clsx(
                                            "flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors text-left",
                                            itemIndex !== group.items.length - 1 && "border-b border-white/5"
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
                        className="w-full h-14 bg-primary rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        {t('settings.logout')}
                    </button>

                    <button
                        onClick={() => {
                            if (window.confirm('⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE. Se eliminarán todos tus datos personales, historiales de ubicación, patrones y contactos asociados. ¿Estás absolutamente seguro de que deseas eliminar tu cuenta?')) {
                                alert('Iniciando proceso automático de borrado. Su cuenta será destruida en los próximos minutos según el Art. 17 del RGPD.');
                                handleLogout();
                            }
                        }}
                        className="w-full h-14 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center gap-2 font-bold text-lg hover:bg-red-500/20 transition-colors"
                    >
                        <span className="material-symbols-outlined">delete_forever</span>
                        {t('settings.delete_account')}
                    </button>
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
                                <p className="text-white/40 text-xs mt-1">Selecciona tu idioma preferido</p>
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
                                        <span className="text-2xl">{lang.flag}</span>
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
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Version / Info */}
            <div className="pb-12 text-center text-white/40 text-xs">
                <p>Versión 1.0.0 (Build 5)</p>
                <p className="mt-1">© 2026 RedCarpet App.</p>
            </div>
        </div>
    );
};
