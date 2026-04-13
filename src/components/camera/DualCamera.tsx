import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface DualCameraProps {
    className?: string;
    onStreamsReady?: (backStream: MediaStream, frontStream: MediaStream) => void;
}

export const DualCamera: React.FC<DualCameraProps> = ({ className, onStreamsReady }) => {
    const backVideoRef = useRef<HTMLVideoElement>(null);
    const frontVideoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const startCameras = async () => {
            try {
                // 1. Obtener lista de dispositivos
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                
                // 2. Identificar cámaras (Trata de buscar 'back' y 'front' en las etiquetas)
                const back = videoDevices.find(d => /back|environment/i.test(d.label)) || videoDevices[0];
                const front = videoDevices.find(d => /front|user/i.test(d.label)) || videoDevices[1];

                if (!back || !front) {
                    throw new Error("No se encontraron ambas cámaras.");
                }

                // 3. Solicitar streams simultáneos
                const [backStream, frontStream] = await Promise.all([
                    navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: back.deviceId } } }),
                    navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: front.deviceId } } })
                ]);

                // 4. Asignar a elementos <video> mediante refs
                if (backVideoRef.current) backVideoRef.current.srcObject = backStream;
                if (frontVideoRef.current) frontVideoRef.current.srcObject = frontStream;

                if (onStreamsReady) {
                    onStreamsReady(backStream, frontStream);
                }

            } catch (err) {
                console.error("Error accediendo a cámaras:", err);
                setError(err instanceof Error ? err.message : "Error al acceder a las cámaras");
            }
        };

        startCameras();

        return () => {
            // Cleanup: stop all tracks when component unmounts
            if (backVideoRef.current?.srcObject) {
                (backVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
            if (frontVideoRef.current?.srcObject) {
                (frontVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-900 rounded-[40px] text-white/50 p-6 text-center">
                <span className="material-symbols-outlined text-5xl mb-4">videocam_off</span>
                <p className="text-sm font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div className={clsx("relative w-full h-full rounded-[40px] overflow-hidden bg-black", className)}>
            {/* Back Camera (Full) */}
            <video 
                ref={backVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover" 
            />
            
            {/* Front Camera (Floating) */}
            <div className="absolute top-4 left-4 w-1/3 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-30">
                <video 
                    ref={frontVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover bg-zinc-800"
                />
            </div>
        </div>
    );
};
