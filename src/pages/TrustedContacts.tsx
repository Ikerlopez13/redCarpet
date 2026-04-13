import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { TrustedContactsService } from '../services/trustedContactsService';
import type { TrustedContact, PendingRequest } from '../services/trustedContactsService';

export const TrustedContacts: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [contacts, setContacts] = useState<TrustedContact[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchContacts = async () => {
            setLoading(true);
            const data = await TrustedContactsService.getContacts(user.id);
            const requests = await TrustedContactsService.getPendingRequests(user.id);
            setContacts(data);
            setPendingRequests(requests);
            setLoading(false);
        };

        fetchContacts();
    }, [user]);

    const handleAddContact = async () => {
        if (!user) return;

        const name = prompt('¿Cómo se llama tu contacto de confianza?', 'Mamá');
        if (!name) return; // User cancelled

        const phone = prompt('Introduce su número de teléfono (con código de país ej: +34)', '+34 600000000');
        if (!phone) return;

        const email = prompt('Introduce su correo electrónico (opcional, para sincronizar)', 'correo@ejemplo.com') || undefined;

        const { contact, error, isPendingRequest } = await TrustedContactsService.addContact(user.id, name, phone, email);
        if (contact) {
            setContacts([...contacts, contact]);
            if (isPendingRequest) {
                alert(`¡${name} usa RedCarpet! Le hemos enviado una solicitud de sincronización. Mientras tanto, tu alerta SOS funcionará de manera tradicional (SMS).`);
            }
        } else if (error) {
            alert('Error añadiendo contacto: ' + error);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar a ${name} de tus contactos de confianza?`)) {
            const { error } = await TrustedContactsService.deleteContact(id);
            if (!error) {
                setContacts(contacts.filter(c => c.id !== id));
            } else {
                alert('Error eliminando contacto: ' + error);
            }
        }
    };

    const handleRequest = async (requestId: string, accept: boolean) => {
        const { error } = await TrustedContactsService.respondToRequest(requestId, accept);
        if (!error) {
            // Remove from pending
            setPendingRequests(pendingRequests.filter(req => req.request_id !== requestId));
            if (accept) {
                // Fetch contacts again to inject the new accepted contact into the regular list
                if (user) {
                    const data = await TrustedContactsService.getContacts(user.id);
                    setContacts(data);
                }
            }
        } else {
            alert('Error respondiendo a la solicitud: ' + error);
        }
    };

    const toggleContact = async (id: string, field: 'share_location' | 'notify_emergency', currentValue: boolean) => {
        // Optimistic UI update
        setContacts(contacts.map(c =>
            c.id === id ? { ...c, [field]: !currentValue } : c
        ));

        // Call backend
        const { error } = await TrustedContactsService.updateToggle(id, field, !currentValue);
        if (error) {
            alert('Error sincronizando cambio.');
            // Revert on error
            setContacts(contacts.map(c =>
                c.id === id ? { ...c, [field]: currentValue } : c
            ));
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">

            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-12 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold">Contactos de Confianza</h1>
                <div className="w-10" /> {/* Spacer to keep title centered if needed, or just leave it empty */}
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
                <button
                    onClick={handleAddContact}
                    disabled={loading}
                    className="w-full h-12 bg-primary rounded-xl flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:bg-primary/90 transition-colors mb-8 disabled:opacity-50"
                >
                    <span className="material-symbols-outlined">person_add</span>
                    Añadir nuevo contacto
                </button>

                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-bold mb-4 text-primary">Solicitudes de Sincronización ({pendingRequests.length})</h3>
                        <div className="flex flex-col gap-4">
                            {pendingRequests.map(req => (
                                <div key={req.request_id} className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={req.requester_avatar || `https://ui-avatars.com/api/?name=${req.requester_name}&background=random`}
                                            alt={req.requester_name}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        <div className="flex flex-col flex-1">
                                            <span className="font-bold text-base">{req.requester_name}</span>
                                            <span className="text-white/60 text-xs">Quiere añadirte como contacto de confianza.</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full mt-1">
                                        <button
                                            onClick={() => handleRequest(req.request_id, false)}
                                            className="flex-1 py-2 bg-white/10 rounded-xl text-sm font-bold text-white hover:bg-white/20 transition-colors"
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleRequest(req.request_id, true)}
                                            className="flex-1 py-2 bg-primary rounded-xl text-sm font-bold text-white hover:bg-primary/90 transition-colors"
                                        >
                                            Aceptar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* List Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Mis contactos ({contacts.length})</h3>
                    <button className="text-primary text-sm font-bold hover:text-primary/80">Editar</button>
                </div>

                {/* Contacts List */}
                <div className="flex flex-col gap-4 mb-8">
                    {contacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-white/40 text-2xl">person_off</span>
                            </div>
                            <h4 className="text-white font-medium mb-1">No tienes contactos</h4>
                            <p className="text-white/40 text-xs">Añade familiares o amigos de confianza para compartir tu ubicación en emergencias.</p>
                        </div>
                    ) : (
                        contacts.map((contact) => (
                            <div key={contact.id} className="bg-white/5 rounded-2xl p-4 border border-white/5">

                                {/* Contact Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col">
                                        <h4 className="font-bold text-lg">{contact.name}</h4>
                                        <span className="text-sm text-white/60">Relación: {contact.relation} • {contact.phone}</span>
                                    </div>
                                    <button onClick={() => handleDelete(contact.id, contact.name)} className="text-white/40 hover:text-red-500 transition-colors mt-1">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
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
                                            onClick={() => toggleContact(contact.id, 'share_location', contact.share_location)}
                                            className={clsx(
                                                "w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
                                                contact.share_location ? "bg-primary" : "bg-white/20"
                                            )}
                                        >
                                            <div className={clsx(
                                                "size-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                                                contact.share_location ? "translate-x-5" : "translate-x-0"
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
                                            onClick={() => toggleContact(contact.id, 'notify_emergency', contact.notify_emergency)}
                                            className={clsx(
                                                "w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
                                                contact.notify_emergency ? "bg-primary" : "bg-white/20"
                                            )}
                                        >
                                            <div className={clsx(
                                                "size-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                                                contact.notify_emergency ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Disclaimer */}
                <p className="text-center text-white/40 text-[10px] italic leading-relaxed px-4">
                    Estos contactos serán notificados automáticamente si activas una alerta de emergencia. Tus datos están protegidos y solo se comparten con tu consentimiento.
                </p>

            </div>
        </div>
    );
};
