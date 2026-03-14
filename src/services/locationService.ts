import { supabase } from './supabaseClient';
import type { Location, DangerZone } from './database.types';

// Mock locations for family members (removed)


let watchId: number | null = null;
let realtimeSubscription: ReturnType<typeof supabase.channel> | null = null;

/**
 * Update current user's location
 */
export async function updateLocation(
    userId: string,
    position: GeolocationPosition,
    batteryLevel?: number,
    role?: 'admin' | 'member' | 'child',
    isSOSActive?: boolean
): Promise<{ error: string | null }> {
    // Child Privacy: Only share if SOS is active
    if (role === 'child' && !isSOSActive) {
        // We still check danger zones locally for the child, to trigger alerts if needed!
        // But we do NOT save to DB for parents to see live location.
        checkDangerZones(userId, position.coords.latitude, position.coords.longitude);
        return { error: null };
    }

    const location: Omit<Location, 'id' | 'created_at'> = {
        user_id: userId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        battery_level: batteryLevel || null,
        speed: position.coords.speed,
        heading: position.coords.heading,
    };

    // Also check danger zones for everyone
    checkDangerZones(userId, position.coords.latitude, position.coords.longitude);

    const { error } = await (supabase.from('locations') as any)
        .insert(location);

    return { error: error?.message || null };
}

/**
 * Get current user position (promisified)
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

/**
 * Get latest location for a user
 */
export async function getLatestLocation(userId: string): Promise<Location | null> {
    const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    return data;
}

/**
 * Get latest locations for all family members
 */
export async function getFamilyLocations(memberIds: string[]): Promise<Record<string, Location>> {
    const locations: Record<string, Location> = {};

    // Get latest location for each member
    for (const memberId of memberIds) {
        const { data } = await supabase
            .from('locations')
            .select('*')
            .eq('user_id', memberId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data) {
            locations[memberId] = data;
        }
    }

    return locations;
}

/**
 * Start watching user's location and sending updates
 */
export function startLocationTracking(
    userId: string,
    onUpdate?: (position: GeolocationPosition) => void,
    intervalMs: number = 30000
): { stop: () => void } {
    if (!navigator.geolocation) {
        console.error('Geolocation not supported');
        return { stop: () => { } };
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            updateLocation(userId, position);
            onUpdate?.(position);
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true }
    );

    // Watch for changes
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            updateLocation(userId, position);
            onUpdate?.(position);
        },
        (error) => console.error('Location watch error:', error),
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: intervalMs
        }
    );

    return {
        stop: () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        }
    };
}

/**
 * Subscribe to realtime location updates for family members
 */
export function subscribeToFamilyLocations(
    memberIds: string[],
    onLocationUpdate: (userId: string, location: Location) => void
): { unsubscribe: () => void } {
    // Subscribe to realtime changes
    realtimeSubscription = supabase
        .channel('family-locations')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'locations',
                filter: `user_id=in.(${memberIds.join(',')})`,
            },
            (payload: any) => {
                const location = payload.new as Location;
                onLocationUpdate(location.user_id, location);
            }
        )
        .subscribe();

    return {
        unsubscribe: () => {
            realtimeSubscription?.unsubscribe();
            realtimeSubscription = null;
        }
    };
}

/**
 * Get location history for a user
 */
export async function getLocationHistory(
    userId: string,
    startDate: Date,
    endDate: Date = new Date()
): Promise<Location[]> {
    const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

    return data || [];
}

// ============ Geofencing & Safe Zones ============

export interface SafeZone {
    id: string;
    family_id: string;
    name: string;
    lat: number;
    lng: number;
    radius: number;
}

/**
 * Get safe zones for a family
 */
export async function getSafeZones(familyId: string): Promise<SafeZone[]> {
    const { data } = await supabase
        .from('safe_zones')
        .select('*')
        .eq('family_id', familyId);
    return data || [];
}

/**
 * Check if user is inside any safe zone and trigger notifications if status changes
 * (Simplified for client-side check, ideally backend handles this)
 */
const userZoneState: Record<string, string | null> = {}; // userId -> lastZoneId

