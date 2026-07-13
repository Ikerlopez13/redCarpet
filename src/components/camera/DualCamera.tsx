import React, { useState } from 'react';
import { Camera, Check, X, RefreshCw, Loader2, ShieldAlert } from 'lucide-react';
import { captureBeRealDual } from '../../services/cameraService';
import clsx from 'clsx';

interface DualCameraProps {
    className?: string;
    onCaptureComplete?: (base64: string) => void;
    onClose?: () => void;
}

export const DualCamera: React.FC<DualCameraProps> = ({ className, onCaptureComplete, onClose }) => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCapture = async () => {
        try {
            setIsCapturing(true);
            setError(null);
            
            // Execute the BeReal Dual Protocol
            const combinedBase64 = await captureBeRealDual({ quality: 70 });
            
            setCapturedImage(combinedBase64);
        } catch (err) {
            console.error('[DualCamera] Capture error:', err);
            setError('Error al capturar. Inténtalo de nuevo.');
        } finally {
            setIsCapturing(false);
        }
    };

    const handleConfirm = () => {
        if (capturedImage && onCaptureComplete) {
            onCaptureComplete(capturedImage);
        }
    };

    const handleRetry = () => {
        setCapturedImage(null);
        setError(null);
    };

    return (
        <div className={clsx("relative w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl rounded-[40px] overflow-hidden border border-white/10", className)}>
            
            {/* Main View Area */}
            {capturedImage ? (
                /* PREVIEW OF RESULT */
                <div className="relative w-full h-full p-4 animate-scale-in">
                    <img 
                        src={capturedImage} 
                        alt="Captured Dual Proof" 
                        className="w-full h-full object-cover rounded-[32px] shadow-2xl border-2 border-white/20"
                    />
                    
                    {/* Controls for result */}
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6 z-50">
                        <button 
                            onClick={handleRetry}
                            className="size-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all"
                        >
                            <RefreshCw size={24} />
                        </button>
                        <button 
                            onClick={handleConfirm}
                            className="size-20 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/20 active:scale-90 transition-all"
                        >
                            <Check size={32} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            ) : (
                /* ACTIVE CAMERA OVERLAY */
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-6">
                    {/* Visual Indicator of what will happen */}
                    <div className="relative size-32 mb-4">
                        <div className="absolute inset-0 rounded-3xl bg-red-600/20 animate-pulse border-2 border-red-600/40" />
                        <div className="absolute top-2 left-2 size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                            <Camera size={20} className="text-white/40" />
                        </div>
                        <div className="w-full h-full flex items-center justify-center">
                            <ShieldAlert size={48} className="text-red-500" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">PRUEBA DE SEGURIDAD</h2>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed max-w-[200px] mx-auto">
                            Se capturará una imagen con ambas cámaras para el registro de emergencia.
                        </p>
                    </div>

                    <div className="pt-8">
                        <button
                            onClick={handleCapture}
                            disabled={isCapturing}
                            className={clsx(
                                "group relative size-24 flex items-center justify-center transition-all duration-500",
                                isCapturing ? "scale-90 opacity-50" : "active:scale-95"
                            )}
                        >
                            <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-10" />
                            <div className="relative size-full rounded-full bg-white flex items-center justify-center shadow-2xl">
                                {isCapturing ? (
                                    <Loader2 size={32} className="text-red-600 animate-spin" />
                                ) : (
                                    <div className="size-8 bg-black rounded-lg" />
                                )}
                            </div>
                        </button>
                        <p className="mt-4 text-white/20 font-black text-[9px] uppercase tracking-[0.3em]">
                            {isCapturing ? 'CAPTURANDO...' : 'PULSA PARA CAPTURAR'}
                        </p>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="absolute bottom-24 px-6 py-3 bg-red-500/20 border border-red-500/40 rounded-2xl backdrop-blur-xl text-red-500 text-xs font-bold animate-shake">
                    {error}
                </div>
            )}

            {/* Top Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-black/20 rounded-full text-white/40 hover:text-white"
            >
                <X size={24} />
            </button>
        </div>
    );
};

