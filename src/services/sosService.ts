import { supabase, isMockMode } from './supabaseClient';
import type { SOSAlert, EmergencyContact } from './database.types';

interface SOSConfig {
    message: string;
    callPolice: boolean;
    notifyContacts: boolean;
    shareLocation: boolean;
}

/**
 * Activate SOS alert
 */
export async function activateSOS(
    userId: string,
    groupId: string,
    config: SOSConfig
): Promise<{ alert: SOSAlert | null; error: string | null }> {
    // Get current location
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
        });
    }).catch(() => null);

    const alertData: Omit<SOSAlert, 'id' | 'created_at'> = {
        user_id: userId,
        group_id: groupId,
        lat: position?.coords.latitude || null,
        lng: position?.coords.longitude || null,
        status: 'active',
        message: config.message,
    };

    if (isMockMode) {
        const alert: SOSAlert = {
            ...alertData,
            id: `sos-${Date.now()}`,
            created_at: new Date().toISOString(),
        };

        console.log('🚨 SOS ACTIVATED (mock):', alert);

        // Simulate notification
        if (Notification.permission === 'granted') {
            new Notification('🚨 SOS Alert!', {
                body: `${config.message}\nLocation shared: ${config.shareLocation}`,
                icon: '/icons/sos.png',
            });
        }

        return { alert, error: null };
    }

    // Create alert in database
    const { data: alert, error } = await supabase
        .from('sos_alerts')
        .insert(alertData as any)
        .select()
        .single();

    if (error) return { alert: null, error: error.message };

    // Trigger notifications via Edge Function
    await supabase.functions.invoke('send-sos-notifications', {
        body: {
            alertId: alert.id,
            userId,
            groupId,
            config,
        }
    });

    // Call emergency services if configured
    if (config.callPolice) {
        // This would integrate with native calling capability
        console.log('📞 Calling emergency services...');
        // window.location.href = 'tel:112';
    }

    return { alert, error: null };
}

/**
 * Cancel/resolve SOS alert
 */
export async function resolveSOS(
    alertId: string,
    status: 'resolved' | 'cancelled' = 'resolved'
): Promise<{ error: string | null }> {
    if (isMockMode) {
        console.log(`✅ SOS ${status}:`, alertId);
        return { error: null };
    }

    const { error } = await supabase
        .from('sos_alerts')
        .update({ status } as any)
        .eq('id', alertId);

    return { error: error?.message || null };
}

/**
 * Get active SOS alerts for a group
 */
export async function getActiveAlerts(groupId: string): Promise<SOSAlert[]> {
    if (isMockMode) {
        return [];
    }

    const { data } = await supabase
        .from('sos_alerts')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    return data || [];
}

/**
 * Subscribe to SOS alerts for a group (realtime)
 */
export function subscribeToSOSAlerts(
    groupId: string,
    onAlert: (alert: SOSAlert) => void
): { unsubscribe: () => void } {
    if (isMockMode) {
        // No mock realtime for SOS
        return { unsubscribe: () => { } };
    }

    const subscription = supabase
        .channel('sos-alerts')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'sos_alerts',
                filter: `group_id=eq.${groupId}`,
            },
            (payload) => {
                onAlert(payload.new as SOSAlert);
            }
        )
        .subscribe();

    return {
        unsubscribe: () => subscription.unsubscribe()
    };
}

// ============ Emergency Contacts ============

/**
 * Get emergency contacts for a user
 */
export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    if (isMockMode) {
        return [
            {
                id: 'contact-1',
                user_id: userId,
                name: 'Ana García',
                phone: '+34 612 345 680',
                relationship: 'Hermana',
                notify_on_sos: true,
                created_at: new Date().toISOString(),
            },
            {
                id: 'contact-2',
                user_id: userId,
                name: 'Pedro Martínez',
                phone: '+34 612 345 681',
                relationship: 'Amigo',
                notify_on_sos: true,
                created_at: new Date().toISOString(),
            }
        ];
    }

    const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    return data || [];
}

/**
 * Add emergency contact
 */
export async function addEmergencyContact(
    userId: string,
    contact: Omit<EmergencyContact, 'id' | 'user_id' | 'created_at'>
): Promise<{ contact: EmergencyContact | null; error: string | null }> {
    if (isMockMode) {
        const newContact: EmergencyContact = {
            ...contact,
            id: `contact-${Date.now()}`,
            user_id: userId,
            created_at: new Date().toISOString(),
        };
        return { contact: newContact, error: null };
    }

    const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({ ...contact, user_id: userId } as any)
        .select()
        .single();

    return { contact: data, error: error?.message || null };
}

/**
 * Remove emergency contact
 */
export async function removeEmergencyContact(contactId: string): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: null };
    }

    const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId);

    return { error: error?.message || null };
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}
