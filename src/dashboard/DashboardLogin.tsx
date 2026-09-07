import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getDashboardProfile } from './dashboardService';
import { dt } from './i18n';
import { ShieldAlert } from 'lucide-react';

// Cuentas del panel. El usuario solo escribe la CONTRASEÑA; ésta determina la
// cuenta (identidad interna). Por dentro sigue siendo Supabase Auth + RLS.
const GOD_ACCOUNTS = [
    'god@redcarpet.app',            // CEO — superadmin (mundial)
    'demo.valencia@redcarpet.app',  // València — city_admin
];

export default function DashboardLogin() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(false);

        // Probamos la contraseña contra cada cuenta; la correcta entra.
        let signedIn = false;
        for (const email of GOD_ACCOUNTS) {
            const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
            if (!authErr) { signedIn = true; break; }
        }
        if (!signedIn) {
            setError(true);
            setBusy(false);
            return;
        }
        // solo usuarios con fila en dashboard_users pueden entrar
        const profile = await getDashboardProfile();
        if (!profile) {
            await supabase.auth.signOut();
            setError(true);
            setBusy(false);
            return;
        }
        navigate('/dashboard', { replace: true });
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
            <form onSubmit={submit}
                className="bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-[0_0_60px_rgba(220,38,38,0.08)] p-10 w-full max-w-md">
                <div className="flex flex-col items-center mb-8">
                    <div className="size-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_8px_30px_rgba(220,38,38,0.45)] rotate-[-4deg] mb-5">
                        <ShieldAlert className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tight text-white">
                        Red<span className="text-red-500">Carpet</span>
                    </h1>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-bold mt-1">
                        {dt('login_title')}
                    </p>
                </div>

                <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-2">
                    {dt('login_password')}
                </label>
                <input
                    type="password" required value={password} autoComplete="current-password"
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#131316] border border-white/10 rounded-xl px-4 py-3 mb-5 text-white font-semibold placeholder-zinc-600 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                />
                {error && (
                    <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 mb-5">
                        <p className="text-sm text-red-400 font-semibold">{dt('login_error')}</p>
                    </div>
                )}
                <button
                    type="submit" disabled={busy}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-full py-3 font-black uppercase tracking-[0.2em] text-sm shadow-[0_6px_25px_rgba(220,38,38,0.4)] transition-colors"
                >
                    {busy ? dt('loading') : dt('login_submit')}
                </button>

                <p className="text-center text-[11px] text-zinc-600 mt-8 leading-relaxed">
                    Acceso restringido a organismos gubernamentales<br />y fuerzas de seguridad ciudadana.
                </p>
            </form>
        </div>
    );
}
