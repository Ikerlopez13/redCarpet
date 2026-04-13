import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { MobileShell } from './components/layout/MobileShell';
import { AuthProvider } from './contexts/AuthContext';
import { SOSProvider } from './contexts/SOSContext';
import { useSOS } from './contexts/SOSContext.base';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DeepLinkHandler } from './components/auth/DeepLinkHandler';
import { SOSRequestModal } from './components/SOS/SOSRequestModal';
import { EmergencyConsentModal } from './components/Legal/EmergencyConsentModal';

// Lazy Loaded Pages to unblock build
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const ReportIncident = lazy(() => import('./pages/ReportIncident').then(m => ({ default: m.ReportIncident })));
const RouteSelection = lazy(() => import('./pages/RouteSelection').then(m => ({ default: m.RouteSelection })));
const Navigation = lazy(() => import('./pages/Navigation').then(m => ({ default: m.Navigation })));
const TransitNavigationPage = lazy(() => import('./pages/TransitNavigation').then(m => ({ default: m.TransitNavigationPage })));
const Emergency = lazy(() => import('./pages/Emergency').then(m => ({ default: m.Emergency })));
const GreenCarpet = lazy(() => import('./pages/GreenCarpet').then(m => ({ default: m.GreenCarpet })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const TrustedContacts = lazy(() => import('./pages/TrustedContacts').then(m => ({ default: m.TrustedContacts })));
const Subscription = lazy(() => import('./pages/Subscription').then(m => ({ default: m.Subscription })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
const SOSActivePage = lazy(() => import('./pages/SOSActivePage').then(m => ({ default: m.SOSActivePage })));
const AIChat = lazy(() => import('./pages/AIChat').then(m => ({ default: m.AIChat })));
const Feedback = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const FAQ = lazy(() => import('./pages/FAQ').then(m => ({ default: m.FAQ })));
const Account = lazy(() => import('./pages/Account').then(m => ({ default: m.Account })));
const SOSHistory = lazy(() => import('./pages/SOSHistory').then(m => ({ default: m.SOSHistory })));
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));

// Generic Loading Screen
const PageLoader = () => (
    <div className="flex items-center justify-center h-full w-full bg-background-dark min-h-[400px]">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
);

/**
 * Renders the global SOS modals. 
 * Separated to break the circular dependency loop in SOSContext.
 */
const GlobalSOSModals = () => {
    const { 
        isSOSModalOpen, 
        closeSOSModal, 
        showConsent, 
        handleConsentGiven, 
        setShowConsent 
    } = useSOS() as any;

    return (
        <>
            <SOSRequestModal
                isOpen={isSOSModalOpen}
                onClose={closeSOSModal}
            />
            <EmergencyConsentModal
                isOpen={showConsent}
                onConsent={handleConsentGiven}
                onDecline={() => setShowConsent(false)}
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
            <BrowserRouter>
                <SOSProvider>
                    <DeepLinkHandler />
                    <GlobalSOSModals />
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route element={<MobileShell />}>
                                {/* Auth routes - accessible without login */}
                                <Route path="/login" element={<Login />} />
                                <Route path="/onboarding" element={<Onboarding />} />
                                <Route path="/privacy" element={<PrivacyPolicy />} />
                                <Route path="/terms" element={<TermsOfService />} />

                                {/* Protected routes - enforce login */}
                                <Route element={<ProtectedRoute />}>
                                    <Route path="/emergency-live" element={<SOSActivePage />} />
                                    <Route path="/" element={<Home />} />
                                    <Route path="/report" element={<ReportIncident />} />
                                    <Route path="/route" element={<RouteSelection />} />
                                    <Route path="/navigate" element={<Navigation />} />
                                    <Route path="/transit-navigate" element={<TransitNavigationPage />} />
                                    <Route path="/emergency" element={<Emergency />} />
                                    <Route path="/greencarpet" element={<GreenCarpet />} />
                                    <Route path="/settings" element={<Settings />} />
                                    <Route path="/contacts" element={<TrustedContacts />} />
                                    <Route path="/subscription" element={<Subscription />} />
                                    <Route path="/chat" element={<AIChat />} />
                                    <Route path="/feedback" element={<Feedback />} />
                                    <Route path="/faq" element={<FAQ />} />
                                    <Route path="/account" element={<Account />} />
                                    <Route path="/history" element={<SOSHistory />} />
                                    <Route path="/security" element={<Security />} />
                                    <Route path="/notifications" element={<Notifications />} />
                                </Route>
                            </Route>
                        </Routes>
                    </Suspense>
                </SOSProvider>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
