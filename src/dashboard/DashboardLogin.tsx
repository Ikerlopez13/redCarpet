import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getDashboardProfile } from './dashboardService';
import { dt } from './i18n';
import { ShieldCheck } from 'lucide-react';

export default function DashboardLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(false);
        const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) {
            setError(true);
            setBusy(false);
            return;
        }
        // only users with a dashboard_users row may enter
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
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <form onSubmit={submit} className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm">
                <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="w-8 h-8 text-red-600" />
                    <div>
                        <h1 className="font-semibold text-slate-900">{dt('login_title')}</h1>
                        <p className="text-xs text-slate-500">Red Carpet · Ajuntament de València</p>
                    </div>
                </div>
                <label className="block text-sm text-slate-600 mb-1">{dt('login_email')}</label>
                <input
                    type="email" required value={email} autoComplete="username"
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <label className="block text-sm text-slate-600 mb-1">{dt('login_password')}</label>
                <input
                    type="password" required value={password} autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {error && <p className="text-sm text-red-600 mb-3">{dt('login_error')}</p>}
                <button
                    type="submit" disabled={busy}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg py-2 font-medium"
                >
                    {busy ? dt('loading') : dt('login_submit')}
                </button>
            </form>
        </div>
    );
}
