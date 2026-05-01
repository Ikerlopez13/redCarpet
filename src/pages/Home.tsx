import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { UnifiedMap } from '../components/UnifiedMap';
import { SOSConfigSheet, type SOSConfigData } from '../components/SOSConfigSheet';

import { DraggableSheet } from '../components/layout/DraggableSheet';
import { type POI, formatPOIDistance } from '../services/poiService';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext.base';
import { getFamilyData } from '../services/familyService';
import { getSafeZones, type SafeZone } from '../services/locationService';
import { 
    getActiveAlerts, 
    subscribeToSOSAlerts, 
    requestSOSPermissions, 
    requestNotificationPermission,
    executeSOSProtocol
} from '../services/sosService';
import type { FamilyGroup, SOSAlert } from '../services/database.types';
import { AddSafeZoneModal } from '../components/safety/AddSafeZoneModal';
import { NightModeWarning } from '../components/safety/NightModeWarning';
import { LocationHistoryModal } from '../components/map/LocationHistoryModal';
import { ShieldAlert, Send, Users, Battery } from 'lucide-react';
import { searchPlaces, getCategoryIcon, type GeocodingResult } from '../services/geocodingService';

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
    isEmergency?: boolean;
    route: { from: string; to: string; eta: string; progress: number } | null;
}

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, isPremium } = useAuth();
    const { openSOSModal, openPaywall } = useSOS();

    // Estados
    const [familyMembers, setFamilyMembers] = useState<UIMember[]>([]);
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);

    const [activeTab, setActiveTab] = useState<'places' | 'alerts' | 'family'>('places');
    const [selectedMember, setSelectedMember] = useState<string | null>(null); // Changed to string
    const [showSOSConfig, setShowSOSConfig] = useState(false);

    const [showAddZoneModal, setShowAddZoneModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState<UIMember | null>(null);
    const [sosConfig, setSOSConfig] = useState<SOSConfigData | null>(null);
    const [, setSheetHeight] = useState(45);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

    const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
    const [activeAlerts, setActiveAlerts] = useState<SOSAlert[]>([]);
    const [pendingZoneCheck, setPendingZoneCheck] = useState<{ zoneId: string; type: string; description: string } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cargar familia y zonas
    const loadData = async () => {
        if (!user) {
            setFamilyMembers([]);
            setFamilyGroup(null);
            setSafeZones([]);

            return;
        }

        // Delay slightly to prioritize map render
        setTimeout(async () => {
            try {
                const { group, members } = await getFamilyData(user.id);
                setFamilyGroup(group);

                if (group) {
                    const [zones, alerts] = await Promise.all([
                        getSafeZones(group.id),
                        getActiveAlerts(group.id)
                    ]);
                    setSafeZones(zones);
                    setActiveAlerts(alerts);
                    
                    if (isPremium || alerts.length > 0) {
                        setActiveTab('family');
                    }
                }

                if (group && members.length > 0) {
                    // Mapear datos de DB a UI (Optimized mapping)
                    const uiMembers: UIMember[] = members.map((m: any) => {
                        const loc = m.location;
                        const hasActiveAlert = activeAlerts.some((a: any) => a.user_id === m.profile.id);
                        // Format last update time
                        let timeString = t('common.no_data') || 'Sin datos';
                        if (loc?.created_at) {
                            const date = new Date(loc.created_at);
                            const now = new Date();
                            const diff = (now.getTime() - date.getTime()) / 1000 / 60; // minutes
                            if (diff < 1) timeString = t('common.now');
                            else if (diff < 60) timeString = `${t('common.ago')} ${Math.floor(diff)} min`;
                            else timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }

                        return {
                            id: m.profile.id,
                            name: m.profile.full_name?.split(' ')[0] || (m.profile.id === user.id ? t('home.me') : t('home.user_placeholder')),
                            avatar: m.role === 'child' ? '👧' : m.role === 'admin' ? '👨' : '👤',
                            avatarUrl: m.profile.avatar_url,
                            avatarBg: hasActiveAlert ? 'bg-red-600' : 'bg-slate-600',
                            location: hasActiveAlert ? `⚠️ ${t('home.emergency_active')}` : (loc ? t('home.current_location') : t('home.no_location')),
                            lat: loc ? loc.lat : 0,
                            lng: loc ? loc.lng : 0,
                            status: loc && loc.speed && loc.speed > 5 ? 'moving' : 'stationary',
                            speed: loc?.speed ? `${Math.round(loc.speed)} km/h` : null,
                            battery: loc?.battery_level || 0,
                            lastUpdate: timeString,
                            isEmergency: hasActiveAlert,
                            route: null
                        };
                    });
                    
                    // Extra safety: If I am in an active SOS but not in members list (unlikely), add me
                    const myAlert = activeAlerts.find(a => a.user_id === user.id);
                    if (myAlert && !uiMembers.find(m => m.id === user.id)) {
                        uiMembers.push({
                            id: user.id,
                            name: t('home.me'),
                            avatar: '👤',
                            avatarUrl: user.profile?.avatar_url,
                            avatarBg: 'bg-red-600',
                            location: `⚠️ ${t('home.emergency_active')}`,
                            lat: myAlert.lat || 0,
                            lng: myAlert.lng || 0,
                            status: 'stationary',
                            speed: null,
                            battery: 100,
                            lastUpdate: t('common.now'),
                            isEmergency: true,
                            route: null
                        });
                    }

                    setFamilyMembers(uiMembers);
                } else {
                    setFamilyMembers([]);
                }
            } catch (error) {
                console.error('Error loading data:', error);
                setFamilyMembers([]);
                setSafeZones([]);
            }
        }, 100);
    };

    // Suscribir a alertas en tiempo real
    useEffect(() => {
        if (!user || !familyGroup) return;

        const { unsubscribe } = subscribeToSOSAlerts(familyGroup.id, (newAlert) => {
            console.log('New SOS alert received:', newAlert);
            setActiveAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
            setActiveTab('family');
            loadData(); // Reload to update member icons
        });

        // Listen for danger zone re-confirmation requests
        const handleZoneCheck = (e: any) => {
            setPendingZoneCheck(e.detail);
        };
        window.addEventListener('danger-zone-check', handleZoneCheck);

        return () => {
            unsubscribe();
            window.removeEventListener('danger-zone-check', handleZoneCheck);
        };
    }, [user, familyGroup]);

    // Onboarding check
    useEffect(() => {
        const onboarding = localStorage.getItem('onboarding_complete');
        if (!onboarding) {
            navigate('/onboarding');
        }
    }, [navigate]);

    // Cargar si ya estaba configurado SOS localmente y forzar si no
    useEffect(() => {
        const checkSOSConfig = async () => {
            const { Preferences } = await import('@capacitor/preferences');
            const { value: pin } = await Preferences.get({ key: 'SOS_PIN' });
            
            if (pin) {
                if (!sosConfig) {
                    setSOSConfig({
                        contacts: [],
                        pin: pin,
                        autoCall112: true,
                        shareLocation: true,
                        recordAudio: true,
                        privacyPolicyAccepted: true,
                        isConfigured: true,
                    });
                }
            }
            if (user?.profile?.sos_pin) {
                // All good
            } else {
                // If NO PIN, force open setup immediately for security compliance
                setShowSOSConfig(true);
            }
        };

        checkSOSConfig();
    }, [user, sosConfig]);

    useEffect(() => {
        loadData();
        
        // Request permissions on entry for better SOS readiness
        const requestInitialPermissions = async () => {
            try {
                // Parallel request for all critical permissions
                await Promise.all([
                    requestSOSPermissions(),
                    requestNotificationPermission()
                ]);
                console.log('Initial permissions checked');
            } catch (err) {
                console.warn('Initial permission request failed:', err);
            }
        };
        
        // Trigger permissions request
        requestInitialPermissions();
    }, [user, familyGroup?.id]);

    // Suscribir a ubicaciones en tiempo real
    useEffect(() => {
        if (!user || !familyGroup) return;

        const subscription = supabase
            .channel('location-updates')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'locations' 
            }, (payload: any) => {
                const newLoc = payload.new;
                setFamilyMembers(prev => prev.map(m => {
                    if (m.id === newLoc.user_id) {
                        return { 
                            ...m, 
                            lat: newLoc.lat, 
                            lng: newLoc.lng,
                            battery: newLoc.battery_level || m.battery,
                            speed: newLoc.speed ? `${Math.round(newLoc.speed)} km/h` : m.speed,
                            status: newLoc.speed > 5 ? 'moving' : 'stationary',
                            lastUpdate: t('common.now')
                        };
                    }
                    return m;
                }));
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user, familyGroup]);

    // Lógica de búsqueda autocompletada
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (searchQuery.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            // Get current location for proximity bit
            const me = familyMembers.find(m => m.id === user?.id);
            const proximity = me?.lat && me?.lng ? { lat: me.lat, lng: me.lng } : undefined;
            
            const results = await searchPlaces(searchQuery, proximity);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchQuery]);

    const handleSelectSuggestion = (suggestion: GeocodingResult) => {
        setSearchQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
        navigate('/route', {
            state: {
                destination: { lat: suggestion.lat, lng: suggestion.lng },
                destinationName: suggestion.name
            }
        });
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display relative">

            {/* Header con buscador - Cleaned version (Floating) */}
            <div className="absolute top-0 left-0 right-0 z-40 flex flex-col gap-3 px-4 pt-14 pb-3 pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className={clsx(
                        "flex-1 flex items-center gap-3 px-4 py-3 bg-zinc-900/90 backdrop-blur-md rounded-2xl border transition-all relative shadow-lg shadow-black/20",
                        showSuggestions ? "border-primary" : "border-white/10"
                    )}>
                        <span className="material-symbols-outlined text-primary text-2xl">search</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={t('home.search_placeholder')}
                            value={searchQuery}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (e.target.value.length >= 2) setShowSuggestions(true);
                            }}
                            onFocus={() => {
                                if (searchQuery.length >= 2) setShowSuggestions(true);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && suggestions.length > 0) {
                                    handleSelectSuggestion(suggestions[0]);
                                }
                            }}
                            className="flex-1 bg-transparent text-white placeholder-white/40 outline-none h-10"
                            style={{ fontSize: '16px' }}
                        />
                        {isSearching && (
                            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                        )}

                        {/* Suggestions Overlay - REINFORCED Z-INDEX 9999 */}
                        {showSuggestions && searchQuery.length >= 2 && (
                            <div className="absolute top-[calc(100%+12px)] left-0 right-0 bg-zinc-900 border border-white/20 rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[9999] max-h-[350px] overflow-y-auto backdrop-blur-xl">
                                {isSearching && suggestions.length === 0 ? (
                                    <div className="px-5 py-8 text-center flex flex-col items-center gap-3">
                                        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span className="text-white/40 text-sm font-medium">{t('home.searching')}</span>
                                    </div>
                                ) : suggestions.length > 0 ? (
                                    <div className="flex flex-col">
                                        {suggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.id}
                                                onClick={() => handleSelectSuggestion(suggestion)}
                                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/10 border-b border-white/5 last:border-0 text-left transition-all active:bg-white/20"
                                            >
                                                <div className="size-11 rounded-xl bg-white/5 flex items-center justify-center text-primary shrink-0 transition-colors group-hover:bg-primary/20">
                                                    <span className="material-symbols-outlined text-2xl">
                                                        {getCategoryIcon(suggestion.category || 'location_on')}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-bold text-sm truncate">{suggestion.name}</p>
                                                    <p className="text-white/40 text-[11px] truncate mt-0.5">{suggestion.address}</p>
                                                </div>
                                                <span className="material-symbols-outlined text-white/20 text-lg">north_west</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : !isSearching && (
                                    <div className="px-5 py-10 text-center">
                                        <span className="material-symbols-outlined text-white/20 text-4xl mb-2">search_off</span>
                                        <p className="text-white/40 text-sm">{t('home.no_results')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    <button
                        onClick={() => navigate('/notifications')}
                        className={clsx(
                            "size-12 rounded-2xl flex items-center justify-center shrink-0 relative transition-all active:scale-90 border",
                            activeAlerts.length > 0 
                                ? "bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                                : "bg-white/10 text-white border-white/10"
                        )}
                    >
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {activeAlerts.length > 0 ? 'notifications_active' : 'notifications'}
                        </span>
                        {activeAlerts.length > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-white text-red-600 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-red-600">
                                {activeAlerts.length}
                            </span>
                        )}
                    </button>
                </div>
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
                    showIncidenceZones={true}
                    showPOIs={true}
                    onPOIClick={(poi) => {
                        setShowSuggestions(false);
                        setSelectedPOI(poi);
                    }}
                    onMemberClick={(id) => {
                        setShowSuggestions(false);
                        setSelectedMember(id);
                    }}
                >





                </UnifiedMap>
            </div>

            {/* Bottom Sheet con Tabs - Deslizable */}
            <DraggableSheet
                minHeight={80}
                maxHeight={70}
                defaultHeight={45}
                onHeightChange={setSheetHeight}
                floatingContent={
                    <div className="flex items-center justify-between w-full">
                        <div className="flex gap-2 shrink-0">
                            {/* History button removed as requested */}
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {sosConfig?.isConfigured && (
                                <button
                                    onClick={() => setShowSOSConfig(true)}
                                    className="size-12 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-lg shrink-0"
                                    title={t('nav.settings')}
                                >
                                    <span className="material-symbols-outlined">tune</span>
                                </button>
                            )}
                        </div>
                    </div>
                }
            >
                {/* Tabs estilo Life360 */}
                <div className="flex items-center justify-center gap-1 px-4 pb-3 shrink-0">
                    <button
                        onClick={() => setActiveTab('places')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            activeTab === 'places' ? "bg-primary text-white" : "bg-white/5 text-white/60"
                        )}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeTab === 'places' ? "'FILL' 1" : "" }}>location_on</span>
                        {t('nav.map')}
                    </button>

                    <button
                        onClick={() => setActiveTab('family')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            activeTab === 'family' ? "bg-primary text-white" : "bg-white/5 text-white/60"
                        )}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeTab === 'family' ? "'FILL' 1" : "" }}>group</span>
                        {t('nav.family') || 'Family'}
                    </button>
                </div>

                {/* Content area */}
                <div className="px-4 pb-28 flex-1 overflow-y-auto no-scrollbar">



                    {activeTab === 'places' && (
                        <div className="flex flex-col gap-3">


                            {/* Lugares guardados */}
                            {safeZones.length === 0 ? (
                                <div className="p-4 text-center text-white/40 text-sm">
                                    {t('home.no_saved_places')}
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
                                            <p className="text-xs text-white/40">{t('home.radius')}: {zone.radius}m</p>
                                        </div>
                                        <span className="material-symbols-outlined text-white/40">chevron_right</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}



                    {activeTab === 'family' && (
                        <div className="flex flex-col gap-3">
                            {familyMembers.length === 0 ? (
                                <div className="p-4 text-center text-white/40 text-sm">
                                    {t('home.no_family_members')}
                                </div>
                            ) : (
                                familyMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() => setSelectedMember(member.id)}
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
                                    >
                                        <div className={clsx(
                                            "size-10 rounded-full flex items-center justify-center text-xl overflow-hidden",
                                            member.avatarBg
                                        )}>
                                            {member.avatarUrl ? (
                                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                            ) : member.avatar}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{member.name}</p>
                                            <p className="text-xs text-white/40">{member.location}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1 text-[10px] text-white/40">
                                                <Battery size={12} className={member.battery < 20 ? 'text-red-500' : ''} />
                                                {member.battery}%
                                            </div>
                                            <p className="text-[10px] text-white/20">{member.lastUpdate}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </DraggableSheet>

            {/* Guard Configuration Sheet */}
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
                                <p className="text-xs text-white/40 mt-1">{t('home.poi_open')}</p>
                            </div>
                            <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                                <span className="material-symbols-outlined text-white/60 text-xl">star</span>
                                <p className="text-xs text-white/40 mt-1">4.5 {t('home.poi_rating')}</p>
                            </div>
                            <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                                <span className="material-symbols-outlined text-white/60 text-xl">euro</span>
                                <p className="text-xs text-white/40 mt-1">{t('home.poi_price')}</p>
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
                                {t('home.how_to_get_there')}
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
                                                    {t('common.updated')}: {member.lastUpdate}
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
                                                        destinationName: t('home.member_location', { name: member.name })
                                                    }
                                                });
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-transform active:scale-95 text-sm"
                                        >
                                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>directions</span>
                                            {t('common.go')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!isPremium) {
                                                    openPaywall(t('home.gate_history'));
                                                } else {
                                                    setShowHistoryModal(member);
                                                }
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-colors text-sm"
                                        >
                                            <span className="material-symbols-outlined text-lg">history</span>
                                            {t('home.history')}
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
