import { PushNotifications } from '@capacitor/push-notifications';
import { supabase, isMockMode } from './supabaseClient';

/**
 * Initialize push notifications
 */
export async function initPushNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Request permission
        const permStatus = await PushNotifications.requestPermissions();

        if (permStatus.receive !== 'granted') {
            return { success: false, error: 'Permission not granted' };
        }

        // Register for push
        await PushNotifications.register();

        // Listen for registration
        PushNotifications.addListener('registration', async (token) => {
            console.log('📱 Push token:', token.value);
            await savePushToken(userId, token.value);
        });

        // Listen for errors
        PushNotifications.addListener('registrationError', (error) => {
            console.error('Push registration error:', error);
        });

        // Listen for notifications received while app is in foreground
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('📩 Push received:', notification);
            handleForegroundNotification(notification);
        });

        // Listen for notification tap (app opened from notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('👆 Push action:', action);
            handleNotificationAction(action);
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
    if (isMockMode) {
        console.log('💾 Push token saved (mock):', token);
        localStorage.setItem('push_token', token);
        return;
    }

    // In production, save to a push_tokens table
    await supabase.from('push_tokens' as any).upsert({
        user_id: userId,
        token,
        platform: getPlatform(),
        updated_at: new Date().toISOString(),
    });
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
function handleNotificationAction(action: any): void {
    const { notification } = action;
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
        const status = await PushNotifications.checkPermissions();
        return status.receive;
    } catch {
        // Fallback for web
        if ('Notification' in window) {
            return Notification.permission as 'granted' | 'denied' | 'prompt';
        }
        return 'denied';
    }
}
