import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Store, Phone, Globe, MapPin, Navigation, X } from 'lucide-react';

export interface BusinessListing {
    id: string;
    name: string;
    description?: string;
    category?: string;
    address?: string;
    lat: number;
    lng: number;
    phone?: string;
    website?: string;
}

interface Props {
    business: BusinessListing | null;
    onClose: () => void;
}

export const BusinessDetailModal: React.FC<Props> = ({ business, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    if (!business) return null;

    const b = business;
    const catLabel = t(`business.cat_${b.category || 'general'}`, b.category || '');
    const normalizedWeb = b.website
        ? (b.website.startsWith('http') ? b.website : `https://${b.website}`)
        : null;

    const openWeb = () => { if (normalizedWeb) window.open(normalizedWeb, '_blank'); };
    const call = () => { if (b.phone) window.location.href = `tel:${b.phone.replace(/\s+/g, '')}`; };
    // Ruta DENTRO de RedCarpet (no sale de la app): navega a la pantalla de ruta
    // con el negocio como destino.
    const directions = () => {
        onClose();
        navigate('/route', { state: { destination: { lat: b.lat, lng: b.lng }, destinationName: b.name } });
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-sm bg-[#121216] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-10 sm:pb-6 shadow-2xl animate-slide-up sm:animate-scale-in border border-white/10">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden" />

                <button
                    onClick={onClose}
                    aria-label={t('bizcard.close')}
                    className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>

                {/* Cabecera */}
                <div className="flex items-center gap-4 mb-5">
                    <div className="size-14 rounded-2xl bg-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-400/30">
                        <Store size={26} className="text-amber-900" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">{t('bizcard.featured')}</span>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white truncate">{b.name}</h3>
                        {catLabel && <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider">{catLabel}</p>}
                    </div>
                </div>

                {/* Descripción */}
                {b.description && (
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line bg-white/5 rounded-2xl p-4 border border-white/10 mb-4">
                        {b.description}
                    </p>
                )}

                {/* Dirección */}
                {b.address && (
                    <div className="flex items-start gap-3 mb-5 px-1">
                        <MapPin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-white/60 leading-relaxed">{b.address}</p>
                    </div>
                )}

                {/* Acciones */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={call}
                        disabled={!b.phone}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30"
                    >
                        <Phone size={18} className="text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('bizcard.call')}</span>
                    </button>
                    <button
                        onClick={openWeb}
                        disabled={!normalizedWeb}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30"
                    >
                        <Globe size={18} className="text-sky-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('bizcard.website')}</span>
                    </button>
                    <button
                        onClick={directions}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all"
                    >
                        <Navigation size={18} className="text-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('bizcard.directions')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
