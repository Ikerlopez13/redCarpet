import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const CONFIRMED_KEY = 'location_always_confirmed';

interface Props {
    children: React.ReactNode;
}

export function LocationPermissionGate({ children }: Props) {
    const { t } = useTranslation();
    const [modal, setModal] = useState<'need-always' | 'denied' | null>(null);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        check();
    }, []);

    const check = async () => {
        const { value } = await Preferences.get({ key: CONFIRMED_KEY });
        if (value === 'true') return;

        try {
            const { location } = await Geolocation.checkPermissions();
            if (location === 'denied') {
                setModal('denied');
            } else {
                setModal('need-always');
            }
        } catch {
            setModal('need-always');
        }
    };

    const confirmed = async () => {
        await Preferences.set({ key: CONFIRMED_KEY, value: 'true' });
        setModal(null);
    };

    const openSettings = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).cordova?.plugins?.diagnostic?.switchToSettings?.();
        setModal(null);
    };

    if (modal === 'need-always') {
        return (
            <>
                {children}
                <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a2e] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-white/10">
                        <div className="text-4xl mb-3 text-center">📍</div>
                        <h2 className="text-white text-xl font-bold text-center mb-2">{t('locperm.always_title')}</h2>
                        <p className="text-white/70 text-sm text-center mb-5">
                            {t('locperm.always_desc')}
                        </p>
                        <p className="text-white/50 text-xs text-center mb-5">
                            {t('locperm.always_hint')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmed}
                                className="flex-1 py-3 rounded-2xl bg-white/10 text-white/60 font-semibold text-sm"
                            >
                                {t('locperm.later')}
                            </button>
                            <button
                                onClick={() => { openSettings(); }}
                                className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm"
                            >
                                {t('locperm.go_settings')}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (modal === 'denied') {
        return (
            <>
                {children}
                <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a2e] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-white/10">
                        <div className="text-4xl mb-3 text-center">🔒</div>
                        <h2 className="text-white text-xl font-bold text-center mb-2">{t('locperm.denied_title')}</h2>
                        <p className="text-white/70 text-sm text-center mb-5">
                            {t('locperm.denied_desc')}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={confirmed} className="flex-1 py-3 rounded-2xl bg-white/10 text-white/60 font-semibold text-sm">
                                {t('common.cancel')}
                            </button>
                            <button onClick={openSettings} className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm">
                                {t('locperm.settings')}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return <>{children}</>;
}
