import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { MobileShell } from './components/layout/MobileShell';
import { AuthProvider } from './contexts/AuthContext';
import { SOSProvider } from './contexts/SOSContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DeepLinkHandler } from './components/auth/DeepLinkHandler';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { ReportIncident } from './pages/ReportIncident';
import { RouteSelection } from './pages/RouteSelection';
import { Navigation } from './pages/Navigation';
import { TransitNavigationPage } from './pages/TransitNavigation';
import { Emergency } from './pages/Emergency';
import { GreenCarpet } from './pages/GreenCarpet';
import { Settings } from './pages/Settings';
import { TrustedContacts } from './pages/TrustedContacts';
import { Subscription } from './pages/Subscription';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';

function App() {
  useEffect(() => {
    // Deep Links are now handled by src/components/auth/DeepLinkHandler.tsx
    // to ensure access to Router context (navigation) and avoid forced reloads.
  }, []);

  return (
    <AuthProvider>
      <SOSProvider>
        <BrowserRouter>
          <DeepLinkHandler />
          <Routes>
            <Route element={<MobileShell />}>
              {/* Auth routes - accessible without login */}
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />

              {/* Protected routes - enforce login */}
              <Route element={<ProtectedRoute />}>
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
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </SOSProvider>
    </AuthProvider>
  );
}

export default App;
