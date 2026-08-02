import { Preferences } from '@capacitor/preferences';

/**
 * Custom storage adapter for Supabase to use Capacitor Preferences.
 * This ensures robust, async storage on iOS/Android where localStorage can be unreliable.
 */
export const CapacitorStorage = {
    async getItem(key: string): Promise<string | null> {
        console.log(`[Storage] SDK requesting getItem: "${key}"`);
        const { value } = await Preferences.get({ key });
        console.log(`[Storage] SDK read "${key}":`, value ? `Found (length ${value.length})` : 'NULL');
        return value;
    },
    async setItem(key: string, value: string): Promise<void> {
        console.log(`[Storage] SDK setItem: "${key}"`);
        await Preferences.set({ key, value });
        console.log(`[Storage] SDK wrote "${key}"`);
    },
    async removeItem(key: string): Promise<void> {
        console.log(`[Storage] SDK removeItem: "${key}"`);
        await Preferences.remove({ key });
        console.log(`[Storage] SDK removed "${key}"`);
    },
};
