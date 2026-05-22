import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Helper to compare semantic versions (e.g., '3.0.1' vs '3.0.0')
function isNewerVersion(storeVersion: string, localVersion: string): boolean {
    const storeParts = storeVersion.split('.').map(Number);
    const localParts = localVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(storeParts.length, localParts.length); i++) {
        const s = storeParts[i] || 0;
        const l = localParts[i] || 0;
        if (s > l) return true;
        if (s < l) return false;
    }
    return false;
}

export async function checkUpdateRequired(): Promise<{ required: boolean; storeUrl?: string }> {
    if (Capacitor.getPlatform() === 'web') {
        return { required: false }; // Web doesn't need store updates
    }

    try {
        const info = await App.getInfo();
        const localVersion = info.version;
        const bundleId = info.id; // e.g., com.vibecode.redcarpet

        if (Capacitor.getPlatform() === 'ios') {
            // Check App Store
            const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${bundleId}`);
            const data = await response.json();

            if (data.resultCount > 0) {
                const storeVersion = data.results[0].version;
                const storeUrl = data.results[0].trackViewUrl;

                if (isNewerVersion(storeVersion, localVersion)) {
                    return { required: true, storeUrl };
                }
            }
        } else if (Capacitor.getPlatform() === 'android') {
            // Android checking could be done via a custom API or we can just return false for now 
            // since Google Play In-App Updates requires native plugins. 
            // We'll leave it returning false until we implement a Supabase fallback for Android.
            return { required: false };
        }

        return { required: false };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { required: false }; // Fail open: if we can't check, let them in
    }
}
