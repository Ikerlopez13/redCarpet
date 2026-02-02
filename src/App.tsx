import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MobileShell } from './components/layout/MobileShell';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MobileShell />}>
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
  );
}

export default App;
