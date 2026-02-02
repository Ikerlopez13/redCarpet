import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Map, Settings, BatteryFull, Wifi, Signal, Users } from 'lucide-react';
import clsx from 'clsx';
import { SplashScreen } from './SplashScreen';

export const MobileShell: React.FC = () => {
    const [loading, setLoading] = useState(true);

    return (
        // Main Container - Black Background with Blurred Effects
        <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center p-4 md:p-8 font-sans overflow-hidden relative selection:bg-primary selection:text-white">

            {/* Ambient Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[10000ms]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[150px] mix-blend-screen"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-900/40 rounded-full blur-[100px]"></div>
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

                        {/* Splash Screen */}
                        {loading && <SplashScreen onFinish={() => setLoading(false)} />}

                        {/* Dynamic Island / Notch */}
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-[35px] w-[120px] bg-black rounded-b-[18px] z-50 pointer-events-none mt-[11px] flex items-center justify-center">
                            <div className="w-[80px] h-[35px] relative">
                                <div className="absolute top-[8px] right-[10px] w-3 h-3 bg-[#1a1a1a] rounded-full opacity-60"></div>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="absolute top-0 left-0 w-full h-12 px-6 flex justify-between items-center z-40 pointer-events-none text-white mix-blend-difference">
                            <span className="text-sm font-semibold pl-4">9:41</span>
                            <div className="flex gap-1.5 items-center pr-4">
                                <Signal size={16} fill="currentColor" />
                                <Wifi size={16} />
                                <BatteryFull size={20} fill="currentColor" />
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col pt-8 pb-[84px] bg-background-dark">
                            <Outlet />
                        </div>

                        {/* Bottom Navigation */}
                        <BottomNav />
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

    const tabs = [
        { icon: Map, label: 'Mapa', path: '/' },
        { icon: Users, label: 'Contactos', path: '/contacts' },
        { icon: Settings, label: 'Ajustes', path: '/settings' },
    ];

    return (
        <div className="h-[84px] w-full bg-background-dark/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 pb-4 pt-2 z-40 absolute bottom-0">
            {tabs.map((tab) => {
                const isActive = location.pathname === tab.path;
                return (
                    <button
                        key={tab.path}
                        onClick={() => navigate(tab.path)}
                        className={clsx(
                            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                            isActive ? "text-primary" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} fill={isActive ? "currentColor" : "none"} fillOpacity={0.2} />
                        <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                )
            })}
        </div>
    );
};