export async function checkGeofence(
    userId: string,
    lat: number,
    lng: number,
    zones: SafeZone[]
): Promise<void> {
    for (const zone of zones) {
        const distance = calculateDistance(lat, lng, zone.lat, zone.lng);
        const isInside = distance <= zone.radius;

        // Simple state tracking to prevent duplicate alerts
        // In production, this state should ideally be in the DB or persistent store
        const lastZone = userZoneState[userId];

        if (isInside && lastZone !== zone.id) {
            // ENTERED ZONE
            console.log(`User ${userId} entered safe zone: ${zone.name}`);
            userZoneState[userId] = zone.id;

            // 1. Update Stats
            await updateFamilyStats(zone.family_id, 'safe_arrival');

            // 2. Send Notification
            // We use the existing SOS notification function or a generic push function
            // For now, we'll invoke the 'send-sos-notifications' with a specific config for Safe Zone
            // OR better, just log it as the user specifically asked for "Avisos automáticos"
            const { error } = await supabase.functions.invoke('send-sos-notifications', {
                body: {
                    alertId: 'safe-zone-' + Date.now(), // Dummy ID
                    groupId: zone.family_id,
                    config: {
                        message: `📍 ${zone.name}: Un familiar ha llegado a salvo.`,
                        notifyContacts: true
                    }
                }
            });

            if (error) console.error("Error sending safe zone alert", error);

        } else if (!isInside && lastZone === zone.id) {
            // LEFT ZONE
            console.log(`User ${userId} left safe zone: ${zone.name}`);
            userZoneState[userId] = null;

            // Send departure notification
            const { error } = await supabase.functions.invoke('send-sos-notifications', {
                body: {
                    alertId: 'safe-zone-leave-' + Date.now(),
                    groupId: zone.family_id,
                    config: {
                        message: `🚶 ${zone.name}: Un familiar ha salido de esta zona segura.`,
                        notifyContacts: true
                    }
                }
            });

            if (error) console.error("Error sending safe zone departure alert", error);
        }
    }
}

async function updateFamilyStats(familyId: string, type: 'safe_arrival' | 'risk_alert') {
    // Get current week start
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];

    // Optimistic / Simple increment
    // In real app, use an RPC function to increment atomically
    const { data: stats } = await (supabase.from('family_stats') as any)
        .select('*')
        .eq('family_id', familyId)
        .eq('week_start_date', monday)
        .single();

    if (stats) {
        await (supabase.from('family_stats') as any)
            .update({
                safe_arrivals_count: type === 'safe_arrival' ? stats.safe_arrivals_count + 1 : stats.safe_arrivals_count,
                risk_alerts_count: type === 'risk_alert' ? stats.risk_alerts_count + 1 : stats.risk_alerts_count
            })
            .eq('id', stats.id);
    } else {
        // Create first record for this week
        await (supabase.from('family_stats') as any).insert({
            family_id: familyId,
            week_start_date: monday,
            safe_arrivals_count: type === 'safe_arrival' ? 1 : 0,
            risk_alerts_count: type === 'risk_alert' ? 1 : 0
        });
    }
}

// ============ Danger Zones & Parental Alerts ============

const userDangerZoneState: Record<string, string | null> = {};

export async function checkDangerZones(
    userId: string,
    lat: number,
    lng: number
): Promise<void> {
    // Fetch danger zones (in real app, user would cache this according to viewport)
    // For now we get all (assuming small number)
    const { data } = await (supabase
        .from('danger_zones') as any)
        .select('*');

    const zones = data as DangerZone[] | null;

    if (!zones) return;

    for (const zone of zones) {
        const distance = calculateDistance(lat, lng, zone.lat, zone.lng);
        const isInside = distance <= zone.radius;
        const lastZone = userDangerZoneState[userId];

        if (isInside && lastZone !== zone.id) {
            console.log(`User ${userId} entered DANGER zone: ${zone.type}`);
            userDangerZoneState[userId] = zone.id;

            // Trigger Parental Alert (Risk)
            const { data: membership } = await (supabase.from('family_members') as any).select('group_id').eq('user_id', userId).single();
            if (membership) {
                await updateFamilyStats(membership.group_id, 'risk_alert');

                // Send Notification to Parents
                await supabase.functions.invoke('send-sos-notifications', {
                    body: {
                        alertId: 'risk-' + Date.now(),
                        groupId: membership.group_id,
                        config: {
                            message: `⚠️ ALERTA DE RIESGO: Un familiar ha entrado en una zona peligrosa (${zone.type}).`,
                            notifyContacts: true
                        }
                    }
                });
            }

        } else if (!isInside && lastZone === zone.id) {
            userDangerZoneState[userId] = null;
        }
    }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
