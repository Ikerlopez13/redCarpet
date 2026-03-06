import { Capacitor } from '@capacitor/core';
import { supabase, isMockMode } from './supabaseClient';
import type { Profile, Subscription } from './database.types';

declare global {
    interface Window {
        Capacitor: any;
    }
}

export interface AuthUser {
    id: string;
    email: string;
    profile?: Profile;
    subscription?: Subscription;
}

// Mock user for development
const mockUser: AuthUser = {
    id: 'mock-user-123',
    email: 'demo@redcarpet.app',
    profile: {
        id: 'mock-user-123',
        full_name: 'Alejandro García',
        avatar_url: 'https://ui-avatars.com/api/?name=Alejandro+Garcia&background=0D8ABC&color=fff',
        phone: '+34 612 345 678',
        created_at: new Date().toISOString(),
    },
    subscription: undefined // Default to free for mock user, or set to a mock subscription object to test premium
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

    // Fetch profile and subscription in parallel
    const [profileResult, subscriptionResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
        supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['active', 'trial'])
            .maybeSingle()
    ]);

    const profile = profileResult.data;
    const subscription = subscriptionResult.data;

    return {
        id: user.id,
        email: user.email || '',
        profile: profile || undefined,
        subscription: subscription || undefined,
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
        await (supabase.from('profiles') as any).insert({
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

    const { error } = await supabase.auth.signInWithPassword({
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
            avatar_url: 'https://ui-avatars.com/api/?name=Usuario+Demo&background=random&color=fff',
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
import { Browser } from '@capacitor/browser';

// ... (keep previous lines)

export async function signInWithGoogle(): Promise<{ error: string | null }> {
    if (isMockMode) {
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        return { error: null };
    }

    // Robust check for native app environment
    const isNative = Capacitor.isNativePlatform() ||
        Capacitor.getPlatform() === 'ios' ||
        Capacitor.getPlatform() === 'android' ||
        !!window.Capacitor?.isNativePlatform() ||
        navigator.userAgent.includes('Capacitor');

    // If running on localhost/127.0.0.1 (common in simulator live reload), treat as native if Capacitor is present
    // OR if we detect a mobile user agent (simulators often look like mobile safari)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // DECISION: If we are native OR (localhost AND (Capacitor or Mobile Device)), use custom scheme
    const shouldUseCustomScheme = isNative || (isLocalhost && (!!window.Capacitor || navigator.userAgent.includes('Capacitor') || isMobile));

    const redirectTo = shouldUseCustomScheme ? 'com.redcarpet.app://login-callback' : window.location.origin;

    console.log('Google Sign-In: detected platform', isNative ? 'native' : 'web', 'redirectTo:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: true, // Generate URL instead of redirecting
            queryParams: {
                access_type: 'offline',
                prompt: 'select_account', // Force account selection
            }
        }
    });

    if (error) {
        return { error: error.message };
    }

    if (data?.url) {
        // Open the auth URL in an in-app browser (SFSafariViewController on iOS)
        await Browser.open({ url: data.url });
    }

    return { error: null };
}

/**
 * Sign in with Apple (required natively for iOS)
 */
export async function signInWithApple(): Promise<{ error: string | null }> {
    if (isMockMode) {
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        return { error: null };
    }

    // Robust check for native app environment
    const isNative = Capacitor.isNativePlatform() ||
        Capacitor.getPlatform() === 'ios' ||
        Capacitor.getPlatform() === 'android' ||
        !!window.Capacitor?.isNativePlatform() ||
        navigator.userAgent.includes('Capacitor');

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const shouldUseCustomScheme = isNative || (isLocalhost && (!!window.Capacitor || navigator.userAgent.includes('Capacitor') || isMobile));

    const redirectTo = shouldUseCustomScheme ? 'com.redcarpet.app://login-callback' : window.location.origin;

    console.log('Apple Sign-In: detected platform', isNative ? 'native' : 'web', 'redirectTo:', redirectTo);

    if (isNative) {
        try {
            const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

            // We use standard options for Apple Sign In via native UI
            const options = {
                clientId: 'com.vibecode.redcarpet', // Make sure this matches your Services ID in Supabase
                redirectURI: redirectTo,
                scopes: 'email name',
            };

            const result = await SignInWithApple.authorize(options);

            if (result.response && result.response.identityToken) {
                // Pass the identityToken back to Supabase
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: result.response.identityToken,
                });

                if (error) return { error: error.message };

                // On first sign in, Apple provides the user's name
                if (result.response.givenName || result.response.familyName) {
                    const fullName = [result.response.givenName, result.response.familyName].filter(Boolean).join(' ');
                    await supabase.auth.updateUser({
                        data: {
                            full_name: fullName,
                            given_name: result.response.givenName,
                            family_name: result.response.familyName,
                        }
                    });
                }

                return { error: null };
            } else {
                return { error: 'No se recibió autenticación de Apple.' };
            }
        } catch (error: any) {
            console.error('Apple Sign-In native error:', error);
            // Don't show confusing technical errors if the user just cancelled
            if (error?.message?.includes('canceled') || error?.message?.includes('cancelado')) {
                return { error: 'Inicio de sesión cancelado.' };
            }
            return { error: error.message || 'Error en Apple Sign-In.' };
        }
    }

    // Fallback to web OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
            redirectTo,
            skipBrowserRedirect: true,
        }
    });

    if (error) return { error: error.message };

    if (data?.url) {
        await Browser.open({ url: data.url });
    }

    return { error: null };
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

    const { error } = await (supabase.from('profiles') as any)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            const user = await getCurrentUser();
            callback(user);
        } else {
            callback(null);
        }
    });

    return () => subscription.unsubscribe();
}

/**
 * Upload avatar
 */
export async function uploadAvatar(file: File): Promise<{ url: string | null; error: string | null }> {
    if (isMockMode) {
        // Convert to base64 for mock mode
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Update local user
                const currentUser = JSON.parse(localStorage.getItem('mock_user') || '{}');
                if (currentUser.profile) {
                    currentUser.profile.avatar_url = base64String;
                    localStorage.setItem('mock_user', JSON.stringify(currentUser));
                }
                resolve({ url: base64String, error: null });
            };
            reader.readAsDataURL(file);
        });
    }

    const start = Date.now(); // Unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${start}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

    if (uploadError) {
        return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    // Update profile
    const { error: updateError } = await updateProfile({ avatar_url: data.publicUrl });

    if (updateError) {
        return { url: null, error: updateError };
    }

    return { url: data.publicUrl, error: null };
}
