import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    getCurrentUser,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithApple,
    signInAsDemo,
    onAuthStateChange,
    type AuthUser
} from '../services/authService';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ error: string | null }>;
    register: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
    loginWithGoogle: () => Promise<{ error: string | null }>;
    loginWithApple: () => Promise<{ error: string | null }>;
    loginAsDemo: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check initial auth state
        const checkAuth = async () => {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
            setIsLoading(false);
        };
        checkAuth();

        // Subscribe to auth changes
        const unsubscribe = onAuthStateChange((newUser) => {
            setUser(newUser);
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        const { user: loggedInUser, error } = await signIn(email, password);
        if (loggedInUser) setUser(loggedInUser);
        setIsLoading(false);
        return { error };
    };

    const register = async (email: string, password: string, fullName: string) => {
        setIsLoading(true);
        const { user: newUser, error } = await signUp(email, password, fullName);
        if (newUser) setUser(newUser);
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
    };

    const logout = async () => {
        await signOut();
        localStorage.removeItem('mock_user');
        localStorage.removeItem('demo_mode');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            register,
            loginWithGoogle,
            loginWithApple,
            loginAsDemo,
            logout,
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
