import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

type AuthMode = 'login' | 'register';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, register, loginWithGoogle, loginWithApple, loginAsDemo, isLoading } = useAuth();

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        let result;
        if (mode === 'login') {
            result = await login(email, password);
        } else {
            if (!fullName.trim()) {
                setError('Por favor ingresa tu nombre');
                return;
            }
            result = await register(email, password, fullName);
        }

        if (result.error) {
            setError(result.error);
        } else {
            navigate('/');
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        const { error } = await loginWithGoogle();
        if (error) setError(error);
    };

    const handleAppleLogin = async () => {
        setError(null);
        const { error } = await loginWithApple();
        if (error) setError(error);
    };

    // Demo login for development - uses mock data, no Supabase
    const handleDemoLogin = async () => {
        await loginAsDemo();
        navigate('/');
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
            {/* Header with logo */}
            <div className="flex flex-col items-center pt-16 pb-8">
                <div className="size-20 rounded-3xl bg-primary/20 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        shield
                    </span>
                </div>
                <h1 className="text-2xl font-bold">RedCarpet</h1>
                <p className="text-white/50 text-sm">Tu seguridad, siempre contigo</p>
            </div>

            {/* Form */}
            <div className="flex-1 px-6 overflow-y-auto">
                {/* Mode Toggle */}
                <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                    <button
                        onClick={() => setMode('login')}
                        className={clsx(
                            "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                            mode === 'login' ? "bg-primary text-white" : "text-white/50"
                        )}
                    >
                        Iniciar sesión
                    </button>
                    <button
                        onClick={() => setMode('register')}
                        className={clsx(
                            "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                            mode === 'register' ? "bg-primary text-white" : "text-white/50"
                        )}
                    >
                        Crear cuenta
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {mode === 'register' && (
                        <div>
                            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1 block">
                                Nombre completo
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Ej: María García"
                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1 block">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1 block">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                Cargando...
                            </span>
                        ) : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/30 text-sm">o continúa con</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Social Login */}
                <div className="flex gap-3">
                    <button
                        onClick={handleGoogleLogin}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <svg className="size-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="font-semibold text-sm">Google</span>
                    </button>
                    <button
                        onClick={handleAppleLogin}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <svg className="size-5" viewBox="0 0 24 24" fill="white">
                            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                        </svg>
                        <span className="font-semibold text-sm">Apple</span>
                    </button>
                </div>

                {/* Demo Login */}
                <button
                    onClick={handleDemoLogin}
                    className="w-full mt-4 py-3 text-primary font-semibold text-sm hover:underline"
                >
                    🚀 Probar demo sin cuenta
                </button>

                {/* Terms */}
                <p className="text-center text-white/30 text-xs mt-6 mb-8">
                    Al continuar, aceptas nuestros{' '}
                    <a href="/terms" className="text-primary">Términos de uso</a>
                    {' '}y{' '}
                    <a href="/privacy" className="text-primary">Política de privacidad</a>
                </p>
            </div>
        </div>
    );
};
