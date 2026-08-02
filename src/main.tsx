import './motion-shim'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // Initialize i18n
import { SplashScreen } from '@capacitor/splash-screen'

console.log("RedCarpet V3 Production Mode");

// === CRASH RECOVERY: hide splash ALWAYS within 200ms ===
// This ensures the native splash NEVER gets stuck and hides quickly.
const hideSplash = () => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
setTimeout(hideSplash, 200); // Reduced from 1000ms to load faster

// === GLOBAL ERROR HANDLER ===
if (typeof window !== 'undefined') {
  window.onerror = function(msg, url, lineNo, _columnNo, error) {
    const errorMsg = `JS ERROR: ${msg} Line: ${lineNo}`;
    console.error(errorMsg, error);
    // Always try to hide splash on error
    hideSplash();
    // Show recovery UI if root is blank
    const root = document.getElementById('root');
    if (root && root.childElementCount === 0) {
      root.innerHTML = `
        <div style="background:#0f0808;color:white;height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;font-family:sans-serif;text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <h1 style="font-size:20px;margin-bottom:8px">Error al iniciar</h1>
          <p style="font-size:13px;color:#aaa;margin-bottom:24px">${String(msg).substring(0, 120)}</p>
          <button onclick="window.location.reload()" style="background:#cc0000;color:white;border:none;padding:12px 32px;border-radius:24px;font-size:16px;font-weight:bold;cursor:pointer">Reintentar</button>
        </div>`;
    }
    return false;
  };

  // Also catch unhandled promise rejections
  window.onunhandledrejection = function(event) {
    console.error("UNHANDLED PROMISE REJECTION:", event.reason);
    hideSplash();
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
    hideSplash();
    rootElement.innerHTML = `
      <div style="background:#0f0808;color:white;height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;font-family:sans-serif;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h1 style="font-size:20px;margin-bottom:8px">Error al iniciar la app</h1>
        <p style="font-size:13px;color:#aaa;margin-bottom:24px">${String(err?.message || err).substring(0, 120)}</p>
        <button onclick="window.location.reload()" style="background:#cc0000;color:white;border:none;padding:12px 32px;border-radius:24px;font-size:16px;font-weight:bold;cursor:pointer">Reintentar</button>
      </div>`;
  }
}