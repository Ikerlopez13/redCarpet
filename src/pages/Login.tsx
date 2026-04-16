import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, register, loginWithGoogle, loginWithApple, loginAsDemo, resetPassword, isLoading } = useAuth();

    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [resetSent, setResetSent] = useState(false);
    const [registerSuccess, setRegisterSuccess] = useState(false);
    const { user } = useAuth();

    // Auto-redirect if already logged in AND confirmed (handles OAuth success case)
    React.useEffect(() => {
        if (user && user.email_confirmed_at) {
            navigate('/', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'forgot-password') {
            const { error: resetErr } = await resetPassword(email);
            if (resetErr) setError(resetErr);
            else setResetSent(true);
            return;
        }

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
            if (mode === 'register') {
                setRegisterSuccess(true);
            } else {
                navigate('/');
            }
        }
    };

    if (resetSent || registerSuccess) {
        const isReset = resetSent;
        return (
            <div className="flex flex-col h-full w-full bg-background-dark text-white items-center justify-center p-6 text-center animate-fade-in">
                <div 
                    className={clsx(
                        "size-20 rounded-[2rem] flex items-center justify-center mb-6 animate-scale-in",
                        isReset ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary"
                    )}
                >
                    <span className="material-symbols-outlined text-4xl">{isReset ? 'mail' : 'verified_user'}</span>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">
                    {isReset ? 'Correo Enviado' : '¡Cuenta Creada!'}
                </h2>
                <p className="text-white/60 text-sm mb-12 max-w-[280px]">
                    {isReset 
                        ? 'Revisa tu bandeja de entrada. Te hemos enviado un enlace para restablecer tu contraseña.'
                        : 'Para activar tu cuenta, por favor revisa tu bandeja de entrada y confirma tu correo electrónico.'}
                </p>
                <button
                    onClick={() => {
                        setResetSent(false);
                        setRegisterSuccess(false);
                        setMode('login');
                    }}
                    className="w-full max-w-xs h-14 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all text-white"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
            {/* Header with logo */}
            <div className="flex flex-col items-center pt-16 pb-8 shrink-0">
                <div 
                    className="size-20 rounded-3xl bg-primary/20 flex items-center justify-center mb-4 animate-scale-in"
                >
                    <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        shield
                    </span>
                </div>
                <h1 
                    className="text-2xl font-bold tracking-tight animate-fade-in"
                >
                    RedCarpet
                </h1>
                <p 
                    className="text-white/50 text-sm animate-fade-in"
                    style={{ animationDelay: '200ms' }}
                >
                    Tu seguridad, siempre contigo
                </p>
            </div>

            {/* Form Container */}
            <div className="flex-1 px-8 overflow-y-auto no-scrollbar flex flex-col">
                
                {/* Mode Switcher */}
                {mode !== 'forgot-password' && (
                    <div className="flex bg-white/5 rounded-2xl p-1 mb-8 shrink-0">
                        <button
                            onClick={() => setMode('login')}
                            className={clsx(
                                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                                mode === 'login' ? "bg-white text-black shadow-lg" : "text-white/40"
                            )}
                        >
                            Ingresar
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className={clsx(
                                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                                mode === 'register' ? "bg-white text-black shadow-lg" : "text-white/40"
                            )}
                        >
                            Registro
                        </button>
                    </div>
                )}

                {mode === 'forgot-password' && (
                    <button 
                        onClick={() => setMode('login')}
                        className="flex items-center gap-2 text-white/40 mb-6 font-bold text-sm"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Volver al Login
                    </button>
                )}

                <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-2">
                    {mode === 'login' ? 'Bienvenida' : mode === 'register' ? 'Crea tu Cuenta' : 'Recuperar Cuenta'}
                </h2>
                <p className="text-white/40 text-sm mb-8 leading-tight">
                    {mode === 'login' 
                        ? 'Accede a tu red de protección ciudadana.' 
                        : mode === 'register' 
                            ? 'Únete para proteger y ser protegida.' 
                            : 'Te enviaremos un código para restablecer tu acceso.'}
                </p>

                {error && (
                    <div 
                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-bold mb-6 flex items-center gap-3 animate-scale-in"
                    >
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                        <div
                            className="space-y-1.5 animate-slide-up"
                        >
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Nombre Completo</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/20 group-focus-within:text-primary transition-colors text-xl">person</span>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10 font-bold"
                                    placeholder="Ej: Maria Garcia"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Email de Acceso</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/20 group-focus-within:text-primary transition-colors text-xl">mail</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10 font-bold"
                                placeholder="tu@email.com"
                                required
                            />
                        </div>
                    </div>

                    {mode !== 'forgot-password' && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Contraseña</label>
                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('forgot-password')}
                                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                )}
                            </div>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/20 group-focus-within:text-primary transition-colors text-xl">lock</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10 font-bold"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-16 bg-primary text-white rounded-2xl font-black text-lg uppercase tracking-tight shadow-xl shadow-primary/20 hover:bg-primary/95 active:scale-[0.98] transition-all disabled:opacity-50 mt-6 flex items-center justify-center gap-3"
                    >
                        {isLoading ? (
                            <div className="size-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                {mode === 'login' ? 'Iniciar Sesión' : mode === 'register' ? 'Registrarme' : 'Recuperar Cuenta'}
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Social Login Options */}
                <div className="space-y-6 pt-8 pb-12">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/5"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]">
                            <span className="px-4 bg-background-dark text-white/20">O continúa con</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={async () => {
                                const { error } = await loginWithGoogle();
                                if (error) setError(error);
                                else navigate('/');
                            }}
                            className="h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="G" className="size-5 grayscale opacity-50" />
                            <span className="text-sm font-bold">Google</span>
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                const { error } = await loginWithApple();
                                if (error) setError(error);
                                else navigate('/');
                            }}
                            className="h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined text-white/50 text-xl">apple</span>
                            <span className="text-sm font-bold">Apple ID</span>
                        </button>
                    </div>

                {/* Support generic footer */}
                <div className="pt-8 pb-12 flex flex-col items-center gap-4">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest text-center leading-relaxed">
                        Al continuar, aceptas nuestros<br/>
                        <button onClick={() => navigate('/terms')} className="underline">Términos</button> y <button onClick={() => navigate('/privacy')} className="underline">Privacidad</button>.
                    </p>
                </div>
                </div>
            </div>
        </div>
    );
};
