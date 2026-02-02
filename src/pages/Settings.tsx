import React from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export const Settings: React.FC = () => {
    const navigate = useNavigate();

    const menuItems = [
        {
            title: "CUENTA Y SEGURIDAD",
            items: [
                { icon: "person", label: "Configuración de cuenta", path: "/account" },
                { icon: "payments", label: "Gestión de suscripciones", path: "/subscription" },
            ]
        },
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
                                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=260&auto=format&fit=crop"
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover"
                            />
                        </div>
                        <button className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow-lg border-2 border-background-dark flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                    </div>
                    <h2 className="text-xl font-bold">Alejandro García</h2>
                    <p className="text-primary font-bold text-sm mt-0.5">Miembro Premium</p>
                    <p className="text-white/40 text-xs mt-1">Ver y editar perfil</p>
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

                {/* Logout */}
                <div className="px-6 mt-8 mb-8">
                    <button className="w-full h-14 bg-primary rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg hover:bg-primary/90 transition-colors">
                        <span className="material-symbols-outlined">logout</span>
                        Cerrar sesión
                    </button>
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-1 pb-8 opacity-40">
                    <div className="flex items-center gap-2">
                        <div className="size-4 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">R</div>
                        <span className="text-xs font-bold tracking-widest">REDCARPET</span>
                    </div>
                    <span className="text-[10px] font-mono">V2.4.0 (BUILD 891)</span>
                </div>
            </div>
        </div>
    );
};
