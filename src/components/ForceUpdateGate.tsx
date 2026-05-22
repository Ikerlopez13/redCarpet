import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useTranslation } from 'react-i18next';
import { checkUpdateRequired } from '../services/updateService';


export const ForceUpdateGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [storeUrl, setStoreUrl] = useState<string | undefined>(undefined);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const verify = async () => {
            const result = await checkUpdateRequired();
            if (result.required) {
                setNeedsUpdate(true);
                setStoreUrl(result.storeUrl);
            }
            setIsChecking(false);
        };
        verify();

        const listener = App.addListener('appStateChange', (state) => {
            if (state.isActive) {
                verify();
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, []);

    const handleUpdateClick = async () => {
        if (storeUrl) {
            await Browser.open({ url: storeUrl });
        }
    };

    if (isChecking) {
        // Show a completely blank or standard loading screen while checking
        // to prevent rendering the app and then suddenly blocking it.
        return (
            <div className="fixed inset-0 bg-background-dark z-[9999] flex items-center justify-center">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (needsUpdate) {
        return (
            <div className="fixed inset-0 bg-background-dark z-[9999] flex flex-col items-center justify-center p-6 text-center animate-fade-in font-display">
                <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                        <img 
                            src="/logo.png" 
                            alt="RedCarpet Logo" 
                            className="w-32 h-32 rounded-3xl relative z-10 shadow-2xl border border-white/10"
                        />
                    </div>
                    
                    <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
                        {t('update.title', 'Actualización Obligatoria')}
                    </h1>
                    
                    <p className="text-gray-400 text-lg font-medium mb-12 leading-relaxed">
                        {t('update.description', 'Hemos lanzado una nueva versión con importantes mejoras de seguridad y corrección de errores. Para seguir protegiéndote, debes actualizar la aplicación ahora.')}
                    </p>

                    <button
                        onClick={handleUpdateClick}
                        className="w-full bg-white text-black h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl font-black">download</span>
                        {t('update.button', 'Actualizar Ahora')}
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
