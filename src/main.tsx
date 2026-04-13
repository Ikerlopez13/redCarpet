import './motion-shim'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // Initialize i18n
import { SplashScreen } from '@capacitor/splash-screen'

console.log("RedCarpet V3 Production Mode");

if (typeof window !== 'undefined') {
  window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorMsg = `JS ERROR: ${msg} Line: ${lineNo}`;
    console.error(errorMsg, error);
    if (window.location.protocol.includes('capacitor') || window.location.hostname === 'localhost') {
        alert(errorMsg);
    }
    return false;
  };
}

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err: any) {
    console.error("CRITICAL RENDER ERROR:", err);
  }
}

setTimeout(() => {
  SplashScreen.hide().catch(() => {});
}, 500);