import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { calculateDistance } from '../../services/poiService';
import type { DangerZone } from '../../services/database.types';

interface NightModeWarningProps {
    userLat: number;
    userLng: number;
}

export function NightModeWarning({ userLat, userLng }: NightModeWarningProps) {
    const [warning, setWarning] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (userLat === 0 || userLng === 0) return;
        checkContextualSafety();
    }, [userLat, userLng]);

    const checkContextualSafety = async () => {
        const hour = new Date().getHours();
        const isNight = hour >= 20 || hour < 6;

        if (!isNight) {
            setIsVisible(false);
            return;
        }

        // Check distance to conflict zones (type='dark' or 'unsafe')
        // In a real app, this should be geospatial query. 
        // For now, we fetch all zones (assuming small dataset) or use a cached list.
        const { data } = await supabase
            .from('danger_zones')
            .select('*')
            .in('type', ['dark', 'unsafe'])
            .or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`);

        const zones = data as DangerZone[] | null;

        if (zones) {
            const nearRiskyZone = zones.find(z => {
                const dist = calculateDistance(userLat, userLng, z.lat, z.lng);
                return dist < 150; // Within 150 meters
            });

            if (nearRiskyZone) {
                setWarning("Esta calle es segura de día, pero no de noche. Mantente alerta.");
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        }
    };

    if (!isVisible || !warning) return null;

    return (
        <div className="absolute top-24 left-4 right-4 z-40 animate-slide-down">
            <div className="bg-black/80 backdrop-blur-md border border-purple-500/50 text-white p-3 rounded-xl flex items-start gap-3 shadow-2xl shadow-purple-900/20">
                <div className="bg-purple-500/20 p-2 rounded-full shrink-0">
                    <span className="material-symbols-outlined text-purple-400 text-xl">nights_stay</span>
                </div>
                <div>
                    <h4 className="font-bold text-sm text-purple-300">Modo Noche Activado</h4>
                    <p className="text-xs text-white/90 mt-0.5">{warning}</p>
                </div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="ml-auto text-white/40 hover:text-white"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
        </div>
    );
}
