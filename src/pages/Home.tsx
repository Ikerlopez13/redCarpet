import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { UnifiedMap } from '../components/UnifiedMap';
import { SOSConfigSheet, type SOSConfigData } from '../components/SOSConfigSheet';
import { DraggableSheet } from '../components/layout/DraggableSheet';
import { type POI, formatPOIDistance } from '../services/poiService';

// Datos de miembros de la familia
const familyMembers = [
    {
        id: 1,
        name: 'María',
        avatar: '👩',
        avatarBg: 'bg-yellow-600',
        location: 'Universidad',
        status: 'moving',
        speed: '5 km/h',
        battery: 72,
        lastUpdate: 'Hace 2 min',
        route: { from: 'Casa', to: 'Universidad', eta: '12 min', progress: 65 },
    },
    {
        id: 2,
        name: 'Carlos',
        avatar: '👨',
        avatarBg: 'bg-amber-700',
        location: 'En camino',
        status: 'moving',
        speed: '8 km/h',
        battery: 45,
        lastUpdate: 'Hace 5 min',
        route: { from: 'Oficina', to: 'Gimnasio', eta: '18 min', progress: 30 },
    },
    {
        id: 3,
        name: 'Ana',
        avatar: '👧',
        avatarBg: 'bg-pink-600',
        location: 'En Casa',
        status: 'home',
        speed: null,
        battery: 89,
        lastUpdate: 'Hace 15 min',
        route: null,
    },
    {
        id: 4,
        name: 'Papá',
        avatar: '👴',
        avatarBg: 'bg-slate-600',
        location: 'Oficina',
        status: 'stationary',
        speed: null,
        battery: 34,
        lastUpdate: 'Hace 1h',
        route: null,
    },
];

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'family' | 'places' | 'alerts'>('family');
    const [selectedMember, setSelectedMember] = useState<number | null>(null);
    const [showSOSConfig, setShowSOSConfig] = useState(false);
    const [sosConfig, setSOSConfig] = useState<SOSConfigData | null>(null);
    const [, setSheetHeight] = useState(45);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">

            {/* Header con buscador */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-background-dark z-20 shrink-0">
                <button
                    onClick={() => navigate('/settings')}
                    className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0"
                >
                    <span className="material-symbols-outlined text-xl">settings</span>
                </button>

                {/* Search Bar - clickable to go to route */}
                <button
                    onClick={() => navigate('/route')}
                    className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-white/5 rounded-xl border border-white/10 text-left"
                >
                    <span className="material-symbols-outlined text-white/40 text-xl">search</span>
                    <span className="text-white/40 text-sm">¿A dónde vas?</span>
                </button>

                <button className="size-10 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">mail</span>
                </button>
            </div>

            {/* Map Section - Más grande como Life360 */}
            <div className="relative flex-1 min-h-0">
                <UnifiedMap
                    showMarkers={true}
                    showDangerZones={true}
                    showPOIs={true}
                    onPOIClick={(poi) => setSelectedPOI(poi)}
                >

                    {/* Avatares de familia en el mapa - z-30 to stay above map markers */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
                        {familyMembers.slice(0, 3).map((member) => (
                            <button
                                key={member.id}
                                onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                                className={clsx(
                                    "size-12 rounded-full border-2 flex items-center justify-center text-xl shadow-lg transition-all",
                                    member.avatarBg,
                                    selectedMember === member.id ? "border-primary scale-110" : "border-background-dark"
                                )}
                            >
                                {member.avatar}
                            </button>
                        ))}
                        {familyMembers.length > 3 && (
                            <div className="size-12 rounded-full border-2 border-background-dark bg-zinc-800 flex items-center justify-center text-xs font-bold shadow-lg">
                                +{familyMembers.length - 3}
                            </div>
                        )}
                    </div>

                </UnifiedMap>
            </div>

            {/* Bottom Sheet con Tabs - Deslizable */}
            <DraggableSheet
                minHeight={80}
                maxHeight={70}
                defaultHeight={45}
                onHeightChange={setSheetHeight}
                floatingContent={
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/90 text-zinc-900 rounded-full text-sm font-semibold shadow-lg">
                                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
                                Registro
                            </button>
                            {sosConfig?.isConfigured ? (
                                <button
                                    onClick={() => navigate('/emergency')}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold shadow-lg shadow-primary/40 animate-pulse"
                                >
                                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>sos</span>
                                    SOS
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowSOSConfig(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white/90 text-zinc-900 rounded-full text-sm font-semibold shadow-lg"
                                >
                                    <span className="material-symbols-outlined text-lg">settings</span>
                                    Configurar SOS
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {sosConfig?.isConfigured && (
                                <button
                                    onClick={() => setShowSOSConfig(true)}
                                    className="size-12 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-lg"
                                >
                                    <span className="material-symbols-outlined">tune</span>
                                </button>
                            )}
                            <button className="size-12 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-lg">
                                <span className="material-symbols-outlined">layers</span>
                            </button>
                        </div>
                    </div>
                }
            >
                {/* Tabs estilo Life360 */}
                <div className="flex items-center justify-center gap-1 px-4 pb-3 shrink-0">
                    <button
                        onClick={() => setActiveTab('family')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            activeTab === 'family' ? "bg-primary text-white" : "bg-white/5 text-white/60"
                        )}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeTab === 'family' ? "'FILL' 1" : "" }}>group</span>
                        Familia
                    </button>
                    <button
                        onClick={() => setActiveTab('places')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            activeTab === 'places' ? "bg-primary text-white" : "bg-white/5 text-white/60"
                        )}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeTab === 'places' ? "'FILL' 1" : "" }}>location_on</span>
                        Lugares
                    </button>
                    <button
                        onClick={() => setActiveTab('alerts')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            activeTab === 'alerts' ? "bg-primary text-white" : "bg-white/5 text-white/60"
                        )}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeTab === 'alerts' ? "'FILL' 1" : "" }}>shield</span>
                        Seguridad
                    </button>
                </div>

                {/* Content area */}
                <div className="px-4 pb-28 flex-1 overflow-y-auto no-scrollbar">
                    {activeTab === 'family' && (
                        <div className="flex flex-col gap-3">
                            {familyMembers.map((member) => (
                                <div
                                    key={member.id}
                                    onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                                    className={clsx(
                                        "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                                        member.route
                                            ? "bg-primary/5 border-primary/30"
                                            : "bg-white/5 border-white/10",
                                        selectedMember === member.id && "ring-2 ring-primary"
                                    )}
                                >
                                    {/* Avatar con indicador de estado */}
                                    <div className="relative">
                                        <div className={clsx(
                                            "size-14 rounded-full flex items-center justify-center text-2xl",
                                            member.avatarBg
                                        )}>
                                            {member.avatar}
                                        </div>
                                        {/* Indicador de batería */}
                                        <div className={clsx(
                                            "absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5",
                                            member.battery > 50 ? "bg-green-500 text-white" :
                                                member.battery > 20 ? "bg-yellow-500 text-black" : "bg-red-500 text-white"
                                        )}>
                                            <span className="material-symbols-outlined text-[10px]">battery_full</span>
                                            {member.battery}%
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-base">{member.name}</span>
                                            {member.route && (
                                                <span className="text-[9px] font-bold text-primary uppercase tracking-wider bg-primary/20 px-2 py-0.5 rounded animate-pulse">
                                                    EN RUTA
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-white/60 truncate">
                                            {member.route
                                                ? `${member.route.from} → ${member.route.to}`
                                                : member.location
                                            }
                                        </p>
                                        {member.route && (
                                            <div className="mt-2">
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${member.route.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {member.speed && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="material-symbols-outlined text-primary text-sm">speed</span>
                                                <span className="text-xs text-primary font-medium">{member.speed}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side - ETA / Status */}
                                    <div className="flex flex-col items-end shrink-0">
                                        {member.route ? (
                                            <>
                                                <p className="text-lg font-bold">{member.route.eta}</p>
                                                <p className="text-[10px] text-white/40">{member.lastUpdate}</p>
                                            </>
                                        ) : (
                                            <>
                                                <span className={clsx(
                                                    "text-xs font-medium px-2 py-1 rounded-full",
                                                    member.status === 'home' ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"
                                                )}>
                                                    {member.status === 'home' ? '🏠 En Casa' : member.location}
                                                </span>
                                                <p className="text-[10px] text-white/40 mt-1">{member.lastUpdate}</p>
                                            </>
                                        )}
                                    </div>

                                    {/* Heart/Favorite */}
                                    <button className="text-white/30 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined">favorite</span>
                                    </button>
                                </div>
                            ))}

                            {/* Añadir persona */}
                            <button className="flex items-center gap-4 p-4 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white hover:border-primary/50 transition-all">
                                <div className="size-14 rounded-full bg-white/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">person_add</span>
                                </div>
                                <span className="font-medium">Agregar una persona</span>
                            </button>
                        </div>
                    )}

                    {activeTab === 'places' && (
                        <div className="flex flex-col gap-3">
                            {/* Agregar nuevo lugar */}
                            <button className="flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/30 text-primary">
                                <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined">add</span>
                                </div>
                                <span className="font-semibold">Agregar un nuevo lugar</span>
                            </button>

                            {/* Lugares guardados */}
                            {[
                                { name: 'Casa', address: 'Calle Mayor, 12', icon: '🏠', hasMembers: true },
                                { name: 'Universidad', address: 'Campus Complutense', icon: '🎓', hasMembers: false },
                                { name: 'Oficina', address: 'Gran Vía, 45', icon: '💼', hasMembers: false },
                                { name: 'Gimnasio', address: 'Plaza Mayor, 78', icon: '🏋️', hasMembers: false },
                            ].map((place, index) => (
                                <button
                                    key={index}
                                    onClick={() => navigate('/route', { state: { destination: place.name } })}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
                                >
                                    <div className="size-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
                                        {place.icon}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold">{place.name}</p>
                                        <p className="text-xs text-white/40">{place.address}</p>
                                    </div>
                                    {place.hasMembers && (
                                        <div className="size-6 rounded-full bg-primary flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">1</span>
                                        </div>
                                    )}
                                    <span className="material-symbols-outlined text-white/40">chevron_right</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'alerts' && (
                        <div className="flex flex-col gap-3">
                            {/* Zonas de peligro - Diferenciador de RedCarpet */}
                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="size-10 rounded-full bg-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white">warning</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Zonas de Peligro</h3>
                                        <p className="text-xs text-white/60">Alertas automáticas en zonas inseguras</p>
                                    </div>
                                    <div className="ml-auto">
                                        <div className="w-12 h-7 bg-primary rounded-full flex items-center px-1">
                                            <div className="size-5 bg-white rounded-full ml-auto"></div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-white/50">
                                    <span className="text-primary font-bold">3 zonas</span> marcadas como peligrosas cerca de ti
                                </p>
                            </div>

                            {/* Rutas seguras - Diferenciador de RedCarpet */}
                            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="size-10 rounded-full bg-green-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Rutas Seguras GPS</h3>
                                        <p className="text-xs text-white/60">Navegación evitando zonas peligrosas</p>
                                    </div>
                                    <div className="ml-auto">
                                        <div className="w-12 h-7 bg-green-500 rounded-full flex items-center px-1">
                                            <div className="size-5 bg-white rounded-full ml-auto"></div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/route')}
                                    className="w-full mt-2 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-sm font-semibold"
                                >
                                    Planificar ruta segura →
                                </button>
                            </div>

                            {/* Alertas de choque */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <span className="material-symbols-outlined text-2xl text-white/60">car_crash</span>
                                <div className="flex-1">
                                    <p className="font-semibold">Alertas de choque</p>
                                    <p className="text-xs text-white/40">Detección automática de accidentes</p>
                                </div>
                                <span className="material-symbols-outlined text-green-400">check_circle</span>
                            </div>

                            {/* Contactos de emergencia */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <span className="material-symbols-outlined text-2xl text-white/60">contacts</span>
                                <div className="flex-1">
                                    <p className="font-semibold">Contactos de emergencia</p>
                                    <p className="text-xs text-white/40">2 contactos agregados</p>
                                </div>
                                <span className="material-symbols-outlined text-white/40">chevron_right</span>
                            </div>
                        </div>
                    )}
                </div>
            </DraggableSheet>

            {/* SOS Configuration Sheet */}
            <SOSConfigSheet
                isOpen={showSOSConfig}
                onClose={() => setShowSOSConfig(false)}
                onSave={setSOSConfig}
                currentConfig={sosConfig || undefined}
            />

            {/* POI Detail Modal */}
            {selectedPOI && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedPOI(null)}
                    />
                    <div className="relative w-full max-w-lg bg-background-dark rounded-t-3xl p-6 pb-10 border-t border-white/10 animate-slide-up">
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedPOI(null)}
                            className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>

                        {/* POI Header */}
                        <div className="flex items-start gap-4 mb-6">
                            <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                                <span
                                    className="material-symbols-outlined text-primary text-2xl"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    {selectedPOI.categoryIcon}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold truncate">{selectedPOI.name}</h3>
                                <p className="text-white/50 text-sm">{selectedPOI.address}</p>
                                {selectedPOI.distance && (
                                    <p className="text-primary text-sm font-semibold mt-1">
                                        {formatPOIDistance(selectedPOI.distance)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Quick Info */}
                        <div className="flex gap-3 mb-6">
                            <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                                <span className="material-symbols-outlined text-white/60 text-xl">schedule</span>
                                <p className="text-xs text-white/40 mt-1">Abierto</p>
                            </div>
                            <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                                <span className="material-symbols-outlined text-white/60 text-xl">star</span>
                                <p className="text-xs text-white/40 mt-1">4.5 ★</p>
                            </div>
                            <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                                <span className="material-symbols-outlined text-white/60 text-xl">euro</span>
                                <p className="text-xs text-white/40 mt-1">€€</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedPOI(null);
                                    navigate('/route', {
                                        state: {
                                            destination: { lat: selectedPOI.lat, lng: selectedPOI.lng },
                                            destinationName: selectedPOI.name
                                        }
                                    });
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30"
                            >
                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>directions</span>
                                Cómo llegar
                            </button>
                            <button className="size-14 rounded-2xl bg-white/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white/80">bookmark</span>
                            </button>
                            <button className="size-14 rounded-2xl bg-white/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white/80">share</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
