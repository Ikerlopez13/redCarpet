import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { MobileShell } from './components/layout/MobileShell';
import { AuthProvider } from './contexts/AuthContext';
import { SOSProvider } from './contexts/SOSContext';
import { useSOS } from './contexts/SOSContext.base';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DeepLinkHandler } from './components/auth/DeepLinkHandler';
import { EmergencyConsentModal } from './components/Legal/EmergencyConsentModal';
import { SOSConfigSheet } from './components/SOSConfigSheet';
import { Preferences } from '@capacitor/preferences';
import { useNavigate, useLocation } from 'react-router-dom';

// Lazy Loaded Pages to unblock build
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const RouteSelection = lazy(() => import('./pages/RouteSelection').then(m => ({ default: m.RouteSelection })));
const Navigation = lazy(() => import('./pages/Navigation').then(m => ({ default: m.Navigation })));
const TransitNavigationPage = lazy(() => import('./pages/TransitNavigation').then(m => ({ default: m.TransitNavigationPage })));
const GreenCarpet = lazy(() => import('./pages/GreenCarpet').then(m => ({ default: m.GreenCarpet })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const TrustedContacts = lazy(() => import('./pages/TrustedContacts').then(m => ({ default: m.TrustedContacts })));
const Subscription = lazy(() => import('./pages/Subscription').then(m => ({ default: m.Subscription })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
const AIChat = lazy(() => import('./pages/AIChat').then(m => ({ default: m.AIChat })));
const CameraTest = lazy(() => import('./pages/CameraTest').then(m => ({ default: m.CameraTest })));
const Feedback = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const FAQ = lazy(() => import('./pages/FAQ').then(m => ({ default: m.FAQ })));
const Account = lazy(() => import('./pages/Account').then(m => ({ default: m.Account })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const EULA = lazy(() => import('./pages/EULA').then(m => ({ default: m.EULA })));
const Emergency = lazy(() => import('./pages/Emergency').then(m => ({ default: m.Emergency })));
const SOSActivePage = lazy(() => import('./pages/SOSActivePage').then(m => ({ default: m.SOSActivePage })));
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));
const WidgetsPage = lazy(() => import('./pages/WidgetsPage').then(m => ({ default: m.WidgetsPage })));

// Generic Loading Screen
const PageLoader = () => (
    <div className="flex items-center justify-center h-full w-full bg-background-dark min-h-[400px]">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
);

import { ForceUpdateGate } from './components/ForceUpdateGate';
import { useAuth } from './contexts/AuthContext';

/**
 * Renders the global modals. 
 */
const GlobalModals = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshProfile } = useAuth();
    const { 
        showConsent, 
        handleConsentGiven, 
        setShowConsent,
        isConfigured,
        setIsConfigured
    } = useSOS() as any;

    const isExcludedPage = ['/onboarding', '/login', '/privacy', '/terms', '/eula'].includes(location.pathname);
    const isOnboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
    const isConfigCompleted = localStorage.getItem('sos_config_completed') === 'true';

    return (
        <>
            <EmergencyConsentModal
                isOpen={showConsent && !isExcludedPage}
                onConsent={handleConsentGiven}
                onDecline={() => setShowConsent(false)}
            />

            <SOSConfigSheet
                isOpen={!!user && !isConfigured && !isConfigCompleted && !showConsent && !isExcludedPage && isOnboardingComplete}
                onClose={async () => {
                    setIsConfigured(true);
                    localStorage.setItem('sos_config_completed', 'true');
                    try {
                        const { Preferences } = await import('@capacitor/preferences');
                        await Preferences.set({ key: 'sos_config_completed', value: 'true' });
                    } catch (err) {
                        console.error('[GlobalModals] Error saving completed config skip:', err);
                    }
                }}
                onSave={async (config) => {
                    // 1. Save to Capacitor Preferences
                    await Preferences.set({ key: 'sos_config', value: JSON.stringify(config) });
                    await Preferences.set({ key: 'SOS_PIN', value: config.pin });
                    await Preferences.set({ key: 'sos_config_completed', value: 'true' });
                    
                    // 2. Save to localStorage for Web compatibility
                    localStorage.setItem('sos_config', JSON.stringify(config));
                    localStorage.setItem('SOS_PIN', config.pin);
                    localStorage.setItem('sos_config_completed', 'true');
                    
                    // 3. Save to remote Supabase
                    if (user) {
                        try {
                            const { supabase } = await import('./services/supabaseClient');
                            await supabase.from('profiles').update({ sos_pin: config.pin }).eq('id', user.id);
                            await refreshProfile();
                        } catch (err) {
                            console.error('[GlobalModals] Error updating profile pin:', err);
                        }
                    }
                    
                    setIsConfigured(true);
                    
                    // Go to Home after SOS configuration (not subscription)
                    setTimeout(() => {
                        navigate('/');
                    }, 500);
                }}
            />
        </>
    );
};

function App() {
    useEffect(() => {
        // Deep Links are handled by src/components/auth/DeepLinkHandler.tsx
    }, []);

    return (
        <AuthProvider>
            <ForceUpdateGate>
                <BrowserRouter>
                    <SOSProvider>
                        <DeepLinkHandler />
                        <GlobalModals />
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                <Route element={<MobileShell />}>
                                    {/* Auth routes - accessible without login */}
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/onboarding" element={<Onboarding />} />
                                    <Route path="/privacy" element={<PrivacyPolicy />} />
                                    <Route path="/terms" element={<TermsOfService />} />
                                    <Route path="/eula" element={<EULA />} />

                                    {/* Protected routes - enforce login */}
                                    <Route element={<ProtectedRoute />}>
                                        <Route path="/" element={<Home />} />
                                        <Route path="/route" element={<RouteSelection />} />
                                        <Route path="/navigate" element={<Navigation />} />
                                        <Route path="/transit-navigate" element={<TransitNavigationPage />} />
                                        <Route path="/greencarpet" element={<GreenCarpet />} />
                                        <Route path="/settings" element={<Settings />} />
                                        <Route path="/contacts" element={<TrustedContacts />} />
                                        <Route path="/subscription" element={<Subscription />} />
                                        <Route path="/chat" element={<AIChat />} />
                                        <Route path="/feedback" element={<Feedback />} />
                                        <Route path="/faq" element={<FAQ />} />
                                        <Route path="/account" element={<Account />} />
                                        <Route path="/notifications" element={<Notifications />} />
                                        <Route path="/emergency" element={<Emergency />} />
                                        <Route path="/emergency-live" element={<SOSActivePage />} />
                                        <Route path="/security" element={<Security />} />
                                        <Route path="/widgets" element={<WidgetsPage />} />
                                    </Route>
                                </Route>
                            </Routes>
                        </Suspense>
                    </SOSProvider>
                </BrowserRouter>
            </ForceUpdateGate>
        </AuthProvider>
    );
}

export default App;
