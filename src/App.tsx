import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MobileShell } from './components/layout/MobileShell';
import { AuthProvider } from './contexts/AuthContext';
import { ReportIncident } from './pages/ReportIncident';
import { RouteSelection } from './pages/RouteSelection';
import { Emergency } from './pages/Emergency';
import { Settings } from './pages/Settings';
import { GreenCarpet } from './pages/GreenCarpet';
import { TrustedContacts } from './pages/TrustedContacts';
import { Home } from './pages/Home';
import { Subscription } from './pages/Subscription';
import { Navigation } from './pages/Navigation';
import { TransitNavigationPage } from './pages/TransitNavigation';
import { Onboarding } from './pages/Onboarding';
import { Login } from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MobileShell />}>
            {/* Auth routes - inside MobileShell but NavBar hidden via logic */}
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
