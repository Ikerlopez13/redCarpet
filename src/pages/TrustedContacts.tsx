import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface Contact {
    id: number;
    name: string;
    relation: string;
    shareLocation: boolean;
    notifyEmergency: boolean;
}

export const TrustedContacts: React.FC = () => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState<Contact[]>([
        { id: 1, name: 'Elena Rodríguez', relation: 'Madre', shareLocation: true, notifyEmergency: true },
        { id: 2, name: 'Carlos Mendoza', relation: 'Hermano', shareLocation: false, notifyEmergency: true },
        { id: 3, name: 'Sofía Valdés', relation: 'Amiga', shareLocation: false, notifyEmergency: false },
    ]);

    const toggleContact = (id: number, field: 'shareLocation' | 'notifyEmergency') => {
        setContacts(contacts.map(c =>
            c.id === id ? { ...c, [field]: !c[field] } : c
        ));
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">

            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-12 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold">Contactos de Confianza</h1>
                <button className="p-2 -mr-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">settings</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-8 px-6 no-scrollbar">

                {/* Search */}
                <div className="relative mb-6">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/40 text-xl">search</span>
                    <input
                        type="text"
                        placeholder="Buscar contacto..."
                        className="w-full h-12 bg-white/5 rounded-xl border border-white/5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                    />
                </div>

                {/* Add Button */}
                <button className="w-full h-12 bg-primary rounded-xl flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:bg-primary/90 transition-colors mb-8">
                    <span className="material-symbols-outlined">person_add</span>
                    Añadir nuevo contacto
                </button>

                {/* List Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Mis contactos ({contacts.length})</h3>
                    <button className="text-primary text-sm font-bold hover:text-primary/80">Editar</button>
                </div>

                {/* Contacts List */}
                <div className="flex flex-col gap-4 mb-8">
                    {contacts.map((contact) => (
                        <div key={contact.id} className="bg-white/5 rounded-2xl p-4 border border-white/5">

                            {/* Contact Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col">
                                    <h4 className="font-bold text-lg">{contact.name}</h4>
                                    <span className="text-sm text-white/60">Relación: {contact.relation}</span>
                                </div>
                                <span className="material-symbols-outlined text-white/40 text-sm mt-1">arrow_forward_ios</span>
                            </div>

                            {/* Toggles */}
                            <div className="space-y-4">
                                {/* Location Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-white/80">
                                        <span className="material-symbols-outlined text-primary text-base">location_on</span>
                                        Compartir ubicación
                                    </div>
                                    <button
                                        onClick={() => toggleContact(contact.id, 'shareLocation')}
                                        className={clsx(
                                            "w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
                                            contact.shareLocation ? "bg-primary" : "bg-white/20"
                                        )}
                                    >
                                        <div className={clsx(
                                            "size-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                                            contact.shareLocation ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                                <div className="h-px bg-white/5 w-full"></div>

                                {/* Emergency Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-white/80">
                                        <span className="material-symbols-outlined text-primary text-base">emergency_home</span>
                                        Notificar emergencias
                                    </div>
                                    <button
                                        onClick={() => toggleContact(contact.id, 'notifyEmergency')}
                                        className={clsx(
                                            "w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
                                            contact.notifyEmergency ? "bg-primary" : "bg-white/20"
                                        )}
                                    >
                                        <div className={clsx(
                                            "size-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                                            contact.notifyEmergency ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>

                {/* Footer Disclaimer */}
                <p className="text-center text-white/40 text-[10px] italic leading-relaxed px-4">
                    Estos contactos serán notificados automáticamente si activas una alerta de emergencia. Tus datos están protegidos y solo se comparten con tu consentimiento.
                </p>

            </div>
        </div>
    );
};
