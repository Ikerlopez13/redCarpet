import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getDashboardProfile, getCityBounds, type DashboardProfile } from './dashboardService';
import { dt, getDashLang, setDashLang } from './i18n';
import { Map as MapIcon, Bell, BarChart3, ScrollText, LogOut, ShieldAlert, UserRound } from 'lucide-react';

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
 * Styled to match the Red Carpet app branding: near-black + red accents.
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
            <div className="min-h-screen flex items-center justify-center bg-[#050505] text-zinc-500 font-bold uppercase tracking-widest text-xs">
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
            <div className="min-h-screen bg-[#050505] flex flex-col text-white">
                <header className="bg-[#0a0a0a] border-b border-white/10 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_4px_20px_rgba(220,38,38,0.4)] rotate-[-4deg]">
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black italic uppercase tracking-tight leading-tight">
                                Ayto. <span className="text-red-500">{cityName}</span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
                                Control Panel
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden md:flex items-center gap-2 bg-[#131316] border border-white/10 rounded-full px-3 py-1.5 text-[11px] font-bold text-zinc-400">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            Supabase Conectado
                        </span>
                        <button
                            className="text-[11px] font-black uppercase border border-white/15 rounded-full px-3 py-1.5 text-zinc-300 hover:bg-white/5"
                            onClick={() => { setDashLang(getDashLang() === 'es' ? 'va' : 'es'); forceRender(n => n + 1); }}
                        >
                            {getDashLang() === 'es' ? 'VA' : 'ES'}
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 min-h-0">
                    <nav className="w-56 bg-[#0a0a0a] border-r border-white/10 py-5 px-3 flex flex-col gap-1.5">
                        {navItems.map(({ to, end, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${isActive
                                        ? 'bg-[#1a1113] text-white border border-red-700/60 shadow-[0_0_20px_rgba(220,38,38,0.15)]'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'}`
                                }
                            >
                                <Icon className={`w-4 h-4 ${'text-current'}`} /> {label}
                            </NavLink>
                        ))}

                        <div className="mt-auto space-y-2">
                            <div className="flex items-center gap-3 bg-[#131316] border border-white/10 rounded-xl px-3 py-2.5">
                                <div className="size-8 rounded-full bg-red-600 flex items-center justify-center">
                                    <UserRound className="w-4 h-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">{profile.display_name ?? 'Operador'}</p>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{profile.role}</p>
                                </div>
                            </div>
                            <button
                                className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white bg-[#131316] border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/5"
                                onClick={async () => { await supabase.auth.signOut(); navigate('/dashboard/login'); }}
                            >
                                <LogOut className="w-4 h-4" /> {dt('logout')}
                            </button>
                        </div>
                    </nav>
                    <main className="flex-1 min-w-0 overflow-auto bg-[#050505]">
                        <Outlet />
                    </main>
                </div>
            </div>
        </Ctx.Provider>
    );
}
