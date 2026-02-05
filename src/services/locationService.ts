import { supabase, isMockMode } from './supabaseClient';
import type { Location } from './database.types';

// Mock locations for family members
const mockLocations: Record<string, Location> = {
    'mock-user-456': {
        id: 'loc-1',
        user_id: 'mock-user-456',
        lat: 41.3851,
        lng: 2.1734,
        accuracy: 10,
        battery_level: 85,
        speed: 0,
        heading: null,
        created_at: new Date().toISOString(),
    },
    'mock-user-789': {
        id: 'loc-2',
        user_id: 'mock-user-789',
        lat: 41.3879,
        lng: 2.1699,
        accuracy: 15,
        battery_level: 42,
        speed: 5.2,
        heading: 180,
        created_at: new Date().toISOString(),
    }
};

let watchId: number | null = null;
let realtimeSubscription: ReturnType<typeof supabase.channel> | null = null;

/**
 * Update current user's location
 */
export async function updateLocation(
    userId: string,
    position: GeolocationPosition,
    batteryLevel?: number
): Promise<{ error: string | null }> {
    const location: Omit<Location, 'id' | 'created_at'> = {
        user_id: userId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        battery_level: batteryLevel || null,
        speed: position.coords.speed,
        heading: position.coords.heading,
    };

    if (isMockMode) {
        console.log('📍 Location updated (mock):', location);
        return { error: null };
    }

    const { error } = await supabase
        .from('locations')
        .insert(location);

    return { error: error?.message || null };
}

/**
 * Get latest location for a user
 */
export async function getLatestLocation(userId: string): Promise<Location | null> {
    if (isMockMode) {
        return mockLocations[userId] || null;
    }

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
    if (isMockMode) {
        return mockLocations;
    }

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
    if (isMockMode) {
        // Simulate realtime updates in mock mode
        const interval = setInterval(() => {
            // Randomly update mock locations slightly
            Object.entries(mockLocations).forEach(([userId, loc]) => {
                const updated = {
                    ...loc,
                    lat: loc.lat + (Math.random() - 0.5) * 0.001,
                    lng: loc.lng + (Math.random() - 0.5) * 0.001,
                    created_at: new Date().toISOString(),
                };
                mockLocations[userId] = updated;
                onLocationUpdate(userId, updated);
            });
        }, 10000);

        return { unsubscribe: () => clearInterval(interval) };
    }

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
            (payload) => {
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
    if (isMockMode) {
        return [mockLocations[userId]].filter(Boolean);
    }

    const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

    return data || [];
}
