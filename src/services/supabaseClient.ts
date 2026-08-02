import { createClient } from '@supabase/supabase-js';
import { CapacitorStorage } from './capacitorStorage';

// Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Mock mode logic: True if credentials missing OR if demo mode is explicitly enabled in localStorage
export const getIsMockMode = () => {
    return !supabaseUrl || !supabaseAnonKey || localStorage.getItem('redcarpet_demo_mode') === 'true';
};

/**
 * PROXY-BASED MOCK SYSTEM
 * This creates a "safe" version of Supabase that never crashes on missing methods.
 * It's chainable and returns a Promise-like 'then' for awaits.
 */
const createRecursiveMock = (defaultData: any = null): any => {
    // This function will be the base for our proxy
    const target = () => proxy;
    
    const proxy: any = new Proxy(target, {
        get: (t, prop) => {
            // Handle standard Promise 'then' for awaits
            if (prop === 'then') {
                return (resolve: any) => resolve({ data: defaultData, error: null });
            }
            
            // Special cases for common property access
            if (prop === 'publicUrl') return '';
            if (prop === 'subscription') return { unsubscribe: () => {} };
            if (prop === 'user' || prop === 'session') return null;

            // Otherwise, return another proxy for chaining
            return proxy;
        },
        apply: (t, thisArg, args) => {
            // If the mock is called as a function (e.g., from('table')), return the proxy
            return proxy;
        }
    });
    
    return proxy;
};

// Mock implementation using the recursive proxy
const mockSupabase = {
    auth: {
        getSession: async () => {
            const userStr = localStorage.getItem('mock_user');
            const user = userStr ? JSON.parse(userStr) : null;
            return { data: { session: user ? { user } : null }, error: null };
        },
        getUser: async () => {
            const userStr = localStorage.getItem('mock_user');
            const user = userStr ? JSON.parse(userStr) : null;
            return { data: { user }, error: null };
        },
        onAuthStateChange: (callback: any) => {
            const userStr = localStorage.getItem('mock_user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user) callback('SIGNED_IN', { user });
            return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithPassword: async () => ({ data: { user: null }, error: new Error('Mock mode') }),
        signUp: async () => ({ data: { user: null }, error: new Error('Mock mode') }),
        signOut: async () => {
            localStorage.removeItem('mock_user');
            localStorage.removeItem('redcarpet_demo_mode');
            return { error: null };
        },
        resetPasswordForEmail: async () => ({ error: null }),
        updateUser: async () => ({ data: { user: null }, error: null }),
        signInWithOAuth: async () => ({ data: { provider: 'google', url: '' }, error: null }),
    },
    from: (table: string) => {
        // Return empty arrays for common list tables, null for others
        const defaultData = ['danger_zones', 'family_members', 'sos_alerts', 'locations', 'trusted_contacts', 'pending_contact_requests'].includes(table) ? [] : null;
        return createRecursiveMock(defaultData);
    },
    channel: () => createRecursiveMock(),
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: null }),
    functions: {
        invoke: async () => ({ data: null, error: null })
    },
    storage: {
        from: () => createRecursiveMock()
    }
};

// Initialize real client once
let realSupabase: any = null;
try {
    realSupabase = (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) 
        ? null 
        : createClient(supabaseUrl, supabaseAnonKey, {
              auth: {
                  storage: CapacitorStorage,
                  autoRefreshToken: true,
                  persistSession: true,
                  detectSessionInUrl: false,
              },
          });
} catch (err: any) {
    console.error("Supabase Client Initialization Error:", err);
}

// Export a proxy that switches between mock and real at runtime
export const supabase = new Proxy({} as any, {
    get: (_target, prop) => {
        const client = getIsMockMode() ? mockSupabase : realSupabase;
        if (!client) return (mockSupabase as any)[prop];
        return (client as any)[prop];
    }
});

