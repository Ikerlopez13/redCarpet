import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials not found. Using mock mode.');
}

import { CapacitorStorage } from './capacitorStorage';

export const supabase = createClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            storage: CapacitorStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false, // We handle deep links manually
        }
    }
);

// Check if we're in mock mode (no real Supabase connection)
export const isMockMode = !supabaseUrl || !supabaseAnonKey;
