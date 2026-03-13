import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { UnifiedMap } from '../components/UnifiedMap';
import { SOSConfigSheet, type SOSConfigData } from '../components/SOSConfigSheet';
import { FamilyActionSheet } from '../components/family/FamilyActionSheet';
import { DraggableSheet } from '../components/layout/DraggableSheet';
import { type POI, formatPOIDistance } from '../services/poiService';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext';
import { getFamilyData } from '../services/familyService';
import { getSafeZones, type SafeZone } from '../services/locationService';
import type { FamilyGroup } from '../services/database.types';
import { AddSafeZoneModal } from '../components/safety/AddSafeZoneModal';
import { NightModeWarning } from '../components/safety/NightModeWarning';
import { LocationHistoryModal } from '../components/map/LocationHistoryModal';

// Tipos para el estado de la UI
interface UIMember {
    id: string; // Changed from number to string to match Supabase ID
    name: string;
    avatar: string;
    avatarUrl: string | null;
    avatarBg: string; // Tailwnd class
    location: string;
    lat: number;
    lng: number;
    status: 'moving' | 'stationary' | 'home';
    speed: string | null;
    battery: number;
    lastUpdate: string;
    route: { from: string; to: string; eta: string; progress: number } | null;
}

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const { user, isPremium } = useAuth();
    const { openSOSModal, openPaywall } = useSOS();

    // Estados
    const [familyMembers, setFamilyMembers] = useState<UIMember[]>([]);
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [isLoadingFamily, setIsLoadingFamily] = useState(true);
    const [activeTab, setActiveTab] = useState<'family' | 'places' | 'alerts'>('alerts');
    const [selectedMember, setSelectedMember] = useState<string | null>(null); // Changed to string
    const [showSOSConfig, setShowSOSConfig] = useState(false);
    const [showFamilySheet, setShowFamilySheet] = useState(false);
    const [showAddZoneModal, setShowAddZoneModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState<UIMember | null>(null);
    const [sosConfig, setSOSConfig] = useState<SOSConfigData | null>(null);
    const [, setSheetHeight] = useState(45);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

    const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

    // Cargar familia y zonas
    const loadData = async () => {
        if (!user) {
            setFamilyMembers([]);
            setFamilyGroup(null);
            setSafeZones([]);
            setIsLoadingFamily(false);
            return;
        }

        // Delay slightly to prioritize map render
        setTimeout(async () => {
            try {
                const { group, members } = await getFamilyData(user.id);
                setFamilyGroup(group);

                if (group) {
                    const zones = await getSafeZones(group.id);
                    setSafeZones(zones);
                    if (isPremium) {
                        setActiveTab('family');
                    }
                }

                if (group && members.length > 0) {
                    // Mapear datos de DB a UI (Optimized mapping)
                    const uiMembers: UIMember[] = members.map((m) => {
                        // ... (existing mapping logic)
                        const loc = m.location;
                        // Format last update time
                        let timeString = 'Sin datos';
                        if (loc?.created_at) {
                            const date = new Date(loc.created_at);
                            const now = new Date();
                            const diff = (now.getTime() - date.getTime()) / 1000 / 60; // minutes
                            if (diff < 1) timeString = 'Ahora';
                            else if (diff < 60) timeString = `Hace ${Math.floor(diff)} min`;
                            else timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }

                        return {
                            id: m.profile.id,
                            name: m.profile.full_name?.split(' ')[0] || 'Usuario',
                            avatar: m.role === 'child' ? '👧' : m.role === 'admin' ? '👨' : '👤',
                            avatarUrl: m.profile.avatar_url,
                            avatarBg: 'bg-slate-600',
                            location: loc ? 'Ubicación actual' : 'Sin ubicación',
                            lat: loc ? loc.lat : 0,
                            lng: loc ? loc.lng : 0,
                            status: loc && loc.speed && loc.speed > 5 ? 'moving' : 'stationary',
                            speed: loc?.speed ? `${Math.round(loc.speed)} km/h` : null,
                            battery: loc?.battery_level || 0,
                            lastUpdate: timeString,
                            route: null
                        };
                    });
                    setFamilyMembers(uiMembers);
                } else {
                    setFamilyMembers([]);
                }
            } catch (error) {
                console.error('Error loading data:', error);
                setFamilyMembers([]);
                setSafeZones([]);
            } finally {
                setIsLoadingFamily(false);
            }
        }, 100);
    };

    useEffect(() => {
        loadData();
    }, [user]);

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">

            {/* Header con buscador */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-background-dark z-20 shrink-0">
                {/* ... existing header content ... */}

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

                <button
                    onDoubleClick={() => {
                        if (isPremium) {
                            openSOSModal('discrete');
                        } else {
                            openPaywall('Modo Discreto');
                        }
                    }}
                    className="size-10 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0"
                >
                    <span className="material-symbols-outlined text-xl">mail</span>
                </button>
            </div>

            {/* Night Mode Warning Overlay */}
            {user && (
                <NightModeWarning
                    userLat={familyMembers.find(m => m.id === user.id)?.lat || 0}
                    userLng={familyMembers.find(m => m.id === user.id)?.lng || 0}
                />
            )}

            {/* Map Section - Más grande como Life360 */}
            <div className="relative flex-1 min-h-0">
                <UnifiedMap
                    showMarkers={true}
                    familyMembers={familyMembers.filter(m => m.lat !== 0 && m.lng !== 0)}
                    showDangerZones={true}
                    showPOIs={true}
                    onPOIClick={(poi) => setSelectedPOI(poi)}
                    onMemberClick={(id) => setSelectedMember(id)}
                >

                    {/* Avatares de familia en el mapa - z-30 to stay above map markers */}
                    {isPremium && (
                        <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
                            {familyMembers.filter(m => m.lat !== 0).slice(0, 3).map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                                    className={clsx(
                                        "size-12 rounded-full border-2 flex items-center justify-center text-xl shadow-lg transition-all",
                                        member.avatarBg,
                                        selectedMember === member.id ? "border-primary scale-110" : "border-background-dark"
                                    )}
                                >
                                    {member.avatarUrl ? (
                                        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        member.avatar
                                    )}
                                </button>
                            ))}
                            {familyMembers.filter(m => m.lat !== 0).length > 3 && (
                                <div className="size-12 rounded-full border-2 border-background-dark bg-zinc-800 flex items-center justify-center text-xs font-bold shadow-lg">
                                    +{familyMembers.filter(m => m.lat !== 0).length - 3}
                                </div>
                            )}
                        </div>
                    )}

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
                                    onClick={() => openSOSModal()}
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
                            <button
                                onClick={() => navigate('/report')}
                                className="size-12 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                                aria-label="Reportar incidente"
                            >
                                <span className="material-symbols-outlined text-orange-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                            </button>
                        </div>
                    </div>
                }
            >
                {/* Tabs estilo Life360 */}
                <div className="flex items-center justify-center gap-1 px-4 pb-3 shrink-0">
                    {isPremium && !!familyGroup && (
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
                    )}
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
                            {isLoadingFamily ? (
                                <div className="p-4 text-center text-white/40 text-sm">Cargando familia...</div>
                            ) : (
                                <>
                                    {familyMembers.length === 0 ? (
                                        <div className="p-4 text-center text-white/40 text-sm">
                                            No tienes familiares en tu grupo aún.
                                        </div>
                                    ) : (
                                        <>
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
                                                            "size-14 rounded-full flex items-center justify-center text-2xl overflow-hidden",
                                                            member.avatarBg
                                                        )}>
                                                            {member.avatarUrl ? (
                                                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                member.avatar
                                                            )}
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
                                                        {/* Monthly Stats (Premium/Family feature) */}
                                                        {isPremium && (
                                                            <div
                                                                className="mt-2 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 flex items-center gap-1 hover:bg-indigo-500/20 transition-colors shrink-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowHistoryModal(member);
                                                                }}
                                                                title="Ver Historial Mensual"
                                                            >
                                                                <span className="material-symbols-outlined text-[10px] text-indigo-400">analytics</span>
                                                                <span className="text-[9px] text-indigo-400 font-bold tracking-wide">{(member.name.length * 15) + (member.id.length * 2)} KM/MES</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Heart/Favorite */}
                                                    <button className="text-white/30 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined">favorite</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {/* Añadir persona - ALWAYS VISIBLE AL FINAL */}
                                    <button
                                        onClick={() => setShowFamilySheet(true)}
                                        className="flex items-center gap-4 p-4 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white hover:border-primary/50 transition-all"
                                    >
                                        <div className="size-14 rounded-full bg-white/5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">person_add</span>
                                        </div>
                                        <span className="font-medium">Agregar una persona</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'places' && (
                        <div className="flex flex-col gap-3">
                            {/* Agregar nuevo lugar */}
                            {/* Agregar nuevo lugar */}
                            <button
                                onClick={() => {
                                    // Gate: Allow 1 safe zone for free, unlimited for premium
                                    if (safeZones.length >= 1 && !isPremium) {
                                        openPaywall('Zonas Seguras Ilimitadas');
                                    } else {
                                        setShowAddZoneModal(true);
                                    }
                                }}
                                className="flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/30 text-primary"
                            >
                                <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined">add</span>
                                </div>
                                <span className="font-semibold">Agregar un nuevo lugar</span>
                            </button>

                            {/* Lugares guardados */}
                            {safeZones.length === 0 ? (
                                <div className="p-4 text-center text-white/40 text-sm">
                                    No hay lugares guardados.
                                </div>
                            ) : (
                                safeZones.map((zone) => (
                                    <button
                                        key={zone.id}
                                        onClick={() => navigate('/route', { state: { destination: { lat: zone.lat, lng: zone.lng }, destinationName: zone.name } })}
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
                                    >
                                        <div className="size-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
                                            {zone.name.toLowerCase().includes('casa') ? '🏠' :
                                                zone.name.toLowerCase().includes('escuela') || zone.name.toLowerCase().includes('colegio') ? '🎓' :
                                                    zone.name.toLowerCase().includes('trabajo') ? '💼' : '📍'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{zone.name}</p>
                                            <p className="text-xs text-white/40">Radio: {zone.radius}m</p>
                                        </div>
                                        <span className="material-symbols-outlined text-white/40">chevron_right</span>
                                    </button>
                                ))
                            )}
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

            {/* Add Safe Zone Modal */}
            <AddSafeZoneModal
                isOpen={showAddZoneModal}
                onClose={() => setShowAddZoneModal(false)}
                familyId={familyGroup?.id || ''}
                onSuccess={loadData}
            />

            {/* Family Management Sheet */}
            <FamilyActionSheet
                isOpen={showFamilySheet}
                onClose={() => setShowFamilySheet(false)}
                hasFamily={!!familyGroup}
                familyGroupId={familyGroup?.id}
                adminId={familyGroup?.admin_id}
                members={familyMembers}
                onSuccess={() => {
                    // Refresh family data
                    loadData();
                }}
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
            {/* Member Detail Modal (similar to POI) */}
            {selectedMember && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedMember(null)}
                    />
                    <div className="relative w-full max-w-lg bg-background-dark rounded-t-3xl p-6 pb-10 border-t border-white/10 animate-slide-up">
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedMember(null)}
                            className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>

                        {/* Member Header */}
                        {(() => {
                            const member = familyMembers.find(m => m.id === selectedMember);
                            if (!member) return null;

                            return (
                                <>
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className={clsx(
                                            "size-16 rounded-full border-4 flex items-center justify-center text-3xl shadow-lg shrink-0 overflow-hidden",
                                            member.avatarBg,
                                            member.status === 'moving' ? 'border-primary' : 'border-zinc-700'
                                        )}>
                                            {member.avatarUrl ? (
                                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                            ) : (
                                                member.avatar
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <h3 className="text-2xl font-bold truncate">{member.name}</h3>
                                            <p className="text-white/50 text-sm flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">location_on</span>
                                                {member.location}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <div className={clsx(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border",
                                                    member.battery > 20 ? "bg-zinc-800 border-zinc-700 text-white" : "bg-red-500/20 border-red-500/50 text-red-400"
                                                )}>
                                                    <span className="material-symbols-outlined text-[10px]">battery_full</span>
                                                    {member.battery}%
                                                </div>
                                                {member.speed && (
                                                    <div className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-primary/30 bg-primary/10 text-primary">
                                                        <span className="material-symbols-outlined text-[10px]">speed</span>
                                                        {member.speed}
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-white/40">
                                                    Actualizado: {member.lastUpdate}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedMember(null);
                                                navigate('/route', {
                                                    state: {
                                                        destination: { lat: member.lat, lng: member.lng },
                                                        destinationName: `Ubicación de ${member.name}`
                                                    }
                                                });
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-transform active:scale-95 text-sm"
                                        >
                                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>directions</span>
                                            Ir
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!isPremium) {
                                                    openPaywall('Historial de Ubicación de 30 días');
                                                } else {
                                                    setShowHistoryModal(member);
                                                }
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-colors text-sm"
                                        >
                                            <span className="material-symbols-outlined text-lg">history</span>
                                            Historial
                                        </button>
                                        <button className="size-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                                            <span className="material-symbols-outlined text-white/80">call</span>
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* History Modal */}
            <LocationHistoryModal
                isOpen={!!showHistoryModal}
                onClose={() => setShowHistoryModal(null)}
                memberId={showHistoryModal?.id || ''}
                memberName={showHistoryModal?.name || ''}
            />
        </div>
    );
};
