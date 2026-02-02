import React, { useState } from 'react';
import clsx from 'clsx';

interface SOSContact {
    id: number;
    name: string;
    phone: string;
    avatar: string;
}

interface SOSConfigSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: SOSConfigData) => void;
    currentConfig?: SOSConfigData;
}

export interface SOSConfigData {
    contacts: SOSContact[];
    pin: string;
    autoCall112: boolean;
    shareLocation: boolean;
    recordAudio: boolean;
    isConfigured: boolean;
}

const defaultContacts: SOSContact[] = [
    { id: 1, name: 'Mamá', phone: '+34 612 345 678', avatar: '👩' },
    { id: 2, name: 'Papá', phone: '+34 698 765 432', avatar: '👨' },
];

export const SOSConfigSheet: React.FC<SOSConfigSheetProps> = ({
    isOpen,
    onClose,
    onSave,
    currentConfig
}) => {
    const [step, setStep] = useState<'main' | 'pin' | 'contacts'>('main');
    const [contacts, setContacts] = useState<SOSContact[]>(currentConfig?.contacts || defaultContacts);
    const [pin, setPin] = useState(currentConfig?.pin || '');
    const [autoCall112, setAutoCall112] = useState(currentConfig?.autoCall112 ?? true);
    const [shareLocation, setShareLocation] = useState(currentConfig?.shareLocation ?? true);
    const [recordAudio, setRecordAudio] = useState(currentConfig?.recordAudio ?? true);
    const [pinInput, setPinInput] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');

    const handleSave = () => {
        onSave({
            contacts,
            pin,
            autoCall112,
            shareLocation,
            recordAudio,
            isConfigured: true,
        });
        onClose();
    };

    const handlePinEnter = (digit: string) => {
        if (pinStep === 'create') {
            if (pinInput.length < 4) {
                const newPin = pinInput + digit;
                setPinInput(newPin);
                if (newPin.length === 4) {
                    setTimeout(() => setPinStep('confirm'), 300);
                }
            }
        } else {
            if (pinConfirm.length < 4) {
                const newConfirm = pinConfirm + digit;
                setPinConfirm(newConfirm);
                if (newConfirm.length === 4) {
                    if (newConfirm === pinInput) {
                        setPin(newConfirm);
                        setTimeout(() => {
                            setStep('main');
                            setPinInput('');
                            setPinConfirm('');
                            setPinStep('create');
                        }, 300);
                    } else {
                        // PIN doesn't match, reset
                        setTimeout(() => {
                            setPinConfirm('');
                        }, 500);
                    }
                }
            }
        }
    };

    const handlePinBackspace = () => {
        if (pinStep === 'create') {
            setPinInput(pinInput.slice(0, -1));
        } else {
            setPinConfirm(pinConfirm.slice(0, -1));
        }
    };

    const removeContact = (id: number) => {
        setContacts(contacts.filter(c => c.id !== id));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className={clsx(
                "relative w-full max-w-lg bg-background-dark rounded-t-3xl p-6 pb-10 border-t border-white/10",
                "transform transition-transform duration-300 ease-out",
                "max-h-[85vh] overflow-y-auto"
            )}>
                {/* Drag Handle */}
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full" onClick={onClose} />
                </div>

                {step === 'main' && (
                    <>
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    sos
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Configurar SOS</h2>
                                <p className="text-sm text-white/60">Personaliza tu botón de emergencia</p>
                            </div>
                        </div>

                        {/* PIN Section */}
                        <button
                            onClick={() => setStep('pin')}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 mb-3 text-left"
                        >
                            <div className="size-12 rounded-full bg-white/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">lock</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">PIN de Desactivación</p>
                                <p className="text-xs text-white/40">
                                    {pin ? '••••  Configurado' : 'No configurado'}
                                </p>
                            </div>
                            <span className={clsx(
                                "material-symbols-outlined",
                                pin ? "text-green-400" : "text-white/40"
                            )}>
                                {pin ? 'check_circle' : 'chevron_right'}
                            </span>
                        </button>

                        {/* Contacts Section */}
                        <button
                            onClick={() => setStep('contacts')}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 mb-3 text-left"
                        >
                            <div className="size-12 rounded-full bg-white/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">group</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">Contactos de Emergencia</p>
                                <p className="text-xs text-white/40">
                                    {contacts.length} contactos añadidos
                                </p>
                            </div>
                            <div className="flex -space-x-2">
                                {contacts.slice(0, 3).map((c) => (
                                    <div key={c.id} className="size-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm border-2 border-background-dark">
                                        {c.avatar}
                                    </div>
                                ))}
                            </div>
                        </button>

                        {/* Toggle Options */}
                        <div className="flex flex-col gap-3 mt-6">
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
                                Acciones Automáticas
                            </h3>

                            {/* Auto Call 112 */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-lg">call</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">Llamar al 112</p>
                                    <p className="text-[10px] text-white/40">Llamada automática a emergencias</p>
                                </div>
                                <button
                                    onClick={() => setAutoCall112(!autoCall112)}
                                    className={clsx(
                                        "w-12 h-7 rounded-full flex items-center px-1 transition-colors",
                                        autoCall112 ? "bg-primary" : "bg-white/20"
                                    )}
                                >
                                    <div className={clsx(
                                        "size-5 bg-white rounded-full transition-transform",
                                        autoCall112 ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {/* Share Location */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <div className="size-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-green-400 text-lg">location_on</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">Compartir Ubicación</p>
                                    <p className="text-[10px] text-white/40">Envía tu GPS a los contactos</p>
                                </div>
                                <button
                                    onClick={() => setShareLocation(!shareLocation)}
                                    className={clsx(
                                        "w-12 h-7 rounded-full flex items-center px-1 transition-colors",
                                        shareLocation ? "bg-green-500" : "bg-white/20"
                                    )}
                                >
                                    <div className={clsx(
                                        "size-5 bg-white rounded-full transition-transform",
                                        shareLocation ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {/* Record Audio */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <div className="size-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-blue-400 text-lg">mic</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">Grabar Audio</p>
                                    <p className="text-[10px] text-white/40">Graba el entorno automáticamente</p>
                                </div>
                                <button
                                    onClick={() => setRecordAudio(!recordAudio)}
                                    className={clsx(
                                        "w-12 h-7 rounded-full flex items-center px-1 transition-colors",
                                        recordAudio ? "bg-blue-500" : "bg-white/20"
                                    )}
                                >
                                    <div className={clsx(
                                        "size-5 bg-white rounded-full transition-transform",
                                        recordAudio ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={!pin || contacts.length === 0}
                            className={clsx(
                                "w-full mt-8 py-4 rounded-2xl font-bold text-lg transition-all",
                                pin && contacts.length > 0
                                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                                    : "bg-white/10 text-white/40"
                            )}
                        >
                            {pin && contacts.length > 0 ? 'Guardar Configuración' : 'Completa la configuración'}
                        </button>
                    </>
                )}

                {step === 'pin' && (
                    <>
                        <button
                            onClick={() => {
                                setStep('main');
                                setPinInput('');
                                setPinConfirm('');
                                setPinStep('create');
                            }}
                            className="flex items-center gap-2 text-white/60 mb-6"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="text-sm">Volver</span>
                        </button>

                        <h3 className="text-center text-xl font-bold mb-2">
                            {pinStep === 'create' ? 'Crear PIN de Desactivación' : 'Confirmar PIN'}
                        </h3>
                        <p className="text-center text-white/60 text-sm mb-8">
                            {pinStep === 'create'
                                ? 'Este PIN será necesario para cancelar una emergencia'
                                : 'Ingresa el PIN nuevamente para confirmar'
                            }
                        </p>

                        {/* PIN Dots */}
                        <div className="flex justify-center gap-4 mb-10">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={clsx(
                                        "size-4 rounded-full border-2 transition-colors",
                                        i < (pinStep === 'create' ? pinInput.length : pinConfirm.length)
                                            ? "bg-primary border-primary"
                                            : "border-white/20"
                                    )}
                                />
                            ))}
                        </div>

                        {/* Keypad */}
                        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => handlePinEnter(num.toString())}
                                    className="flex items-center justify-center size-16 rounded-full bg-white/5 text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all"
                                >
                                    {num}
                                </button>
                            ))}
                            <div />
                            <button
                                onClick={() => handlePinEnter('0')}
                                className="flex items-center justify-center size-16 rounded-full bg-white/5 text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all"
                            >
                                0
                            </button>
                            <button
                                onClick={handlePinBackspace}
                                className="flex items-center justify-center size-16 rounded-full text-white/40 hover:text-white active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined">backspace</span>
                            </button>
                        </div>
                    </>
                )}

                {step === 'contacts' && (
                    <>
                        <button
                            onClick={() => setStep('main')}
                            className="flex items-center gap-2 text-white/60 mb-6"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="text-sm">Volver</span>
                        </button>

                        <h3 className="text-xl font-bold mb-2">Contactos de Emergencia</h3>
                        <p className="text-white/60 text-sm mb-6">
                            Estas personas serán notificadas cuando actives el SOS
                        </p>

                        <div className="flex flex-col gap-3 mb-6">
                            {contacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
                                >
                                    <div className="size-12 rounded-full bg-zinc-700 flex items-center justify-center text-xl">
                                        {contact.avatar}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold">{contact.name}</p>
                                        <p className="text-xs text-white/40">{contact.phone}</p>
                                    </div>
                                    <button
                                        onClick={() => removeContact(contact.id)}
                                        className="size-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Contact Button */}
                        <button className="w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white hover:border-primary/50 transition-all">
                            <div className="size-12 rounded-full bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl">person_add</span>
                            </div>
                            <span className="font-medium">Añadir contacto</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
