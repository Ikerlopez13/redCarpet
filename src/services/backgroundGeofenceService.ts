import { registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { supabase } from './supabaseClient';
import { getSafeZones, updateLocation, checkDangerZones, checkGeofence } from './locationService';

// Initialize the plugin
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export class BackgroundGeofenceService {
    static isTracking = false;
    static watcherId: string | null = null;

    /**
     * Start background location tracking and geofencing.
     * This will aggressively track the user even when the app is closed.
     */
    static async startTracking(userId: string) {
        if (this.isTracking) return;

        try {
            // Get family ID directly
            const { data: membership } = await (supabase
                .from('family_members') as any)
                .select('group_id')
                .eq('user_id', userId)
                .maybeSingle();

            const familyId = membership?.group_id;

            // First, get the safe zones to monitor (if they have a family)
            const safeZones = familyId ? await getSafeZones(familyId) : [];

            this.watcherId = await BackgroundGeolocation.addWatcher(
                {
                    backgroundMessage: "Cancel para evitar que la app consuma batería.",
                    backgroundTitle: "Rastreo de seguridad activo",
                    requestPermissions: true,
                    stale: false,
                    distanceFilter: 50 // Report every 50 meters
                },
                async (location: any, error: any) => {
                    if (error) {
                        if (error.code === "NOT_AUTHORIZED") {
                            console.error("User denied location permissions");
                            // Fallback logic here if needed
                        }
                        return;
                    }

                    if (!location) return;

                    // 1. Save to Supabase
                    const position = {
                        coords: {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            accuracy: location.accuracy || 0,
                            altitude: location.altitude || null,
                            altitudeAccuracy: location.altitudeAccuracy || null,
                            heading: location.bearing || null,
                            speed: location.speed || null
                        } as GeolocationCoordinates,
                        timestamp: location.time || Date.now(),
                        toJSON: () => { }
                    } as GeolocationPosition;

                    await updateLocation(userId, position);

                    // 2. Check Danger Zones
                    await checkDangerZones(userId, location.latitude, location.longitude);

                    // 3. Check Safe Zones (Geofencing) 
                    await checkGeofence(userId, location.latitude, location.longitude, safeZones);
                }
            );

            this.isTracking = true;
            console.log("Background Geolocation started. Watcher ID:", this.watcherId);
        } catch (error) {
            console.error("Failed to start Background Geolocation:", error);
        }
    }

    static async stopTracking() {
        if (!this.isTracking || !this.watcherId) return;

        try {
            await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
            this.watcherId = null;
            this.isTracking = false;
            console.log("Background Geolocation stopped.");
        } catch (error) {
            console.error("Failed to stop Background Geolocation:", error);
        }
    }
}
