import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getDashboardProfile, getCityBounds, type DashboardProfile } from './dashboardService';
import { dt, getDashLang, setDashLang } from './i18n';
import { Map as MapIcon, Bell, BarChart3, ScrollText, LogOut, ShieldCheck } from 'lucide-react';

interface DashContext {
    profile: DashboardProfile;
    cityBounds: [number, number, number, number] | null;
}

const Ctx = createContext<DashContext | null>(null);

export function useDashboard(): DashContext {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useDashboard outside DashboardLayout');
    return ctx;
}

/**
 * Guard + chrome for the authorities dashboard. Blocks anyone without a
 * dashboard_users row (the DB enforces data scoping regardless — this is UX).
 * Neutral institutional look, bilingual ES/VA.
 */
export default function DashboardLayout() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<DashboardProfile | null>(null);
    const [cityBounds, setCityBounds] = useState<[number, number, number, number] | null>(null);
    const [checking, setChecking] = useState(true);
    const [, forceRender] = useState(0);

    useEffect(() => {
        (async () => {
            const p = await getDashboardProfile();
            if (!p) {
                navigate('/dashboard/login', { replace: true });
                return;
            }
            setProfile(p);
            if (p.city_id) {
                setCityBounds(await getCityBounds(p.city_id));
            }
            setChecking(false);
        })();
    }, [navigate]);

    if (checking || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">
                {dt('loading')}
            </div>
        );
    }

    const cityName = profile.city?.name ?? 'Red Carpet';
    const navItems = [
        { to: '/dashboard', end: true, icon: MapIcon, label: dt('nav_map') },
        { to: '/dashboard/alerts', end: false, icon: Bell, label: dt('nav_alerts') },
        { to: '/dashboard/stats', end: false, icon: BarChart3, label: dt('nav_stats') },
        { to: '/dashboard/audit', end: false, icon: ScrollText, label: dt('nav_audit') }
    ];

    return (
        <Ctx.Provider value={{ profile, cityBounds }}>
            <div className="min-h-screen bg-slate-100 flex flex-col">
                <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 text-red-400" />
                        <div>
                            <h1 className="font-semibold leading-tight">Red Carpet — {cityName}</h1>
                            <p className="text-xs text-slate-400">
                                {profile.display_name ?? profile.id} · {profile.role}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            className="text-xs border border-slate-600 rounded px-2 py-1 hover:bg-slate-700"
                            onClick={() => { setDashLang(getDashLang() === 'es' ? 'va' : 'es'); forceRender(n => n + 1); }}
                        >
                            {getDashLang() === 'es' ? 'VA' : 'ES'}
                        </button>
                        <button
                            className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"
                            onClick={async () => { await supabase.auth.signOut(); navigate('/dashboard/login'); }}
                        >
                            <LogOut className="w-4 h-4" /> {dt('logout')}
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 min-h-0">
                    <nav className="w-48 bg-white border-r border-slate-200 py-4 flex flex-col gap-1">
                        {navItems.map(({ to, end, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={({ isActive }) =>
                                    `flex items-center gap-2 px-4 py-2 text-sm ${isActive
                                        ? 'bg-red-50 text-red-700 border-r-2 border-red-600 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50'}`
                                }
                            >
                                <Icon className="w-4 h-4" /> {label}
                            </NavLink>
                        ))}
                    </nav>
                    <main className="flex-1 min-w-0 overflow-auto">
                        <Outlet />
                    </main>
                </div>
            </div>
        </Ctx.Provider>
    );
}
