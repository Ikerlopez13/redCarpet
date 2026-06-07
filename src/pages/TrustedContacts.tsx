import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { TrustedContactsService, getShortId, findUserByShortId } from '../services/trustedContactsService';
import type { TrustedContact, PendingRequest } from '../services/trustedContactsService';
import { supabase } from '../services/supabaseClient';
import { Capacitor } from '@capacitor/core';
interface DeviceContact {
    displayName?: string;
    phoneNumbers?: { number: string; type?: string }[];
}

export const TrustedContacts: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { user } = useAuth();
    
    // Core state
    const [contacts, setContacts] = useState<TrustedContact[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Picker state
    const [showContactPicker, setShowContactPicker] = useState(false);
    const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
    const [searchContactsQuery, setSearchContactsQuery] = useState('');
    const [showNumberSelector, setShowNumberSelector] = useState<DeviceContact | null>(null);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

    // Apple-style drawer state
    const [showAddContactSelector, setShowAddContactSelector] = useState(false);
    // ID-based add
    const [addByIdInput, setAddByIdInput] = useState('');
    const [addByIdName, setAddByIdName] = useState('');
    const [addByIdLoading, setAddByIdLoading] = useState(false);
    const [addByIdError, setAddByIdError] = useState<string | null>(null);
    const [showIdForm, setShowIdForm] = useState(false);

    // Manual add
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [manualError, setManualError] = useState<string | null>(null);

    // Derived short ID for this user
    const myShortId = user ? getShortId(user.id) : '';

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

    // Add contact by short ID
    const handleAddByShortId = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const rawId = addByIdInput.trim();
        if (!rawId) return;

        setAddByIdLoading(true);
        setAddByIdError(null);

        const found = await findUserByShortId(rawId);
        if (!found) {
            setAddByIdError('No se ha encontrado ningún usuario con ese ID. Comprueba que esté bien escrito.');
            setAddByIdLoading(false);
            return;
        }
        if (found.id === user.id) {
            setAddByIdError('No puedes añadirte a ti mismo.');
            setAddByIdLoading(false);
            return;
        }

        const displayName = addByIdName.trim() || found.full_name || `Usuario ${rawId.toUpperCase()}`;

        // Insert directly with the associated_user_id already known — status pending
        const { data, error } = await (supabase.from('trusted_contacts') as any)
            .insert({
                user_id: user.id,
                name: displayName,
                phone: '',
                relation: 'Familiar',
                share_location: true,
                notify_emergency: true,
                associated_user_id: found.id,
                status: 'pending'
            } as any)
            .select('*')
            .single();

        if (error) {
            setAddByIdError('Error al añadir el contacto. Inténtalo de nuevo.');
        } else {
            setContacts(prev => [...prev, data as TrustedContact]);
            setAddByIdInput('');
            setAddByIdName('');
            setShowIdForm(false);
            setShowAddContactSelector(false);
            alert(`✅ Solicitud enviada a ${displayName}. Cuando acepte aparecerá en tu lista.`);
        }
        setAddByIdLoading(false);
    };

    // Manual contact add handler
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const name = manualName.trim();
        const phone = manualPhone.trim();
        if (!name || !phone) return;

        setManualLoading(true);
        setManualError(null);

        const { contact, error, isPendingRequest } = await TrustedContactsService.addContact(
            user.id,
            name,
            phone,
            undefined,
            'Familiar'
        );

        if (contact) {
            setContacts(prev => [...prev, contact]);
            setManualName('');
            setManualPhone('');
            setShowManualForm(false);
            setShowAddContactSelector(false);
            if (isPendingRequest) {
                alert(t('contacts.sync_alert', { name }));
            } else {
                alert(`✅ Contacto ${name} añadido con éxito.`);
            }
        } else if (error) {
            setManualError(error || 'Error al añadir el contacto.');
        }
        setManualLoading(false);
    };

    // Native and web contacts picker import handler
    const handleImportContacts = async () => {
        if (!user) return;

        try {
            if (Capacitor.isNativePlatform()) {
                const { Contacts } = await import('@capacitor-community/contacts');
                const permissionState = await Contacts.requestPermissions();
                if (permissionState.contacts !== 'granted') {
                    setIsPermissionsModalOpen(true);
                    return;
                }

                setLoading(true);
                const { contacts: nativeList } = await Contacts.getContacts({
                    projection: { name: true, phones: true }
                });
                
                const formatted = nativeList.map((c: any) => ({
                    displayName: c.displayName || c.name?.display || `${c.name?.given || ''} ${c.name?.family || ''}`.trim() || 'Contacto sin nombre',
                    phoneNumbers: (c.phones || []).map((p: any) => ({
                        number: p.number || p.value || '',
                        type: p.type || 'móvil'
                    })).filter((p: any) => p.number.trim() !== '')
                }));

                formatted.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
                setDeviceContacts(formatted);
                setSearchContactsQuery('');
                setShowContactPicker(true);
            } else {
                const mockContacts: DeviceContact[] = [
                    { displayName: 'Mamá ❤️', phoneNumbers: [{ number: '+34 611 223 344', type: 'móvil' }] },
                    { displayName: 'Papá 🏠', phoneNumbers: [{ number: '+34 622 334 455', type: 'móvil' }] },
                ];
                setDeviceContacts(mockContacts);
                setSearchContactsQuery('');
                setShowContactPicker(true);
            }
        } catch (err) {
            console.error('Error importing contacts', err);
            alert(t('contacts.import_error'));
        } finally {
            setLoading(false);
        }
    };

    // Complete import contact writing to Supabase (Optimistic)
    const addContactFromPicker = async (name: string, phone: string) => {
        if (!user) return;
        
        // Optimistic update
        const tempId = `temp_${Date.now()}`;
        const tempContact: TrustedContact = {
            id: tempId,
            user_id: user.id,
            name,
            phone,
            relation: 'Familiar',
            share_location: true,
            notify_emergency: true,
            associated_user_id: null,
            status: 'accepted',
            created_at: new Date().toISOString()
        };
        
        setContacts(prev => [...prev, tempContact]);
        setShowContactPicker(false);
        setShowNumberSelector(null);
        setShowAddContactSelector(false); // Close the Apple-style drawer!
        
        // Background sync
        const { contact, error, isPendingRequest } = await TrustedContactsService.addContact(user.id, name, phone, undefined, 'Familiar');
        
        if (contact) {
            setContacts(prev => prev.map(c => c.id === tempId ? contact : c));
            if (isPendingRequest) {
                alert(t('contacts.sync_alert', { name }));
            } else {
                alert(`✅ Solicitud enviada a ${name}. Cuando acepte aparecerá en tu lista.`);
            }
        } else if (error) {
            setContacts(prev => prev.filter(c => c.id !== tempId));
            alert(t('contacts.add_error') + ': ' + error);
        }
    };

    const handleNativeAddContact = async () => {
        if (!user) return;
        try {
            if (Capacitor.isNativePlatform()) {
                const { Contacts } = await import('@capacitor-community/contacts');
                const permissionState = await Contacts.requestPermissions();
                if (permissionState.contacts !== 'granted') {
                    setIsPermissionsModalOpen(true);
                    return;
                }
                
                const contact = await Contacts.pickContact({
                    projection: { name: true, phones: true }
                });
                
                if (contact && contact.contact) {
                    const c = contact.contact;
                    const name = c.displayName || c.name?.display || `${c.name?.given || ''} ${c.name?.family || ''}`.trim() || 'Contacto';
                    const phones = (c.phones || []).map((p: any) => p.number || p.value).filter(Boolean);
                    
                    if (phones.length === 0) {
                        alert(t('contacts.contact_no_phone'));
                        return;
                    }
                    if (phones.length === 1) {
                        addContactFromPicker(name, phones[0]);
                    } else {
                        setShowNumberSelector({
                            displayName: name,
                            phoneNumbers: phones.map(p => ({ number: p, type: 'móvil' }))
                        });
                    }
                }
            } else {
                setShowAddContactSelector(true);
            }
        } catch (err) {
            console.log('User cancelled picker or error', err);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(t('contacts.delete_confirm', { name }))) {
            const { error } = await TrustedContactsService.deleteContact(id);
            if (!error) {
                setContacts(contacts.filter(c => c.id !== id));
            } else {
                alert(t('contacts.delete_error') + ': ' + error);
            }
        }
    };

    const handleRequest = async (requestId: string, accept: boolean) => {
        const { error } = await TrustedContactsService.respondToRequest(requestId, accept, user?.id);
        if (!error) {
            setPendingRequests(pendingRequests.filter(req => req.request_id !== requestId));
            if (accept) {
                if (user) {
                    const data = await TrustedContactsService.getContacts(user.id);
                    setContacts(data);
                }
            }
        } else {
            alert(t('contacts.respond_error') + ': ' + error);
        }
    };

    const toggleContact = async (id: string, field: 'share_location' | 'notify_emergency', currentValue: boolean) => {
        setContacts(contacts.map(c =>
            c.id === id ? { ...c, [field]: !currentValue } : c
        ));

        const { error } = await TrustedContactsService.updateToggle(id, field, !currentValue);
        if (error) {
            alert(t('contacts.sync_error'));
            setContacts(contacts.map(c =>
                c.id === id ? { ...c, [field]: currentValue } : c
            ));
        }
    };

    const handleWhatsAppInvite = () => {
        const shortId = myShortId;
        const inviteText = `¡Únete a mi círculo de seguridad en RedCarpet! 🛡️🔴\n\nMi ID es: ${shortId}\n\n📥 Descárgate la app y añádeme con mi ID:\nhttps://apps.apple.com/app/id6755689618`;
        window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank');
    };

    // Filter added contacts based on search query
    const filteredAddedContacts = contacts.filter(c => 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery)
    );

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">

            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-12 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/80 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold">{t('contacts.title')}</h1>
                <div className="w-10" />
            </div>

            {/* My ID Banner */}
            {myShortId && (
                <div className="mx-4 mb-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Tu ID de RedCarpet</p>
                        <p className="text-xl font-black text-primary tracking-wider">{myShortId}</p>
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard?.writeText(myShortId);
                            alert(`¡ID copiado! Compártelo con quien quieras añadirte.`);
                        }}
                        className="h-10 px-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                        Copiar
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto pb-8 px-6 no-scrollbar">

                {/* Search */}
                <div className="relative mb-6">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/40 text-xl">search</span>
                    <input
                        type="text"
                        placeholder={t('contacts.search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 bg-white/5 rounded-xl border border-white/5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                    />
                </div>

                <div className="mb-8 space-y-3">
                    <button
                        onClick={() => setShowAddContactSelector(true)}
                        className="w-full h-14 bg-gradient-to-r from-primary to-primary/80 text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-base shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">person_add</span>
                        {t('contacts.add_contact', 'Añadir Contacto')}
                    </button>

                    <button
                        onClick={handleWhatsAppInvite}
                        className="w-full h-14 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-base shadow-xl shadow-[#25D366]/20 hover:scale-[1.01] active:scale-95 transition-all"
                    >
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                        </svg>
                        Invitar por WhatsApp
                    </button>
                </div>

                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-bold mb-4 text-primary">{t('contacts.sync_requests')} ({pendingRequests.length})</h3>
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
                                            <span className="text-white/60 text-xs">{t('contacts.wants_to_add')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full mt-1">
                                        <button
                                            onClick={() => handleRequest(req.request_id, false)}
                                            className="flex-1 py-2 bg-white/10 rounded-xl text-sm font-bold text-white hover:bg-white/20 transition-colors"
                                        >
                                            {t('contacts.reject')}
                                        </button>
                                        <button
                                            onClick={() => handleRequest(req.request_id, true)}
                                            className="flex-1 py-2 bg-primary rounded-xl text-sm font-bold text-white hover:bg-primary/90 transition-colors"
                                        >
                                            {t('contacts.accept')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* List Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">{t('contacts.my_contacts')} ({filteredAddedContacts.length})</h3>
                    <button className="text-primary text-sm font-bold hover:text-primary/80">{t('contacts.edit')}</button>
                </div>

                {/* Contacts List */}
                <div className="flex flex-col gap-4 mb-8">
                    {filteredAddedContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-white/40 text-2xl">person_off</span>
                            </div>
                            <h4 className="text-white font-medium mb-1">{t('contacts.no_contacts')}</h4>
                            <p className="text-white/40 text-xs">{t('contacts.no_contacts_desc')}</p>
                        </div>
                    ) : (
                        filteredAddedContacts.map((contact) => (
                            <div key={contact.id} className="bg-white/5 rounded-2xl p-4 border border-white/5">

                                {/* Contact Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col">
                                        <h4 className="font-bold text-lg">{contact.name}</h4>
                                        <span className="text-sm text-white/60">{t('contacts.relation')}: {contact.relation} • {contact.phone}</span>
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
                                            {t('contacts.share_location')}
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
                                            {t('contacts.notify_emergencies')}
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
                    {t('contacts.footer_disclaimer')}
                </p>

            </div>

            {/* Device Contact Selector Sliding Drawer */}
            {showContactPicker && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-md transition-opacity duration-300">
                    <div className="absolute inset-0 -z-10" onClick={() => setShowContactPicker(false)} />
                    
                    <div className="flex flex-col h-[80vh] bg-[#111115] border-t border-white/10 rounded-t-[2.5rem] shadow-2xl overflow-hidden">
                        {/* Drawer drag handle & header */}
                        <div className="flex flex-col items-center p-4 shrink-0 border-b border-white/5">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
                            <div className="flex justify-between items-center w-full px-2">
                                <h2 className="text-xl font-bold text-white">{t('contacts.import_agenda')}</h2>
                                <button 
                                    onClick={() => setShowContactPicker(false)}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="p-4 shrink-0">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/40 text-xl">search</span>
                                <input
                                    type="text"
                                    placeholder={t('contacts.search_agenda')}
                                    value={searchContactsQuery}
                                    onChange={(e) => setSearchContactsQuery(e.target.value)}
                                    className="w-full h-12 bg-white/5 rounded-xl border border-white/5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        {/* Contacts List */}
                        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-2 no-scrollbar">
                            {deviceContacts
                                .filter(c => 
                                    (c.displayName || '').toLowerCase().includes(searchContactsQuery.toLowerCase()) ||
                                    (c.phoneNumbers || []).some(p => p.number.includes(searchContactsQuery))
                                )
                                .map((c, idx) => {
                                    const initial = (c.displayName || ' ').charAt(0).toUpperCase();
                                    const hue = (initial.charCodeAt(0) * 15) % 360;
                                    const avatarBg = `hsl(${hue}, 60%, 45%)`;

                                    return (
                                        <div 
                                            key={idx}
                                            onClick={() => {
                                                if (!c.phoneNumbers || c.phoneNumbers.length === 0) {
                                                    alert(t('contacts.contact_no_phone'));
                                                } else if (c.phoneNumbers.length === 1) {
                                                    addContactFromPicker(c.displayName || 'Contacto', c.phoneNumbers[0].number);
                                                } else {
                                                    setShowNumberSelector(c);
                                                }
                                            }}
                                            className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/[0.03] rounded-2xl active:bg-white/5 hover:bg-white/[0.04] transition-all cursor-pointer"
                                        >
                                            <div 
                                                className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shadow-md text-base shrink-0 animate-fade-in"
                                                style={{ backgroundColor: avatarBg }}
                                            >
                                                {initial}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-white truncate text-base">{c.displayName}</h4>
                                                <p className="text-white/40 text-xs truncate mt-0.5">
                                                    {c.phoneNumbers && c.phoneNumbers.length > 0 
                                                        ? c.phoneNumbers.map(p => p.number).join(' • ') 
                                                        : 'Sin número'}
                                                </p>
                                            </div>
                                            
                                            <span className="material-symbols-outlined text-white/30 text-lg">chevron_right</span>
                                        </div>
                                    );
                                })}

                            {deviceContacts.filter(c => 
                                (c.displayName || '').toLowerCase().includes(searchContactsQuery.toLowerCase()) ||
                                (c.phoneNumbers || []).some(p => p.number.includes(searchContactsQuery))
                            ).length === 0 && (
                                <div className="text-center py-12 text-white/30 text-sm">
                                    No se encontraron contactos en tu agenda
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Multiple Numbers Selector Modal */}
            {showNumberSelector && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-[#18181f] border border-white/10 rounded-3xl p-6 shadow-2xl animate-scale-up">
                        <h3 className="text-lg font-bold text-white mb-2">{t('contacts.select_phone')}</h3>
                        <p className="text-white/60 text-sm mb-4">
                            {t('contacts.multiple_phones')} <strong className="text-white">{showNumberSelector.displayName}</strong>
                        </p>
                        
                        <div className="space-y-2 mb-6">
                            {showNumberSelector.phoneNumbers?.map((phone, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => addContactFromPicker(showNumberSelector.displayName || 'Contacto', phone.number)}
                                    className="w-full p-4 bg-white/5 hover:bg-primary active:bg-primary/95 rounded-2xl text-left font-semibold text-white text-sm flex justify-between items-center border border-white/5 hover:border-transparent transition-all"
                                >
                                    <span>{phone.number}</span>
                                    <span className="text-xs uppercase px-2 py-0.5 bg-white/10 rounded-md text-white/60">
                                        {phone.type || 'móvil'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        
                        <button
                            onClick={() => setShowNumberSelector(null)}
                            className="w-full py-3 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold text-white transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Permissions Denied Info Modal */}
            {isPermissionsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-[#18181f] border border-white/10 rounded-3xl p-6 shadow-2xl text-center animate-scale-up">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{t('contacts.permission_denied')}</h3>
                        <p className="text-white/50 text-xs leading-relaxed mb-6">
                            {t('contacts.permission_denied_desc')}
                        </p>
                        
                        <button
                            onClick={() => setIsPermissionsModalOpen(false)}
                            className="w-full py-3 bg-primary hover:bg-primary/90 rounded-xl text-sm font-bold text-white shadow-lg transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* Apple-style Contact Selector Sliding Drawer */}
            {showAddContactSelector && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-md transition-opacity duration-300 animate-fade-in">
                    <div className="absolute inset-0 -z-10" onClick={() => {
                        setShowAddContactSelector(false);
                        setShowManualForm(false);
                    }} />
                    
                    <div className="flex flex-col max-h-[85vh] bg-[#121216] border-t border-white/10 rounded-t-[2.5rem] shadow-2xl overflow-hidden transition-transform duration-300 transform translate-y-0">
                        <div className="flex flex-col items-center p-4 shrink-0 border-b border-white/5">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
                            <div className="flex justify-between items-center w-full px-2">
                                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
                                    {showManualForm ? 'Añadir Manualmente' : 'Añadir Contacto'}
                                </h2>
                                <button 
                                    onClick={() => {
                                        setShowAddContactSelector(false);
                                        setShowManualForm(false);
                                    }}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-12">
                            {!showIdForm && !showManualForm ? (
                                <div className="space-y-4">
                                    {/* ID-based add */}
                                    <div 
                                        onClick={() => setShowIdForm(true)}
                                        className="flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-3xl active:bg-white/5 hover:bg-white/[0.04] transition-all cursor-pointer group"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/20">
                                            <span className="material-symbols-outlined text-2xl">badge</span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-white text-base">Por ID de RedCarpet</h4>
                                            <p className="text-white/40 text-xs mt-1">Introduce el ID único de tu contacto (ej. #3925DD3).</p>
                                        </div>
                                        <span className="material-symbols-outlined text-white/30 text-xl">chevron_right</span>
                                    </div>


                                    {/* Native Contact Picker */}
                                    <div 
                                        onClick={handleNativeAddContact}
                                        className="flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-3xl active:bg-white/5 hover:bg-white/[0.04] transition-all cursor-pointer group"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 transition-colors group-hover:bg-blue-500/20">
                                            <span className="material-symbols-outlined text-2xl">contacts</span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-white text-base">Desde la Agenda</h4>
                                            <p className="text-white/40 text-xs mt-1">Selecciona un contacto directamente de tu teléfono.</p>
                                        </div>
                                        <span className="material-symbols-outlined text-white/30 text-xl">chevron_right</span>
                                    </div>

                                    {/* Manual Add */}
                                    <div 
                                        onClick={() => setShowManualForm(true)}
                                        className="flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-3xl active:bg-white/5 hover:bg-white/[0.04] transition-all cursor-pointer group"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 transition-colors group-hover:bg-emerald-500/20">
                                            <span className="material-symbols-outlined text-2xl">edit_note</span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-white text-base">Añadir Manualmente</h4>
                                            <p className="text-white/40 text-xs mt-1">Escribe el nombre y número de teléfono de tu contacto.</p>
                                        </div>
                                        <span className="material-symbols-outlined text-white/30 text-xl">chevron_right</span>
                                    </div>
                                </div>
                            ) : showIdForm ? (
                                <form onSubmit={handleAddByShortId} className="space-y-5">
                                    {/* Info banner */}
                                    <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                                        <p className="text-xs text-white/60 leading-relaxed">
                                            Pide a tu contacto que abra RedCarpet y comparta su ID contigo.
                                            Lo encontrará en la parte superior de esta pantalla.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">ID de RedCarpet</label>
                                        <input
                                            type="text"
                                            value={addByIdInput}
                                            onChange={(e) => setAddByIdInput(e.target.value.toUpperCase())}
                                            placeholder="ej. #3925DD3"
                                            required
                                            autoCapitalize="characters"
                                            className="w-full h-14 bg-white/5 rounded-2xl border border-white/5 px-4 text-base text-white font-mono tracking-widest focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">Cómo le llamas (opcional)</label>
                                        <input
                                            type="text"
                                            value={addByIdName}
                                            onChange={(e) => setAddByIdName(e.target.value)}
                                            placeholder="ej. Mamá, Carlos..."
                                            className="w-full h-14 bg-white/5 rounded-2xl border border-white/5 px-4 text-base text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                                        />
                                    </div>

                                    {addByIdError && (
                                        <p className="text-red-400 text-xs font-bold px-1">{addByIdError}</p>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setShowIdForm(false); setAddByIdError(null); }}
                                            className="flex-1 h-14 bg-white/5 rounded-2xl font-bold text-sm text-white hover:bg-white/10 transition-colors"
                                        >
                                            Atrás
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={addByIdLoading || addByIdInput.length < 7}
                                            className="flex-1 h-14 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            {addByIdLoading ? 'Buscando...' : 'Enviar solicitud'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleManualSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">Nombre</label>
                                        <input
                                            type="text"
                                            value={manualName}
                                            onChange={(e) => setManualName(e.target.value)}
                                            placeholder="ej. Mamá, Carlos..."
                                            required
                                            className="w-full h-14 bg-white/5 rounded-2xl border border-white/5 px-4 text-base text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">Teléfono</label>
                                        <input
                                            type="tel"
                                            value={manualPhone}
                                            onChange={(e) => setManualPhone(e.target.value)}
                                            placeholder="ej. +34 600 000 000"
                                            required
                                            className="w-full h-14 bg-white/5 rounded-2xl border border-white/5 px-4 text-base text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                                        />
                                    </div>

                                    {manualError && (
                                        <p className="text-red-400 text-xs font-bold px-1">{manualError}</p>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setShowManualForm(false); setManualError(null); }}
                                            className="flex-1 h-14 bg-white/5 rounded-2xl font-bold text-sm text-white hover:bg-white/10 transition-colors"
                                        >
                                            Atrás
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={manualLoading || !manualName || !manualPhone}
                                            className="flex-1 h-14 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            {manualLoading ? 'Añadiendo...' : 'Añadir Contacto'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
