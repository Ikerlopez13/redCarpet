import { supabase, isMockMode } from './supabaseClient';
import type { Profile } from './database.types';

export interface AuthUser {
    id: string;
    email: string;
    profile?: Profile;
}

// Mock user for development
const mockUser: AuthUser = {
    id: 'mock-user-123',
    email: 'demo@redcarpet.app',
    profile: {
        id: 'mock-user-123',
        full_name: 'Alejandro García',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=260',
        phone: '+34 612 345 678',
        created_at: new Date().toISOString(),
    }
};

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    if (isMockMode) {
        // Return mock user in development
        const savedUser = localStorage.getItem('mock_user');
        return savedUser ? JSON.parse(savedUser) : null;
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return {
        id: user.id,
        email: user.email || '',
        profile: profile || undefined,
    };
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, fullName: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (isMockMode) {
        const user = { ...mockUser, email, profile: { ...mockUser.profile!, full_name: fullName } };
        localStorage.setItem('mock_user', JSON.stringify(user));
        return { user, error: null };
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName }
        }
    });

    if (error) return { user: null, error: error.message };

    // Create profile
    if (data.user) {
        await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
        });
    }

    return {
        user: data.user ? { id: data.user.id, email: data.user.email || '' } : null,
        error: null
    };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (isMockMode) {
        const user = { ...mockUser, email };
        localStorage.setItem('mock_user', JSON.stringify(user));
        return { user, error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return { user: null, error: error.message };

    const currentUser = await getCurrentUser();
    return { user: currentUser, error: null };
}

/**
 * Sign in as demo user (always uses mock, never touches Supabase)
 * Useful for demonstrations without real authentication
 */
export async function signInAsDemo(): Promise<{ user: AuthUser; error: null }> {
    const demoUser: AuthUser = {
        id: 'demo-user-' + Date.now(),
        email: 'demo@redcarpet.app',
        profile: {
            id: 'demo-user-' + Date.now(),
            full_name: 'Usuario Demo',
            avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=260',
            phone: '+34 600 000 000',
            created_at: new Date().toISOString(),
        }
    };
    localStorage.setItem('mock_user', JSON.stringify(demoUser));
    localStorage.setItem('demo_mode', 'true');
    return { user: demoUser, error: null };
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
    if (isMockMode) {
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        return { error: null };
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        }
    });

    return { error: error?.message || null };
}

/**
 * Sign in with Apple (required for iOS)
 */
export async function signInWithApple(): Promise<{ error: string | null }> {
    if (isMockMode) {
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        return { error: null };
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
            redirectTo: window.location.origin,
        }
    });

    return { error: error?.message || null };
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
    if (isMockMode) {
        localStorage.removeItem('mock_user');
        return;
    }

    await supabase.auth.signOut();
}

/**
 * Update user profile
 */
export async function updateProfile(updates: Partial<Profile>): Promise<{ error: string | null }> {
    if (isMockMode) {
        const currentUser = JSON.parse(localStorage.getItem('mock_user') || '{}');
        currentUser.profile = { ...currentUser.profile, ...updates };
        localStorage.setItem('mock_user', JSON.stringify(currentUser));
        return { error: null };
    }

    const user = await getCurrentUser();
    if (!user) return { error: 'No authenticated user' };

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

    return { error: error?.message || null };
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: null };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });

    return { error: error?.message || null };
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (isMockMode) {
        // Check mock user on mount
        const savedUser = localStorage.getItem('mock_user');
        callback(savedUser ? JSON.parse(savedUser) : null);

        // Listen to storage changes (for multi-tab support)
        const handleStorage = () => {
            const user = localStorage.getItem('mock_user');
            callback(user ? JSON.parse(user) : null);
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            const user = await getCurrentUser();
            callback(user);
        } else {
            callback(null);
        }
    });

    return () => subscription.unsubscribe();
}
