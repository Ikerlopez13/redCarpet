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
    refreshProfile: () => Promise<void>;
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

        const fetchAndSetProfile = async (sessionUser: any) => {
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .single();

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
                console.log('[AuthContext] Initializing auth...');

                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    console.log('[AuthContext] Session found via SDK');
                    if (mounted) {
                        const loggedUser = session.user as AuthUser;
                        setUser(loggedUser);
                        setIsLoading(false);

                        // Background load
                        fetchAndSetProfile(loggedUser);
                        updatePremiumStatus(loggedUser).then(hasPremium => {
                            if (hasPremium) {
                                BackgroundGeofenceService.startTracking(loggedUser.id).catch(console.error);
                            }
                        });
                    }
                } else {
                    console.warn('[AuthContext] No session found via SDK. Checking manual fallback...');

                    // Recovery Strategy
                    try {
                        const projectRef = import.meta.env.VITE_SUPABASE_URL.split('://')[1].split('.')[0];
                        const storageKey = `sb-${projectRef}-auth-token`;

                        const { Preferences } = await import('@capacitor/preferences');
                        const { value } = await Preferences.get({ key: storageKey });

                        if (value) {
                            console.log('[AuthContext] Found manual session! Restoring...');
                            const parsedSession = JSON.parse(value);

                            const { error: restoreError } = await supabase.auth.setSession({
                                access_token: parsedSession.access_token,
                                refresh_token: parsedSession.refresh_token
                            });

                            if (!restoreError) {
                                const { data: freshData } = await supabase.auth.getSession();
                                if (mounted && freshData.session) {
                                    const loggedUser = freshData.session.user as AuthUser;
                                    setUser(loggedUser);
                                    setIsLoading(false);
                                    fetchAndSetProfile(loggedUser);
                                    updatePremiumStatus(loggedUser);
                                }
                            }
                        }
                    } catch (manualErr) {
                        console.error('[AuthContext] Error recovery:', manualErr);
                    }
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
                console.log('[AuthContext] Auth status:', _event);
                if (session?.user) {
                    const loggedUser = session.user as AuthUser;
                    setUser(loggedUser); // UPDATE IMMEDIATELY
                    setIsLoading(false); // RELEASE IMMEDIATELY

                    // Background load
                    fetchAndSetProfile(loggedUser);
                    updatePremiumStatus(loggedUser).then(hasPremium => {
                        if (hasPremium) {
                            BackgroundGeofenceService.startTracking(loggedUser.id).catch(console.error);
                        }
                    });
                } else {
                    setUser(null);
                    updatePremiumStatus(null);
                    BackgroundGeofenceService.stopTracking().catch(console.error);
                    setIsLoading(false);
                }
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
            isAuthenticated: !!user,
            isPremium,
            login,
            register,
            loginWithGoogle,
            loginWithApple,
            loginAsDemo,
            logout,
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
