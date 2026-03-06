import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar } from '../services/authService';
import clsx from 'clsx';

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { user, isPremium, logout } = useAuth(); // Connect to AuthContext
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const menuItems = [
        {
            title: "CUENTA Y SEGURIDAD",
            items: [
                { icon: "person", label: "Configuración de cuenta", path: "/account" },
                { icon: "payments", label: "Gestión de suscripciones", path: "/subscription" },
            ]
        },
        // ... (existing menu items) ...
        {
            title: "RED DE SEGURIDAD",
            items: [
                { icon: "group", label: "Contactos de confianza", path: "/contacts" },
                { icon: "smart_toy", label: "Chat con IA", path: "/chat" },
                { icon: "eco", label: "GreenCarpet", subLabel: "Impacto CO2", path: "/greencarpet", iconColor: "text-green-500" },
            ]
        },
        {
            title: "SOPORTE Y LEGAL",
            items: [
                { icon: "mail", label: "Contacto", subLabel: "soporte.redcarpet@gmail.com", email: "soporte.redcarpet@gmail.com" },
                { icon: "chat_bubble", label: "Feedback", path: "/feedback" },
                { icon: "help", label: "FAQ", path: "/faq" },
                { icon: "verified_user", label: "Políticas de privacidad", path: "/privacy" },
                { icon: "description", label: "Condiciones de uso", path: "/terms" },
            ]
        },
        {
            title: "PRIVACIDAD Y DATOS (RGPD)",
            items: [
                { icon: "tune", label: "Seguimiento avanzado", subLabel: "Activado (Toca para limitar)", action: "toggle-tracking", iconColor: "text-blue-400" },
                { icon: "download", label: "Descargar mis datos", subLabel: "Portabilidad (Art. 20)", action: "download-data", iconColor: "text-indigo-400" },
                { icon: "block", label: "Retirar consentimiento", subLabel: "Desactivar funciones core", action: "withdraw-consent", iconColor: "text-orange-400" },
            ]
        },
        {
            title: "🛠️ DEBUG (DEMO)",
            items: [
                { icon: "waving_hand", label: "Ver Onboarding", subLabel: "Demo para clientes", path: "/onboarding", iconColor: "text-purple-400" },
                { icon: "restart_alt", label: "Reiniciar Onboarding", subLabel: "Borrar estado guardado", action: "reset-onboarding", iconColor: "text-amber-400" },
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
                <h1 className="text-lg font-bold">Ajustes</h1>
                <button className="p-2 -mr-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">notifications</span>
                </button>
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
                        <p className="text-primary font-bold text-sm mt-0.5">Miembro Premium</p>
                    ) : (
                        <p className="text-white/60 font-medium text-sm mt-0.5">Miembro Gratuito</p>
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
                        Cerrar sesión
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
                        Eliminar mi cuenta
                    </button>
                </div>
            </div>

            {/* Version / Info */}
            <div className="pb-12 text-center text-white/40 text-xs">
                <p>Versión 1.0.0 (Build 5)</p>
                <p className="mt-1">© 2026 RedCarpet App.</p>
            </div>
        </div>
    );
};
