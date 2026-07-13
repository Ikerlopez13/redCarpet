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
import { TrustedContactsService } from '../services/trustedContactsService';
import { getSafeZones, type SafeZone } from '../services/locationService';
import { 
    getActiveAlerts, 
    subscribeToSOSAlerts, 
    requestSOSPermissions, 
    requestNotificationPermission,
    executeSOSProtocol
} from '../services/sosService';
import type { SOSAlert } from '../services/database.types';
import { AddSafeZoneModal } from '../components/safety/AddSafeZoneModal';
import { NightModeWarning } from '../components/safety/NightModeWarning';
import { ReportDangerModal } from '../components/safety/ReportDangerModal';
import { LocationHistoryModal } from '../components/map/LocationHistoryModal';
import { ShieldAlert, Send, Users, Battery, Shield, Zap } from 'lucide-react';

import { searchPlaces, getCategoryIcon, type GeocodingResult } from '../services/geocodingService';
import { AlertDetailsModal } from '../components/safety/AlertDetailsModal';

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
    const { user, isPremium, refreshProfile } = useAuth();
    const { openSOSModal, openPaywall } = useSOS();

    // Estados
    const [familyMembers, setFamilyMembers] = useState<UIMember[]>([]);
    const [familyGroup, setFamilyGroup] = useState<any | null>(null);

    const [activeTab, setActiveTab] = useState<'places' | 'alerts' | 'family'>('places');
    const [selectedMember, setSelectedMember] = useState<string | null>(null); // Changed to string
    const [showSOSConfig, setShowSOSConfig] = useState(false);

    const [showAddZoneModal, setShowAddZoneModal] = useState(false);
    const [showReportDangerModal, setShowReportDangerModal] = useState(false);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState<UIMember | null>(null);
    const [sosConfig, setSOSConfig] = useState<SOSConfigData | null>(null);
    const [, setSheetHeight] = useState(45);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

    const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
    const [activeAlerts, setActiveAlerts] = useState<SOSAlert[]>([]);
    const [incidenceZones, setIncidenceZones] = useState<any[]>([]);
    const [pendingZoneCheck, setPendingZoneCheck] = useState<{ zoneId: string; type: string; description: string } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Loader state
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Cargar familia y zonas
    const loadData = async () => {
        if (!user) {
            setFamilyMembers([]);
            setFamilyGroup(null);
            setSafeZones([]);
            setIsInitialLoading(false);
            return;
        }

        try {
            // Parallelize independent initial requests
            const contactsPromise = TrustedContactsService.getContacts(user.id);
            const dangerPromise = supabase
                .from('danger_zones')
                .select('*')
                .or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`);

            const { getFamilyGroup, createFamilyGroup } = await import('../services/familyService');
            const groupPromise = getFamilyGroup(user.id).then(async (g) => {
                if (!g) {
                    const { group: newG } = await createFamilyGroup("Mi Círculo", "parental", user.id);
                    return newG;
                }
                return g;
            });

            const [contacts, { data: dangerData }, group] = await Promise.all([
                contactsPromise, 
                dangerPromise, 
                groupPromise
            ]);

            setFamilyGroup(group);

            const acceptedContacts = contacts.filter(c => c.status === 'accepted' && c.associated_user_id);
            const relevantUserIds = [user.id, ...acceptedContacts.map(c => c.associated_user_id as string)];
            
            // Now fetch dependent requests in parallel
            const alertsPromise = supabase
                .from('sos_alerts')
                .select('*')
                .in('user_id', relevantUserIds)
                .eq('status', 'active');
            
            const safeZonesPromise = group ? getSafeZones(group.id) : Promise.resolve([]);

            const [{ data: alertsData }, zones] = await Promise.all([alertsPromise, safeZonesPromise]);
            
            const alerts = (alertsData || []) as SOSAlert[];
            const dangers = (dangerData || []) as any[];

            setSafeZones(zones);
            setActiveAlerts(alerts);
            setIncidenceZones(dangers.map(zone => {
                let title = (zone.type === 'dark' ? t('map.light_notice') : 
                             zone.type === 'incident' ? t('map.incident') : 
                             zone.type === 'construction' ? t('map.construction') : 
                             zone.type === 'traffic' ? t('map.traffic') : t('map.poi'));
                let description = zone.description || t('map.active_zone_detected');
                
                if (zone.description && zone.description.includes(' - ')) {
                    const parts = zone.description.split(' - ');
                    title = parts[0];
                    description = parts[1];
                }

                return {
                    id: zone.id,
                    lat: zone.lat,
                    lng: zone.lng,
                    radius: zone.radius,
                    title,
                    description
                };
            }));
            
            if (alerts.length > 0) {
                setActiveTab('family');
            }

                if (contacts.length > 0) {
                    // Fetch latest locations for contacts that have associated user IDs
                    const contactIds = contacts.map(c => c.associated_user_id as string).filter(Boolean);
                    
                    let locations: any[] = [];
                    let profilesMap: Record<string, string> = {};
                    if (contactIds.length > 0) {
                        const profRes = await supabase.from('profiles').select('id, avatar_url').in('id', contactIds);
                        
                        // Fetch latest location for EACH contact individually to avoid Supabase 1000 row limits cutting off recent data
                        const locPromises = contactIds.map(id => 
                            supabase.from('locations')
                                .select('*')
                                .eq('user_id', id)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .single()
                        );
                        
                        const locResults = await Promise.allSettled(locPromises);
                        locations = locResults
                            .filter(r => r.status === 'fulfilled' && r.value.data)
                            .map((r: any) => r.value.data);
                        
                        const profiles = profRes.data || [];
                        profilesMap = profiles.reduce((acc: any, p: any) => {
                            if (p.avatar_url) acc[p.id] = p.avatar_url;
                            return acc;
                        }, {});
                    }

                    const uiMembers: UIMember[] = contacts.map((c) => {
                        const isPending = c.status === 'pending' || !c.associated_user_id;
                        const loc = isPending ? undefined : locations.find((l: any) => l.user_id === c.associated_user_id);
                        const hasActiveAlert = !isPending && alerts.some((a) => a.user_id === c.associated_user_id);
                        
                        // Location is visible if they are an accepted contact
                        const isLocationHidden = false;

                        let timeString = t('common.no_data') || 'Sin datos';
                        if (isPending) {
                            timeString = 'Pendiente';
                        } else if (loc?.created_at) {
                            const date = new Date(loc.created_at);
                            const now = new Date();
                            const diff = (now.getTime() - date.getTime()) / 1000 / 60;
                            if (diff < 1) timeString = t('common.now');
                            else if (diff < 60) timeString = `${t('common.ago')} ${Math.floor(diff)} min`;
                            else timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }

                        let displayLocation = t('home.no_location');
                        if (isPending) {
                            displayLocation = 'Invitación pendiente...';
                        } else if (hasActiveAlert) {
                            displayLocation = `⚠️ ${t('home.emergency_active')}`;
                        } else if (isLocationHidden) {
                            displayLocation = loc ? t('home.current_location') + ' (Pausada)' : t('home.no_location');
                        } else if (loc) {
                            displayLocation = t('home.current_location');
                        }

                        return {
                            id: c.associated_user_id || c.id, // Fallback to contact ID if pending
                            name: c.name,
                            avatar: isPending ? '⏳' : '👤',
                            avatarUrl: !isPending && c.associated_user_id ? (profilesMap[c.associated_user_id] || null) : null,
                            avatarBg: hasActiveAlert ? 'bg-red-600' : (isPending ? 'bg-zinc-700' : 'bg-slate-600'),
                            location: displayLocation,
                            lat: (!isLocationHidden && loc) ? loc.lat : 0,
                            lng: (!isLocationHidden && loc) ? loc.lng : 0,
                            status: loc && loc.speed && loc.speed > 5 ? 'moving' : 'stationary',
                            speed: loc?.speed ? `${Math.round(loc.speed)} km/h` : null,
                            battery: loc?.battery_level || 0,
                            lastUpdate: timeString,
                            isEmergency: hasActiveAlert,
                            route: null
                        };
                    });
                    


                    setFamilyMembers(uiMembers.filter(Boolean) as UIMember[]);
                } else {
                    setFamilyMembers([]);
                }
        } catch (error) {
            console.error('Error loading data:', error);
            setFamilyMembers([]);
            setSafeZones([]);
        } finally {
            setIsInitialLoading(false);
        }
    };

    // Suscribir a alertas en tiempo real
    useEffect(() => {
        if (!user) return;

        const subscription = supabase
            .channel(`sos-alerts-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sos_alerts'
                    // We can't filter by group_id anymore easily since it's user.id or contact's user.id, so we just listen to all and reload data
                },
                (payload: any) => {
                    console.log('New SOS alert received:', payload.new);
                    // Just reload the data to get the latest state
                    loadData();
                }
            )
            .subscribe();

        // Listen for danger zone re-confirmation requests
        const handleZoneCheck = (e: any) => {
            setPendingZoneCheck(e.detail);
        };
        window.addEventListener('incidence-zone-check', handleZoneCheck);

        return () => {
            supabase.removeChannel(subscription);
            window.removeEventListener('incidence-zone-check', handleZoneCheck);
        };
    }, [user]);

    // Onboarding check - waits for profile to load before deciding
    useEffect(() => {
        // 1. If already marked complete in localStorage → skip
        const localOnboarding = localStorage.getItem('onboarding_complete');
        if (localOnboarding) return;

        // 2. If user exists but profile hasn't loaded yet → wait (avoid race condition)
        if (user && !user.profile) return;

        // 3. Profile is loaded — check if they already completed onboarding on another device
        // (onboarding_completed vive en el perfil; las señales antiguas quedan de respaldo)
        if (user?.profile?.onboarding_completed || user?.profile?.privacy_policy_accepted || user?.profile?.dob) {
            localStorage.setItem('onboarding_complete', 'true');
            return;
        }

        // 4. Profile is loaded and shows this is a brand new user → send to onboarding
        if (user && user.profile) {
            navigate('/onboarding');
        }
    }, [navigate, user, user?.profile]);


    // Cargar si ya estaba configurado SOS localmente y forzar si no
    useEffect(() => {
        const checkSOSConfig = async () => {
            // Prevent prompt if we already asked during this session
            if (sessionStorage.getItem('sos_config_prompted') === 'true') {
                return;
            }

            const { Preferences } = await import('@capacitor/preferences');
            const { value: pin } = await Preferences.get({ key: 'SOS_PIN' });
            const { value: localConfig } = await Preferences.get({ key: 'sos_config' });
            
            let parsedPin = '';
            if (localConfig) {
                try {
                    parsedPin = JSON.parse(localConfig).pin;
                } catch {}
            }

            const activePin = pin || parsedPin || user?.profile?.sos_pin;

            if (activePin) {
                if (!sosConfig) {
                    setSOSConfig({
                        contacts: [],
                        pin: activePin,
                        autoCall112: true,
                        shareLocation: true,
                        recordAudio: true,
                        privacyPolicyAccepted: true,
                        isConfigured: true,
                    });
                }
            } else {
                // If NO PIN at all, force open setup immediately for security compliance, but flag it
                sessionStorage.setItem('sos_config_prompted', 'true');
                setShowSOSConfig(true);
            }
        };

        if (user) {
            checkSOSConfig();
        }
    }, [user, sosConfig]);

    useEffect(() => {
        loadData();
        
        // Request permissions on entry for better SOS readiness
        const requestInitialPermissions = async () => {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const locPerms = await Geolocation.checkPermissions();
                if (locPerms.location !== 'granted') {
                    await Geolocation.requestPermissions();
                }
                const { PushNotifications } = await import('@capacitor/push-notifications');
                const pushPerms = await PushNotifications.checkPermissions();
                if (pushPerms.receive !== 'granted') {
                    await requestNotificationPermission();
                }
                console.log('Initial permissions checked');
            } catch (err) {
                console.warn('Initial permission request failed:', err);
            }
        };
        
        // Trigger permissions request
        requestInitialPermissions();
    }, [user]);

    useEffect(() => {
        if (!user) return;

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
    }, [user]);

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

    const clickCountRef = useRef(0);
    const lastClickTimeRef = useRef(0);

    const handleMapShortcut = () => {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 500) {
            clickCountRef.current += 1;
        } else {
            clickCountRef.current = 1;
        }
        lastClickTimeRef.current = now;

        if (clickCountRef.current === 3) {
            console.log('[Home] Map Triple-Click SOS Shortcut Triggered');
            openSOSModal('visible', true);
            clickCountRef.current = 0;
        }
    };

    return (
        <div 
            className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display relative"
            onClick={handleMapShortcut}
        >
            {isInitialLoading && (
                <div className="absolute inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0d0d0d] text-white">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#FF3131]/10 blur-[100px] rounded-full pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col items-center animate-scale-in">
                        <div className="w-24 h-24 rounded-[2rem] bg-[#FF3131]/10 border border-[#FF3131]/20 flex items-center justify-center shadow-[0_0_40px_rgba(255,49,49,0.2)] p-4 animate-pulse">
                            <img src="/logo.png" alt="RedCarpet" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,49,49,0.5)]" />
                        </div>
                    </div>
                </div>
            )}

            {/* Header con buscador - Cleaned version (Floating) */}
            <div className="absolute top-12 left-0 right-0 z-40 px-6 flex justify-between items-center pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto w-full">
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
                    externalIncidenceZones={incidenceZones}
                    showPOIs={true}
                    onPOIClick={(poi) => {
                        setShowSuggestions(false);
                        setSelectedPOI(poi);
                    }}
                    onMemberClick={(id) => {
                        setShowSuggestions(false);
                        setSelectedMember(id);
                    }}
                    onZoneClick={(id) => {
                        setShowSuggestions(false);
                        setSelectedZoneId(id);
                    }}
                >
                    <div className="absolute top-[120px] right-4 z-40 pointer-events-auto flex flex-col items-end gap-3">
                        <button
                            onClick={() => navigate('/notifications')}
                            className={clsx(
                                "size-14 rounded-2xl flex items-center justify-center shrink-0 relative transition-all active:scale-90 border shadow-xl backdrop-blur-md",
                                activeAlerts.length > 0
                                    ? "bg-red-600/90 text-white border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]" 
                                    : "bg-zinc-900/90 text-white border-white/10"
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

                        <button
                            onClick={() => setShowReportDangerModal(true)}
                            className="size-14 bg-amber-500/90 backdrop-blur-md rounded-2xl border border-amber-400/50 flex items-center justify-center shadow-xl shadow-amber-500/20 text-black hover:bg-amber-400 active:scale-95 transition-all pointer-events-auto"
                            title={t('home.report_danger') || 'Reportar peligro'}
                        >
                            <span className="material-symbols-outlined text-2xl font-black">warning</span>
                        </button>

                        {sosConfig?.isConfigured && (
                            <button
                                onClick={() => setShowSOSConfig(true)}
                                className="size-14 rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-md text-white flex items-center justify-center shadow-xl shrink-0 hover:bg-zinc-800 active:scale-95 transition-all"
                                title={t('nav.settings')}
                            >
                                <span className="material-symbols-outlined">tune</span>
                            </button>
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
                floatingContent={null}
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
                        Tu Círculo
                    </button>
                </div>

                {/* Content area */}
                <div className="px-4 pb-28 flex-1 overflow-y-auto no-scrollbar">



                    {activeTab === 'places' && (
                        <div className="flex flex-col gap-3">

                            {/* Button to Add Trusted Place */}
                            <button
                                onClick={() => setShowAddZoneModal(true)}
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg transition-all active:scale-[0.98] mb-2"
                            >
                                <span className="material-symbols-outlined text-lg">add_location_alt</span>
                                Añadir Lugar de Confianza
                            </button>

                            {/* Lugares guardados */}
                            {safeZones.length === 0 ? (
                                <div className="p-4 text-center text-white/40 text-sm">
                                    {t('home.no_saved_places')}
                                </div>
                            ) : (
                                safeZones.map((zone) => (
                                    <div
                                        key={zone.id}
                                        onClick={() => navigate('/route', { state: { destination: { lat: zone.lat, lng: zone.lng }, destinationName: zone.name } })}
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        <div className="size-10 rounded-full bg-white/10 flex items-center justify-center text-xl shrink-0">
                                            {zone.name.toLowerCase().includes('casa') ? '🏠' :
                                                zone.name.toLowerCase().includes('escuela') || zone.name.toLowerCase().includes('colegio') ? '🎓' :
                                                    zone.name.toLowerCase().includes('trabajo') ? '💼' : '📍'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{zone.name}</p>
                                            <p className="text-xs text-white/40">{t('home.radius')}: {zone.radius}m</p>
                                        </div>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if(window.confirm('¿Eliminar este lugar de confianza?')) {
                                                    await supabase.from('safe_zones').delete().eq('id', zone.id);
                                                    loadData();
                                                }
                                            }}
                                            className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all shrink-0"
                                            title="Eliminar lugar"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                        <span className="material-symbols-outlined text-white/40 shrink-0">chevron_right</span>
                                    </div>
                                ))
                            )}

                            {!isPremium && (
                                <div 
                                    onClick={() => navigate('/subscription')}
                                    className="mt-2 p-4 rounded-2xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-between cursor-pointer hover:from-primary/30 hover:to-primary/10 transition-colors shadow-lg shadow-primary/5"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white mb-0.5">{t('nav.premium')}</span>
                                        <span className="text-xs text-white/60">{t('route.gate_unlimited')}</span>
                                    </div>
                                    <div className="bg-primary/20 p-2 rounded-full shadow-inner flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-sm">workspace_premium</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}



                    {activeTab === 'family' && (
                        <div className="flex flex-col gap-3">
                            {/* Detailed Security Circle Access */}
                            <button
                                onClick={() => navigate('/security')}
                                className="flex items-center justify-between p-4 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-all mb-2"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <Shield size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black uppercase italic tracking-tight">Círculo de Seguridad</span>
                                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Detalle Interno</span>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-white/60">chevron_right</span>
                            </button>

                            {familyMembers.length === 0 ? (
                                <div className="p-4 text-center text-white/40 text-sm flex flex-col items-center gap-3">
                                    <span className="material-symbols-outlined text-4xl text-white/20">group_add</span>
                                    Aún no tienes a nadie en Tu Círculo.
                                    <button 
                                        onClick={() => navigate('/contacts')}
                                        className="mt-2 bg-primary text-white font-bold py-2 px-4 rounded-xl text-xs active:scale-95 transition-all"
                                    >
                                        Añadir Contactos
                                    </button>
                                </div>
                            ) : (
                                <>
                                {familyMembers.map((member) => (
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
                                ))}
                                <button 
                                    onClick={() => navigate('/contacts')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 border-dashed text-left hover:bg-white/10 transition-colors mt-2"
                                >
                                    <div className="size-10 rounded-full bg-white/5 flex items-center justify-center text-xl text-white/40">
                                        <span className="material-symbols-outlined">add</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-white/60">Añadir más contactos</p>
                                    </div>
                                </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </DraggableSheet>

            {/* Guard Configuration Sheet */}
            <SOSConfigSheet
                isOpen={showSOSConfig}
                onClose={() => setShowSOSConfig(false)}
                onSave={async (config) => {
                    // 1. Save to Capacitor Preferences
                    const { Preferences } = await import('@capacitor/preferences');
                    await Preferences.set({ key: 'sos_config', value: JSON.stringify(config) });
                    await Preferences.set({ key: 'SOS_PIN', value: config.pin });
                    
                    // 2. Save to localStorage for Web compatibility
                    localStorage.setItem('sos_config', JSON.stringify(config));
                    localStorage.setItem('SOS_PIN', config.pin);
                    
                    // 3. Save to remote Supabase
                    if (user) {
                        try {
                            await supabase.from('profiles').update({ sos_pin: config.pin }).eq('id', user.id);
                            await refreshProfile();
                        } catch (err) {
                            console.error('[Home] Error updating profile pin:', err);
                        }
                    }
                    
                    setSOSConfig(config);
                    setShowSOSConfig(false);
                    
                    // Show Premium interstitial
                    setTimeout(() => {
                        navigate('/subscription');
                    }, 500);
                }}
                currentConfig={sosConfig || undefined}
            />

            {/* Zone Verification Modal */}
            {pendingZoneCheck && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 text-center shadow-2xl animate-scale-in">
                        <div className="size-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                        </div>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">Verificar Alerta</h3>
                        <p className="text-sm text-white/60 font-medium mb-8 leading-relaxed">
                            Acabas de pasar por una incidencia ({pendingZoneCheck.type}) reportada hace tiempo. ¿Sigue estando activa?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={async () => {
                                    setPendingZoneCheck(null);
                                    const { data } = await supabase.from('danger_zones').select('votes_down').eq('id', pendingZoneCheck.zoneId).single();
                                    if (data) {
                                        await supabase.from('danger_zones').update({ votes_down: (data.votes_down || 0) + 1 }).eq('id', pendingZoneCheck.zoneId);
                                    }
                                }}
                                className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 active:scale-95 transition-all"
                            >
                                Ya no está
                            </button>
                            <button 
                                onClick={async () => {
                                    setPendingZoneCheck(null);
                                    const { data } = await supabase.from('danger_zones').select('votes_up').eq('id', pendingZoneCheck.zoneId).single();
                                    if (data) {
                                        await supabase.from('danger_zones').update({ votes_up: (data.votes_up || 0) + 1 }).eq('id', pendingZoneCheck.zoneId);
                                    }
                                }}
                                className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                            >
                                Sigue aquí
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Safe Zone Modal (Now using familyGroup.id again) */}
            <AddSafeZoneModal
                isOpen={showAddZoneModal}
                onClose={() => setShowAddZoneModal(false)}
                familyId={familyGroup?.id || ''}
                onSuccess={loadData}
            />

            {/* Report Danger Modal */}
            {user && (
                <ReportDangerModal
                    isOpen={showReportDangerModal}
                    onClose={() => setShowReportDangerModal(false)}
                    userLat={familyMembers.find(m => m.id === user.id)?.lat || 0}
                    userLng={familyMembers.find(m => m.id === user.id)?.lng || 0}
                    onSuccess={loadData}
                />
            )}

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

            {/* Alert Details Modal */}
            <AlertDetailsModal
                zoneId={selectedZoneId}
                isOpen={!!selectedZoneId}
                onClose={() => setSelectedZoneId(null)}
                onAlertDeleted={loadData}
            />

        </div>
    );
};
