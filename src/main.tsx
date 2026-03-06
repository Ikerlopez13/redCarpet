import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SplashScreen } from '@capacitor/splash-screen'
import { RevenueCatService } from './services/revenueCatService';
import './index.css'
import App from './App.tsx'

SplashScreen.hide().catch(console.error);
RevenueCatService.initialize().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
