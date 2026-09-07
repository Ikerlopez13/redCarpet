import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

// MISMAS categorías, colores e iconos que el selector de la app
// (ReportDangerModal). Guardamos en danger_zones con el MISMO formato de
// description ("Etiqueta - SUBTÍTULO") para que la app las pinte idénticas.
const TYPES = [
    { dbType: 'dark', icon: 'lightbulb', label: 'Poca luz', subtitle: 'BAJA VISIBILIDAD', color: '#eab308' },
    { dbType: 'incident', icon: 'warning', label: 'Ambiente Inseguro', subtitle: 'PELIGRO', color: '#ef4444' },
    { dbType: 'incident', icon: 'accessible', label: 'Acceso limitado', subtitle: 'MOVILIDAD REDUCIDA', color: '#a855f7' },
    { dbType: 'incident', icon: 'wheelchair_pickup', label: 'Acceso seguro', subtitle: 'MOVILIDAD REDUCIDA', color: '#22c55e' },
    { dbType: 'incident', icon: 'diversity_3', label: 'Zona inclusiva', subtitle: 'INCLUSIVIDAD', color: '#ec4899' },
    { dbType: 'incident', icon: 'block', label: 'Calle cortada', subtitle: 'VIALIDAD', color: '#f97316' },
    { dbType: 'incident', icon: 'construction', label: 'Calle en mal estado', subtitle: 'VIALIDAD', color: '#14b8a6' },
    { dbType: 'incident', icon: 'shield', label: 'Autoridades presentes', subtitle: 'SEGURIDAD', color: '#3b82f6' },
] as const;

interface Props {
    location: { lat: number; lng: number };
    cityId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function IncidencePicker({ location, cityId, onClose, onSaved }: Props) {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');

    const create = async (t: typeof TYPES[number]) => {
        setBusy(t.label);
        setError('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Sesión no válida');
            const { error: err } = await supabase.from('danger_zones').insert({
                reporter_id: user.id,
                lat: location.lat,
                lng: location.lng,
                radius: 100,
                type: t.dbType,
                description: `${t.label} - ${t.subtitle}`, // formato idéntico a la app
                city_id: cityId,
                expires_at: null, // PERMANENTE: no desaparece para los usuarios
                origen: 'admin',  // marca de panel → la purga no la borra
                votes_up: 0,
                votes_down: 0,
            });
            if (err) throw err;
            onSaved();
        } catch (e: any) {
            setError(e?.message ?? 'Error');
            setBusy(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[#121216] rounded-[2rem] p-6 shadow-2xl border border-white/10">
                <div className="text-center mb-5">
                    <div className="size-14 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-3xl font-black">campaign</span>
                    </div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Publicar Incidencia</h3>
                    <p className="text-[11px] text-zinc-500 font-medium mt-1">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {TYPES.map((t) => (
                        <button
                            key={t.label}
                            onClick={() => create(t)}
                            disabled={!!busy}
                            style={{ borderColor: `${t.color}40` }}
                            className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] border bg-[#18181f]/80 text-white/80 hover:bg-white/5 active:scale-[0.98] transition-all h-[120px] disabled:opacity-40"
                        >
                            <div className="size-10 rounded-full flex items-center justify-center mb-2"
                                style={{ backgroundColor: `${t.color}1f`, color: t.color }}>
                                <span className="material-symbols-outlined text-lg font-bold">{t.icon}</span>
                            </div>
                            <span className="text-[13px] font-bold text-white leading-tight text-center">{t.label}</span>
                            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/40 mt-0.5">{t.subtitle}</span>
                        </button>
                    ))}
                </div>

                {error && (
                    <p className="text-red-400 text-xs font-bold text-center mt-4">{error}</p>
                )}

                <button onClick={onClose} className="w-full mt-4 py-3 text-white/40 text-xs uppercase tracking-widest font-bold">
                    Cancelar
                </button>
            </div>
        </div>
    );
}
