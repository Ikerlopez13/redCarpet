import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { RevenueCatService } from '../services/revenueCatService';
import { BackgroundGeofenceService } from '../services/backgroundGeofenceService';
import {
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithApple,
    signInAsDemo,
    type AuthUser
} from '../services/authService';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isPremium: boolean;
    login: (email: string, password: string) => Promise<{ error: string | null }>;
    register: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
    loginWithGoogle: () => Promise<{ error: string | null }>;
    loginWithApple: () => Promise<{ error: string | null }>;
    loginAsDemo: () => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: string | null }>;
    setIsPremium: (value: boolean) => void;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    const updatePremiumStatus = async (currentUser: AuthUser | null): Promise<boolean> => {
        if (!currentUser) {
            setIsPremium(false);
            return false;
        }
        const hasPremium = await RevenueCatService.checkEntitlement();
        setIsPremium(hasPremium);
        return hasPremium;
    };

    useEffect(() => {
        let mounted = true;

        const fetchAndSetProfile = async (sessionUser: any) => {
            try {
                if (!sessionUser || !sessionUser.id || sessionUser.id.trim() === "") {
                    console.error('[AuthContext] Invalid sessionUser UUID detected. Gracefully aborting profile fetch.');
                    if (mounted) setUser(null);
                    return;
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .single();

                // If profile does not exist, it's likely the trigger is still pending or failed.
                // We'll just show what we have (metadata) or undefined.
                if (mounted) {
                    setUser({ ...sessionUser, profile: profile || undefined });
                }
            } catch (err) {
                console.error('[AuthContext] Error fetching profile:', err);
                if (mounted) setUser(sessionUser as AuthUser);
            }
        };

        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    if (mounted) {
                        const loggedUser = session.user as AuthUser;
                        setUser(loggedUser);
                        setIsLoading(false);
                        fetchAndSetProfile(loggedUser);

                        // Initialize RevenueCat for native platform
                        RevenueCatService.initialize(loggedUser.id).then(() => {
                            updatePremiumStatus(loggedUser).then(hasPremium => {
                                if (hasPremium) {
                                    BackgroundGeofenceService.startTracking(loggedUser.id).catch(console.error);
                                }
                            });
                        });
                    }
                } else {
                    if (mounted) setIsLoading(false);
                }
            } catch (err) {
                console.error('[AuthContext] Unexpected auth error:', err);
                if (mounted) setIsLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
            if (mounted) {
                if (session?.user) {
                    const loggedUser = session.user as AuthUser;
                    setUser(loggedUser);
                    setIsLoading(false);
                    fetchAndSetProfile(loggedUser);
                    updatePremiumStatus(loggedUser);
                } else {
                    setUser(null);
                    setIsLoading(false);
                }
            }
        });

        const timeoutId = setTimeout(() => {
            if (mounted && isLoading) {
                setIsLoading(false);
            }
        }, 3000);

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        const { user: loggedInUser, error } = await signIn(email, password);
        if (loggedInUser) {
            setUser(loggedInUser);
            await updatePremiumStatus(loggedInUser);
        }
        setIsLoading(false);
        return { error };
    };

    const register = async (email: string, password: string, fullName: string) => {
        setIsLoading(true);
        const { user: newUser, error } = await signUp(email, password, fullName);
        if (newUser) {
            // Only 'log in' the user in the context if they are confirmed
            // If they are not confirmed (and not in mock mode), we don't set the user state yet
            if (newUser.email_confirmed_at || getIsMockMode()) {
                setUser(newUser);
                await updatePremiumStatus(newUser);
            }
        }
        setIsLoading(false);
        return { error };
    };

    const loginWithGoogle = async () => {
        setIsLoading(true);
        try {
            const { error } = await signInWithGoogle();
            return { error };
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithApple = async () => {
        setIsLoading(true);
        try {
            const { error } = await signInWithApple();
            return { error };
        } finally {
            setIsLoading(false);
        }
    };

    const loginAsDemo = async () => {
        setIsLoading(true);
        try {
            const { user: demoUser } = await signInAsDemo();
            setUser(demoUser);
            await updatePremiumStatus(demoUser);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        await signOut();
        localStorage.removeItem('mock_user');
        localStorage.removeItem('redcarpet_demo_mode');
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            if (supabaseUrl && supabaseUrl.includes('://')) {
                const projectRef = supabaseUrl.split('://')[1].split('.')[0];
                const storageKey = `sb-${projectRef}-auth-token`;
                const { Preferences } = await import('@capacitor/preferences');
                await Preferences.remove({ key: storageKey });
            }
        } catch (e) {
            console.error('Error clearing manual storage:', e);
        }
        setUser(null);
        setIsPremium(false);
        await BackgroundGeofenceService.stopTracking().catch(console.error);
    };

    const resetPassword = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`,
            });
            return { error: error?.message || null };
        } catch (err: any) {
            return { error: err.message || 'Error al enviar el correo de recuperación' };
        }
    };

    const refreshProfile = async () => {
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
            setUser({ ...user, profile: data });
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user && (!!user.email_confirmed_at || getIsMockMode()),
            isPremium,
            login,
            register,
            loginWithGoogle,
            loginWithApple,
            loginAsDemo,
            logout,
            resetPassword,
            setIsPremium,
            refreshProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
