import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { getCurrentPosition } from '../../services/locationService';

interface AddSafeZoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    familyId: string;
    onSuccess: () => void;
}

export function AddSafeZoneModal({ isOpen, onClose, familyId, onSuccess }: AddSafeZoneModalProps) {
    const [name, setName] = useState('');
    const [radius, setRadius] = useState(100);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        setError(null);

        try {
            // Get current location
            const position = await getCurrentPosition();
            const { latitude, longitude } = position.coords;

            // Save to DB
            const { error: dbError } = await (supabase
                .from('safe_zones') as any)
                .insert({
                    family_id: familyId,
                    name: name.trim(),
                    lat: latitude,
                    lng: longitude,
                    radius: radius
                });

            if (dbError) throw dbError;

            onSuccess();
            onClose();
            setName('');
            setRadius(100);
        } catch (err: any) {
            console.error('Error adding safe zone:', err);
            setError(err.message || 'Error al guardar la zona segura');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Agregar Zona Segura</h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined text-white/60">close</span>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Nombre del lugar</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Casa, Escuela, Oficina..."
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-sm text-zinc-400">Radio de seguridad</label>
                            <span className="text-primary font-bold text-sm">{radius}m</span>
                        </div>
                        <input
                            type="range"
                            min="50"
                            max="1000"
                            step="50"
                            value={radius}
                            onChange={(e) => setRadius(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                            Se usará tu ubicación actual para crear esta zona.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isLoading || !name.trim()}
                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isLoading || !name.trim()
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-primary text-white shadow-lg shadow-primary/20'
                        }`}
                >
                    {isLoading ? (
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    ) : (
                        <>
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                            Guardar Zona
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
