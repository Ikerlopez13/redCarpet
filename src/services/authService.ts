import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase, getIsMockMode } from './supabaseClient';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    error?: string;
    user?: any;
}

export interface AuthUser {
    id: string;
    email?: string;
    profile?: any;
    [key: string]: any;
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(
    credentials: LoginCredentials
): Promise<AuthResponse> {
    if (getIsMockMode()) {
        console.warn('⚠️ Supabase not configured - using mock auth');
        return {
            success: true,
            user: { email: credentials.email },
        };
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        return {
            success: true,
            user: data.user,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Error desconocido al iniciar sesión',
        };
    }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
    if (getIsMockMode()) {
        return;
    }

    await supabase.auth.signOut();
    localStorage.removeItem('redcarpet_demo_mode');
}

/**
 * Get current session
 */
export async function getCurrentSession() {
    if (getIsMockMode()) {
        return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
    if (getIsMockMode()) {
        return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
    if (getIsMockMode()) {
        return { data: { subscription: null }, unsubscribe: () => {} };
    }

    return supabase.auth.onAuthStateChange(callback);
}

/**
 * Sign in with email and password (alias for signInWithPassword)
 */
export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    const result = await signInWithPassword({ email, password });
    return {
        user: result.user as AuthUser | null,
        error: result.error || null,
    };
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, fullName: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (getIsMockMode()) {
        console.warn('⚠️ Supabase not configured - using mock auth');
        return {
            user: { id: 'mock', email, profile: { full_name: fullName } } as AuthUser,
            error: null,
        };
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            return { user: null, error: error.message };
        }

        return {
            user: data.user as AuthUser,
            error: null,
        };
    } catch (error: any) {
        return {
            user: null,
            error: error.message || 'Error desconocido al registrarse',
        };
    }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        console.warn('⚠️ Google Sign-In Mocked - Redirecting to Demo');
        localStorage.setItem('redcarpet_demo_mode', 'true');
        localStorage.setItem('mock_user', JSON.stringify({
            id: 'mock_google_id',
            email: 'google-user@example.com',
            profile: { full_name: 'Usuario Google (Mock)' }
        }));
        // Simulate a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 800));
        window.location.reload(); // Trigger AuthContext update
        return { error: null };
    }

    // Robust check for native app environment
    const isNative = Capacitor.isNativePlatform() ||
        Capacitor.getPlatform() === 'ios' ||
        Capacitor.getPlatform() === 'android' ||
        navigator.userAgent.includes('Capacitor');

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const shouldUseCustomScheme = isNative || (isLocalhost && (navigator.userAgent.includes('Capacitor') || isMobile));
    const redirectTo = shouldUseCustomScheme ? 'com.vibecode.redcarpet://login-callback' : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: isNative,
            queryParams: {
                access_type: 'offline',
                prompt: 'select_account',
            }
        }
    });

    if (error) {
        return { error: error.message };
    }

    if (data?.url) {
        await Browser.open({ url: data.url });
    }

    return { error: null };
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        console.warn('⚠️ Apple Sign-In Mocked - Redirecting to Demo');
        localStorage.setItem('redcarpet_demo_mode', 'true');
        localStorage.setItem('mock_user', JSON.stringify({
            id: 'mock_apple_id',
            email: 'apple-user@example.com',
            profile: { full_name: 'Usuario Apple (Mock)' }
        }));
        // Simulate a small delay
        await new Promise(resolve => setTimeout(resolve, 800));
        window.location.reload(); // Trigger AuthContext update
        return { error: null };
    }

    const isNative = Capacitor.isNativePlatform() ||
        Capacitor.getPlatform() === 'ios' ||
        Capacitor.getPlatform() === 'android' ||
        navigator.userAgent.includes('Capacitor');

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const shouldUseCustomScheme = isNative || (isLocalhost && (navigator.userAgent.includes('Capacitor') || isMobile));

    const redirectTo = shouldUseCustomScheme ? 'com.vibecode.redcarpet://login-callback' : window.location.origin;

    if (isNative) {
        try {
            const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

            const options = {
                clientId: 'com.vibecode.redcarpet',
                redirectURI: redirectTo,
                scopes: 'email name',
            };

            const result = await SignInWithApple.authorize(options);

            if (result.response && result.response.identityToken) {
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: result.response.identityToken,
                });

                if (error) return { error: error.message };

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
            skipBrowserRedirect: isNative,
        }
    });

    if (error) return { error: error.message };

    if (data?.url) {
        await Browser.open({ url: data.url });
    }

    return { error: null };
}

/**
 * Sign in as demo user
 */
export async function signInAsDemo(): Promise<{ user: AuthUser }> {
    const demoUser: AuthUser = {
        id: 'debug_user',
        email: 'demo@redcarpet.app',
        profile: {
            full_name: 'Usuario Demo',
        },
    };

    localStorage.setItem('redcarpet_demo_mode', 'true');
    localStorage.setItem('mock_user', JSON.stringify(demoUser));

    return { user: demoUser };
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(file: File): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        return { error: null };
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { error: 'Usuario no autenticado' };
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);
            
        if (uploadError) {
            if (uploadError.message.includes('Bucket not found')) {
                return { error: 'Error: El bucket "avatars" no existe en Supabase. Por favor, créalo y configúralo como Público.' };
            }
            return { error: uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update profile with avatar URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) {
            return { error: updateError.message };
        }

        return { error: null };
    } catch (error: any) {
        return { error: error.message || 'Error al subir el avatar' };
    }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        console.log('Mock password reset for:', email);
        return { error: null };
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        });
        return { error: error ? error.message : null };
    } catch (error: any) {
        return { error: error.message || 'Error al enviar el correo de recuperación' };
    }
}
