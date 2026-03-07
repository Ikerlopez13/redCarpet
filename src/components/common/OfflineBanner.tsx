import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const OfflineBanner: React.FC = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute top-0 left-0 right-0 z-[100] bg-safety-red/90 backdrop-blur-md text-white px-4 py-3 pb-4 safe-area-top shadow-lg"
                >
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <span className="material-symbols-outlined text-xl">wifi_off</span>
                        <span className="font-semibold text-sm">Sin conexión a Internet</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
