import { supabase, isMockMode } from './supabaseClient';

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
    if (isMockMode) {
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
    if (isMockMode) {
        return;
    }

    await supabase.auth.signOut();
}

/**
 * Get current session
 */
export async function getCurrentSession() {
    if (isMockMode) {
        return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
    if (isMockMode) {
        return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
    if (isMockMode) {
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
    if (isMockMode) {
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
    if (isMockMode) {
        return { error: 'Google sign-in not available in mock mode' };
    }

    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        return { error: error?.message || null };
    } catch (error: any) {
        return { error: error.message || 'Error al iniciar sesión con Google' };
    }
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: 'Apple sign-in not available in mock mode' };
    }

    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
        });
        return { error: error?.message || null };
    } catch (error: any) {
        return { error: error.message || 'Error al iniciar sesión con Apple' };
    }
}

/**
 * Sign in as demo user
 */
export async function signInAsDemo(): Promise<{ user: AuthUser }> {
    const demoUser: AuthUser = {
        id: 'demo-user',
        email: 'demo@redcarpet.app',
        profile: {
            full_name: 'Usuario Demo',
        },
    };

    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('mock_user', JSON.stringify(demoUser));

    return { user: demoUser };
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(file: File): Promise<{ error: string | null }> {
    if (isMockMode) {
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

