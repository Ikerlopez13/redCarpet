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
    setIsPremium: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    // Helper function to check and set premium status
    const updatePremiumStatus = async (currentUser: AuthUser | null): Promise<boolean> => {
        if (!currentUser) {
            setIsPremium(false);
            return false;
        }

        // Let RevenueCat Service check native entitlements
        // By default it checks the 'RedCarpet Pro' identifier
        const hasPremium = await RevenueCatService.checkEntitlement();
        setIsPremium(hasPremium);
        return hasPremium;
    };

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                console.log('[AuthContext] Initializing auth...');

                // 1. Ask Supabase for session
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('[AuthContext] Error getting session:', error);
                }

                if (session) {
                    console.log('[AuthContext] Session found via SDK');
                    if (mounted) {
                        const loggedUser = session.user as AuthUser;
                        setUser(loggedUser);
                        const hasPremium = await updatePremiumStatus(loggedUser);
                        // Start background tracking if premium
                        if (hasPremium) {
                            BackgroundGeofenceService.startTracking(loggedUser.id).catch(console.error);
                        }
                        setIsLoading(false);
                    }
                } else {
                    console.warn('[AuthContext] No session found via SDK. Checking manual Native Storage fallback...');

                    // 2. Manual Recovery Strategy
                    try {
                        const projectRef = import.meta.env.VITE_SUPABASE_URL.split('://')[1].split('.')[0];
                        const storageKey = `sb-${projectRef}-auth-token`;

                        // Import Preferences dynamically to avoid top-level await issues
                        const { Preferences } = await import('@capacitor/preferences');
                        const { value } = await Preferences.get({ key: storageKey });

                        if (value) {
                            console.log('[AuthContext] Found manual session in Native Storage! Restoring...');
                            const parsedSession = JSON.parse(value);

                            // Rehydrate Supabase
                            const { error: restoreError } = await supabase.auth.setSession({
                                access_token: parsedSession.access_token,
                                refresh_token: parsedSession.refresh_token
                            });

                            if (!restoreError) {
                                console.log('[AuthContext] Session manually restored!');
                                // Note: onAuthStateChange should trigger setSession/setUser, 
                                // but we set it here just in case to unblock UI
                                const { data: freshData } = await supabase.auth.getSession();
                                if (mounted) {
                                    const loggedUser = freshData.session?.user as AuthUser;
                                    setUser(loggedUser ?? null);

                                    if (loggedUser) {
                                        const hasPremium = await updatePremiumStatus(loggedUser);
                                        if (hasPremium) {
                                            BackgroundGeofenceService.startTracking(loggedUser.id).catch(console.error);
                                        }
                                    } else {
                                        await updatePremiumStatus(null);
                                    }
                                    setIsLoading(false);
                                }
                            } else {
                                console.error('[AuthContext] Failed to restore manual session:', restoreError);
                            }
                        } else {
                            console.log('[AuthContext] No manual session found either.');
                        }
                    } catch (manualErr) {
                        console.error('[AuthContext] Error during manual session recovery:', manualErr);
                    }
                }
            } catch (err) {
                console.error('[AuthContext] Unexpected auth initialization error:', err);
            } finally {
                if (mounted && isLoading) setIsLoading(false);
            }
        };

        initAuth();

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (mounted) {
                console.log('[AuthContext] Auth state changed:', _event);
                const loggedUser = (session?.user as AuthUser) ?? null;
                setUser(loggedUser);

                if (loggedUser) {
                    const hasPremium = await updatePremiumStatus(loggedUser);
                    if (hasPremium) {
                        BackgroundGeofenceService.startTracking(loggedUser.id).catch(console.error);
                    }
                } else {
                    await updatePremiumStatus(null);
                    BackgroundGeofenceService.stopTracking().catch(console.error);
                }

                setIsLoading(false);
            }
        });

        // Safety timeout - force app to load after 6s if something gets stuck
        const timeoutId = setTimeout(() => {
            if (mounted && isLoading) {
                console.warn('[AuthContext] Auth check timed out, forcing load');
                setIsLoading(false);
            }
        }, 6000);

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
            setUser(newUser);
            await updatePremiumStatus(newUser);
        }
        setIsLoading(false);
        return { error };
    };

    const loginWithGoogle = async () => {
        const { error } = await signInWithGoogle();
        return { error };
    };

    const loginWithApple = async () => {
        const { error } = await signInWithApple();
        return { error };
    };

    const loginAsDemo = async () => {
        const { user: demoUser } = await signInAsDemo();
        setUser(demoUser);
        await updatePremiumStatus(demoUser);
    };

    const logout = async () => {
        await signOut();
        localStorage.removeItem('mock_user');
        localStorage.removeItem('demo_mode');
        // Clean manual storage as well
        try {
            const projectRef = import.meta.env.VITE_SUPABASE_URL.split('://')[1].split('.')[0];
            const storageKey = `sb-${projectRef}-auth-token`;
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key: storageKey });
        } catch (e) {
            console.error('Error clearing manual storage:', e);
        }
        setUser(null);
        setIsPremium(false);
        await BackgroundGeofenceService.stopTracking().catch(console.error);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            isPremium,
            login,
            register,
            loginWithGoogle,
            loginWithApple,
            loginAsDemo,
            logout,
            setIsPremium,
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
