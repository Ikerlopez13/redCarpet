import { createClient } from '@supabase/supabase-js';
import { CapacitorStorage } from './capacitorStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Mock mode flag (useful for development/testing)
export const isMockMode = !supabaseUrl || !supabaseAnonKey;

export const supabase = isMockMode
    ? ({} as any) // Mock client when credentials are missing
    : createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
              storage: CapacitorStorage,
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: false,
          },
      });

