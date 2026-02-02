import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export const Emergency: React.FC = () => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(3);
    const [isSent, setIsSent] = useState(false);
    const [showPinPad, setShowPinPad] = useState(false);
    const [pin, setPin] = useState("");

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setIsSent(true);
        }
    }, [countdown]);

    const handlePinEnter = (digit: string) => {
        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            if (newPin.length === 4) {
                // Simulate correct PIN check after a brief delay
                setTimeout(() => {
                    navigate('/');
                }, 300);
            }
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    if (!isSent) {
        // --- PRE-ACTIVATION COUNTDOWN (Existing View) ---
        return (
            <div className="relative flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display">
                {/* Background with Blur */}
                <div className="absolute inset-0 z-0">
                    <img
                        alt="A blurred city map showing navigation routes"
                        className="w-full h-full object-cover grayscale opacity-20"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLnewPuGUc9kUf6D6RfOO5TxbVxhF9M_hDNHiVkvUKPWWjbrWcNVbKeZPflW6TGdcht4RbIauq8yVB0q_fit_bMUPQ32xXJ2bfwcsRNfu_bOzVPemX_EtZACvLCEi-l8ipWntCMcufW2i_Kzxo9OKVrMOOdWmRJPO1r2JaJYqdhbXHvyffEQnvC1vcuuBhaQ30EoPLOm2L6VPXmRDUPHXsthXfj66gi3rpDFneQS9_UHU3WSlsB-3ojL52MQijGiUBrkaWsD9iYGg"
                    />
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-[40px]"></div>
                </div>

                {/* Red Border Overlay */}
                <div className="absolute inset-0 pointer-events-none border-[12px] border-primary/10 rounded-none z-20"></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full w-full overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center p-4 pb-2 justify-between mt-4">
                        <div className="text-primary flex size-12 shrink-0 items-center justify-start">
                            <span className="material-symbols-outlined text-[32px] fill-1">warning</span>
                        </div>
                        <h2 className="text-white text-lg font-bold leading-tight tracking-widest flex-1 text-center pr-12 font-display uppercase">
                            ALERTA DE EMERGENCIA
                        </h2>
                    </div>

                    {/* Main Countdown Area */}
                    <div className="flex-1 flex flex-col justify-center items-center px-6">
                        <div className="max-w-md w-full text-center">
                            <h1 className="text-white tracking-tight text-[32px] font-bold leading-tight pb-3 pt-6 font-display">
                                Notificando a Servicios de Emergencia en...
                            </h1>
                        </div>

                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="relative flex items-center justify-center">
                                {/* Pulsing Animations */}
                                <div className="absolute w-64 h-64 rounded-full border-4 border-primary/20 animate-ping duration-[1.5s]"></div>
                                <div className="absolute w-56 h-56 rounded-full border-2 border-primary/40"></div>

                                {/* Central Circle */}
                                <div className="flex h-48 w-48 items-center justify-center rounded-full border-4 bg-primary/10 border-primary transition-all duration-300">
                                    <p className="text-primary text-[120px] font-black leading-none tracking-tighter font-display">
                                        {countdown}
                                    </p>
                                </div>
                            </div>
                            <p className="text-primary text-xl font-bold mt-8 tracking-[0.2em] font-display uppercase">
                                SEGUNDOS
                            </p>
                        </div>

                        <div className="max-w-xs mx-auto text-center pb-12">
                            <p className="text-white/70 text-base font-normal leading-relaxed font-display">
                                Tu ubicación y perfil se compartirán con los equipos de respuesta local si no se cancela.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="w-full px-6 py-10 mb-6">
                        <div className="flex flex-col gap-4 max-w-md mx-auto">
                            <button
                                onClick={() => navigate('/')}
                                className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-20 px-5 bg-white text-background-dark text-xl font-black leading-normal tracking-wider font-display shadow-2xl active:scale-95 transition-transform"
                            >
                                <span className="truncate">CANCELAR ALERTA</span>
                            </button>
                            <div className="flex justify-center items-center gap-2 text-white/40">
                                <span className="material-symbols-outlined text-sm">lock</span>
                                <p className="text-[10px] font-bold uppercase tracking-widest">Mantener para detener</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- ACTIVE EMERGENCY VIEW ---
    return (
        <div className="relative flex flex-col h-full w-full bg-background-dark text-white overflow-hidden font-display shadow-[inset_0_0_0_4px_#FF3131]">

            {/* Live Feed Background (Fixed) */}
            <div className="absolute inset-0 z-0 bg-neutral-900">
                <div
                    className="w-full h-full bg-cover bg-center opacity-70"
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBfsAn6ppUAy7t-U3TIcraioAxVho7pwbM7ngg3FIJjzMP5UfNwxBHyWwS_u9uzfa6fYUzpxTBzo7wlWRVQYoQLCNJ7O6CA5w1fi9rBosZI-j3NuCUFzWNJa4ATTjVDj5dFQotS2STmbi2xa23JGi4n2KSBkN0tkcj_i0MJIUdDH58jpBl4aF9H7ET7kt6hwuJgYp-8Z0fJeCcRvYv_eWGRV7L2bsva0d7Ju4VAuduF4pZhRFXRGPKmhtrzV7Osz8KvhuBgqM61dYE')" }}
                ></div>
            </div>

            {/* Scrollable Content Wrapper */}
            <div className="relative z-10 flex flex-col h-full w-full overflow-y-auto pb-20">
                {/* Top Bar */}
                <div className="flex items-center bg-black/40 p-4 pb-2 justify-between backdrop-blur-md shrink-0">
                    <div className="text-white flex size-12 shrink-0 items-center">
                        <span className="material-symbols-outlined text-primary text-3xl">emergency_home</span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                        <h2 className="text-white text-lg font-bold leading-tight text-center uppercase">EMERGENCIA ACTIVA</h2>
                        <div className="flex items-center gap-1">
                            <div className="size-2 rounded-full bg-primary animate-pulse"></div>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-primary">GRABANDO 04:22</p>
                        </div>
                    </div>
                    <div className="flex w-12 items-center justify-end">
                        <button className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm">
                            <span className="material-symbols-outlined">videocam</span>
                        </button>
                    </div>
                </div>

                {/* Upload Status */}
                <div className="flex flex-col gap-1 p-4 bg-black/20 backdrop-blur-[2px] shrink-0">
                    <div className="flex gap-6 justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-xs text-primary">cloud_upload</span>
                            <p className="text-white text-xs font-medium leading-normal uppercase tracking-wider">TRANSMITIENDO EN VIVO</p>
                        </div>
                        <p className="text-white text-[10px] font-bold leading-normal uppercase">SUBIENDO</p>
                    </div>
                    <div className="h-1 rounded bg-white/20 overflow-hidden">
                        <div className="h-full bg-primary w-[85%] animate-pulse"></div>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="flex flex-wrap gap-3 p-4 shrink-0">
                    <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl p-4 bg-black/50 backdrop-blur-md border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                            <p className="text-white/70 text-[10px] uppercase font-bold tracking-wider">ESTADO</p>
                        </div>
                        <p className="text-white tracking-tight text-lg font-bold leading-tight">GPS Compartido</p>
                    </div>
                    <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl p-4 bg-black/50 backdrop-blur-md border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-primary text-sm">group_add</span>
                            <p className="text-white/70 text-[10px] uppercase font-bold tracking-wider">PRIVACIDAD</p>
                        </div>
                        <p className="text-white tracking-tight text-lg font-bold leading-tight">5 Contactos Notificados</p>
                    </div>
                </div>

                {/* Map Snippet */}
                <div className="px-4 mt-auto mb-4 shrink-0">
                    <div className="rounded-xl overflow-hidden h-24 border border-white/20 relative shadow-2xl">
                        <div
                            className="absolute inset-0 bg-neutral-800 bg-cover bg-center"
                            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuByOfIGrqsQjcjGWxCMC2_EcoN1ELVwaFiNw6tbdYCrGq-rr7uKxiyYu9MVIzUPyVB7VZP1kThxD_R5r2kn_-IEV4VZ_WW828hzym3tfUXmby3bCqFglyurfWvfhwlujCp0VXLXMeAVv6IJWlu_dxap0oy0Ipun1z6V9d9KXuLUwnjwCVmjjiWJVl-xAYHARb1noYzcBUR0rdZcKIlpBe69jD8vAva9G5xLuOlC6NxBsz11iqzWSz0O6503gLyOdOeXCiHgoVg6lm0')" }}
                        ></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                            <p className="text-white text-xs font-medium">123 Safety Way, Los Angeles, CA</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col gap-4 p-4 pb-8 bg-gradient-to-t from-black/80 to-transparent shrink-0">
                    <div className="flex flex-col gap-3">
                        <p className="text-white/60 text-xs text-center px-6">
                            Los equipos de emergencia y tus contactos de confianza tienen acceso a tu audio, video y ubicación en vivo.
                        </p>
                        <button
                            onClick={() => setShowPinPad(true)}
                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-16 bg-primary text-white gap-3 text-lg font-bold leading-normal tracking-wide shadow-lg active:scale-95 transition-transform"
                        >
                            <span className="material-symbols-outlined font-bold">lock_open</span>
                            FINALIZAR EMERGENCIA
                        </button>
                    </div>
                </div>
            </div>

            {/* PIN Pad Drawer */}
            <div className={clsx(
                "absolute inset-x-0 bottom-0 z-50 bg-background-dark/95 backdrop-blur-xl rounded-t-3xl p-8 border-t border-white/10 transition-transform duration-300 ease-out",
                showPinPad ? "translate-y-0" : "translate-y-full"
            )}>
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-8" onClick={() => setShowPinPad(false)}></div>
                <h3 className="text-center text-xl font-bold mb-2">Ingrese el PIN de Desactivación</h3>
                <p className="text-center text-white/60 text-sm mb-8">Esto evita la desactivación accidental o forzada.</p>

                {/* PIN Dots */}
                <div className="flex justify-center gap-4 mb-10">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={clsx(
                                "size-4 rounded-full border-2 transition-colors",
                                i < pin.length ? "bg-primary border-primary" : "border-white/20"
                            )}
                        ></div>
                    ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-6 max-w-xs mx-auto mb-8">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handlePinEnter(num.toString())}
                            className="flex items-center justify-center size-16 rounded-full bg-white/5 text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all"
                        >
                            {num}
                        </button>
                    ))}
                    <div className="col-start-2">
                        <button
                            onClick={() => handlePinEnter('0')}
                            className="flex items-center justify-center size-16 rounded-full bg-white/5 text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all"
                        >
                            0
                        </button>
                    </div>
                    <div className="col-start-3">
                        <button
                            onClick={handleBackspace}
                            className="flex items-center justify-center size-16 rounded-full text-white/40 hover:text-white active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined">backspace</span>
                        </button>
                    </div>
                </div>

                <div className="flex w-full justify-center">
                    <button
                        onClick={() => setShowPinPad(false)}
                        className="py-4 text-white/40 font-bold uppercase tracking-widest hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

        </div>
    );
};
