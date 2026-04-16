import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from './supabaseClient';

/**
 * Initialize push notifications
 */
export async function initPushNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Request permission
        const { receive } = await FirebaseMessaging.requestPermissions();

        if (receive !== 'granted') {
            return { success: false, error: 'Permission not granted' };
        }

        // Get the FCM token and save it
        const { token } = await FirebaseMessaging.getToken();
        if (token) {
            console.log('📱 FCM Push token:', token);
            await savePushToken(userId, token);
        }

        // Listen for token updates
        FirebaseMessaging.addListener('tokenReceived', async (event) => {
            console.log('📱 New FCM Push token:', event.token);
            await savePushToken(userId, event.token);
        });

        // Listen for notifications received while app is in foreground
        FirebaseMessaging.addListener('notificationReceived', (event) => {
            console.log('📩 Push received:', event.notification);
            handleForegroundNotification(event.notification);
        });

        // Listen for notification tap (app opened from notification)
        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            console.log('👆 Push action:', event.actionId);
            handleNotificationAction(event);
        });

        return { success: true };
    } catch (error) {
        console.error('Push init error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Save push token to database
 */
async function savePushToken(userId: string, token: string): Promise<void> {
    try {
        console.log('💾 Saving push token to Supabase:', token);

        const { error } = await (supabase.from('push_tokens') as any).upsert({
            user_id: userId,
            token,
            platform: getPlatform(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'token,user_id' }); // Ensure we don't duplicate based on PK

        if (error) {
            console.error('Error saving push token to DB:', error);
            // Fallback: still log it
        }
    } catch (error) {
        console.error('Exception saving push token:', error);
    }
}

/**
 * Handle notification received in foreground
 */
function handleForegroundNotification(notification: any): void {
    const { title, body, data } = notification;

    // Show in-app notification
    if (data?.type === 'sos') {
        // High priority - SOS alert
        showInAppAlert({
            type: 'sos',
            title: title || '🚨 Alerta SOS',
            body: body || 'Un miembro de tu familia necesita ayuda',
            data,
        });
    } else {
        // Normal notification
        showInAppAlert({
            type: 'info',
            title,
            body,
            data,
        });
    }
}

/**
 * Handle notification action (tap)
 */
function handleNotificationAction(event: any): void {
    const { notification } = event;
    const data = notification.data;

    if (data?.type === 'sos' && data?.alertId) {
        // Navigate to SOS screen
        window.location.href = `/emergency?alertId=${data.alertId}`;
    } else if (data?.type === 'location' && data?.userId) {
        // Navigate to map centered on user
        window.location.href = `/?focusUser=${data.userId}`;
    }
}

/**
 * Show in-app notification (custom UI)
 */
function showInAppAlert(alert: { type: string; title: string; body: string; data?: any }): void {
    // This would trigger a toast/notification component
    const event = new CustomEvent('in-app-notification', { detail: alert });
    window.dispatchEvent(event);
}

/**
 * Get current platform
 */
function getPlatform(): 'ios' | 'android' | 'web' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'web';
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    return 'PushNotifications' in window || 'Notification' in window;
}

/**
 * Get current push permission status
 */
export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
        const { receive } = await FirebaseMessaging.checkPermissions();
        return receive as 'granted' | 'denied' | 'prompt';
    } catch {
        // Fallback for web
        if ('Notification' in window) {
            return Notification.permission as 'granted' | 'denied' | 'prompt';
        }
        return 'denied';
    }
}
