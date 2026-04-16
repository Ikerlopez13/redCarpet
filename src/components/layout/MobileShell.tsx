import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Map, Settings, BatteryFull, Wifi, Signal, Users, Crown, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { SplashScreen } from './SplashScreen';
import { useAuth } from '../../contexts/AuthContext';

import { Capacitor } from '@capacitor/core';
import { DeepLinkHandler } from '../auth/DeepLinkHandler';

// Simple Error Boundary for Native Debugging
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    componentDidCatch(error: any, errorInfo: any) {
        console.error("🚨 REACT CRASH:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-900 text-white h-full flex flex-col items-center justify-center text-center">
                    <h1 className="text-2xl font-bold mb-4">Algo salió mal</h1>
                    <pre className="text-[10px] text-red-200 bg-black/50 p-4 rounded-lg overflow-auto max-w-full">
                        {this.state.error?.toString()}
                    </pre>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-white text-red-900 rounded-full font-bold"
                    >
                        Reiniciar App
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export const MobileShell: React.FC = () => {
    const { isLoading: isAuthLoading } = useAuth();
    const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);
    const location = useLocation();
    const isNative = Capacitor.isNativePlatform();

    // Show splash if animation hasn't finished OR auth is still loading
    const showSplash = !splashAnimationFinished || isAuthLoading;

    // If native (iOS/Android), disable the mock shell and render full screen
    if (isNative) {
        const isEmergencyLive = location.pathname === '/emergency-live';
        
        return (
            <div className={clsx(
                "h-[100dvh] w-screen overflow-hidden flex flex-col relative",
                isEmergencyLive ? "bg-transparent" : "bg-background-dark"
            )}>
                <DeepLinkHandler />
                {/* Content Area */}
                <div className={clsx(
                    "flex-1 overflow-y-auto no-scrollbar relative flex flex-col pt-safe-top",
                    isEmergencyLive ? "bg-transparent" : "bg-background-dark",
                    !['/login', '/onboarding'].includes(location.pathname) && "pb-[84px] pb-safe-bottom"
                )}>
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </div>

                {/* Bottom Navigation */}
                {!['/login', '/onboarding', '/emergency-live'].includes(location.pathname) && <BottomNav />}
            </div>
        );
    }

    return (
        // Main Container - Black Background
        <div className="h-[100dvh] w-full bg-[#050505] flex items-center justify-center p-4 md:p-8 font-sans overflow-hidden relative selection:bg-primary selection:text-white">
            <DeepLinkHandler />

            {/* Ambient Background Effects - Cleaned for Production */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-900/20 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 md:gap-24">

                {/* External Logo (Desktop/Presentation view) */}
                <div className="hidden md:flex flex-col items-center md:items-start gap-4">
                    <img
                        src="/logo.png"
                        alt="RedCarpet Logo"
                        className="w-32 h-auto drop-shadow-2xl"
                    />
                </div>

                {/* iPhone Frame Container */}
                <div className="relative mx-auto border-gray-900 dark:border-gray-900 bg-gray-900 border-[14px] rounded-[3rem] shadow-xl md:h-[932px] md:w-[430px] h-full w-full max-w-[430px] shrink-0 transform transition-transform duration-700 hover:scale-[1.01]">

                    {/* Inner Screen Container */}
                    <div className="h-full w-full overflow-hidden rounded-[2rem] bg-background-dark relative z-20 flex flex-col">

                        {/* Splash Screen - Show until BOTH animation finishes AND auth is ready */}
                        {showSplash && <SplashScreen onFinish={() => setSplashAnimationFinished(true)} />}

                        {/* Dynamic Island / Notch */}
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-[35px] w-[120px] bg-black rounded-b-[18px] z-50 pointer-events-none mt-[11px] flex items-center justify-center">
                            <div className="w-[80px] h-[35px] relative">
                                <div className="absolute top-[8px] right-[10px] w-3 h-3 bg-[#1a1a1a] rounded-full opacity-60"></div>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="absolute top-0 left-0 w-full h-12 px-6 flex justify-between items-center z-40 pointer-events-none text-white mix-blend-difference">
                            <div className="flex items-center gap-1.5 pl-4">
                                <span className="text-sm font-semibold">9:41</span>
                                <span className="material-symbols-outlined text-[14px] animate-pulse" title="Ubicación monitoreada para tu seguridad">near_me</span>
                            </div>
                            <div className="flex gap-1.5 items-center pr-4">
                                <Signal size={16} fill="currentColor" />
                                <Wifi size={16} />
                                <BatteryFull size={20} fill="currentColor" />
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className={clsx(
                            "flex-1 overflow-y-auto no-scrollbar relative flex flex-col pt-8 bg-background-dark",
                            !['/login', '/onboarding'].includes(location.pathname) && "pb-[84px]"
                        )}>
                            <ErrorBoundary>
                                <Outlet />
                            </ErrorBoundary>
                        </div>

                        {/* Bottom Navigation */}
                        {!['/login', '/onboarding'].includes(location.pathname) && <BottomNav />}
                    </div>

                    {/* Hardware Buttons */}
                    <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[115px] rounded-l-lg border border-gray-700"></div>
                    <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[170px] rounded-l-lg border border-gray-700"></div>
                    <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[225px] rounded-l-lg border border-gray-700"></div>
                    <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[200px] rounded-r-lg border border-gray-700"></div>

                    {/* Screen Glare */}
                    <div className="absolute top-0 right-0 bottom-0 left-0 rounded-[3rem] pointer-events-none shadow-[inset_0_0_2px_2px_rgba(255,255,255,0.1)] z-40"></div>
                </div>

                {/* Mobile-only logo (optional) */}
                <div className="md:hidden absolute top-4 left-4">
                    <img
                        src="/logo.png"
                        alt="RedCarpet Logo"
                        className="w-12 h-auto opacity-80"
                    />
                </div>
            </div>
        </div>
    );
};

const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const tabs = [
        { icon: Map, label: t('nav.map'), path: '/' },
        { icon: Users, label: t('nav.contacts'), path: '/contacts' },
        { icon: ShieldAlert, label: t('nav.sos'), path: '/emergency' },
        { icon: Crown, label: t('nav.premium'), path: '/subscription' },
        { icon: Settings, label: t('nav.settings'), path: '/settings' },
    ];

    return (
        <div className="h-[84px] w-full bg-background-dark/80 backdrop-blur-xl border-t border-white/5 grid grid-cols-5 items-center px-2 pb-4 pt-2 z-40 absolute bottom-0 shadow-[0_-10px_20px_rgba(0,0,0,0.4)]">
            {tabs.map((tab) => {
                const isActive = location.pathname === tab.path;
                const isSOS = tab.label === 'SOS';

                return (
                    <button
                        key={tab.path}
                        onClick={() => navigate(tab.path)}
                        className={clsx(
                            "flex flex-col items-center gap-1 transition-all relative",
                            isActive ? "text-primary" : (isSOS ? "text-red-500" : "text-slate-500 hover:text-slate-300"),
                            isSOS && "scale-110"
                        )}
                    >
                        <div className={clsx(
                            "flex items-center justify-center transition-all",
                            isSOS ? "size-14 rounded-full bg-primary shadow-[0_0_25px_rgba(255,49,49,0.6)] -mt-10 mb-2 text-white animate-pulse" : "size-10"
                        )}>
                            <tab.icon 
                                size={isSOS ? 32 : 24} 
                                strokeWidth={isActive || isSOS ? 2.5 : 2} 
                                fill={(isActive || isSOS) ? "currentColor" : "none"} 
                                fillOpacity={isSOS ? 1 : 0.2} 
                            />
                        </div>
                        <span className={clsx(
                            "text-[10px] font-bold transition-all",
                            isSOS ? "font-black tracking-tighter uppercase text-primary brightness-125" : (isActive ? "translate-y-0" : "opacity-70")
                        )}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
