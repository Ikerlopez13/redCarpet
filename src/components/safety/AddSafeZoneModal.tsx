import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { getCurrentPosition } from '../../services/locationService';
import { searchPlaces, type GeocodingResult } from '../../services/geocodingService';
import clsx from 'clsx';

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

    // Address Search State
    const [addressQuery, setAddressQuery] = useState('');
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Handle address search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (addressQuery.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                // Get current position for proximity search
                const position = await getCurrentPosition().catch(() => null);
                const proximity = position ? { lat: position.coords.latitude, lng: position.coords.longitude } : undefined;
                
                const results = await searchPlaces(addressQuery, proximity);
                setSuggestions(results);
                setShowSuggestions(results.length > 0);
            } catch (err) {
                console.error('Error searching address:', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [addressQuery]);

    const handleSelectSuggestion = (suggestion: GeocodingResult) => {
        setSelectedLocation({
            lat: suggestion.lat,
            lng: suggestion.lng,
            name: suggestion.name
        });
        setAddressQuery(suggestion.name);
        setSuggestions([]);
        setShowSuggestions(false);
        if (!name) setName(suggestion.name);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        if (!familyId || familyId.trim() === "") {
            throw new Error("Sesión no válida");
        }
        setIsLoading(true);
        setError(null);

        try {
            let latitude: number;
            let longitude: number;

            if (selectedLocation) {
                latitude = selectedLocation.lat;
                longitude = selectedLocation.lng;
            } else {
                // Fallback to current location if no address selected
                const position = await getCurrentPosition();
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
            }

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
            setAddressQuery('');
            setSelectedLocation(null);
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
            <div className="bg-[#121212] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white tracking-tight">Agregar Zona Segura</h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-white/60">close</span>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-5 mb-8">
                    {/* Name Input */}
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nombre del lugar</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Casa, Escuela, Parque..."
                            className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 transition-all font-medium"
                        />
                    </div>

                    {/* Address Search Input */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Buscar Dirección</label>
                        <div className={clsx(
                            "flex items-center gap-3 bg-zinc-900 border rounded-2xl p-4 transition-all",
                            showSuggestions ? "border-primary/50 rounded-b-none" : "border-white/5",
                            selectedLocation && !showSuggestions && "border-green-500/30"
                        )}>
                            <span className={clsx(
                                "material-symbols-outlined text-lg",
                                selectedLocation ? "text-green-500" : "text-zinc-500"
                            )}>
                                {selectedLocation ? 'check_circle' : 'search'}
                            </span>
                            <input
                                type="text"
                                value={addressQuery}
                                onChange={(e) => {
                                    setAddressQuery(e.target.value);
                                    if (selectedLocation) setSelectedLocation(null);
                                }}
                                onFocus={() => addressQuery.length >= 3 && setShowSuggestions(true)}
                                placeholder="Escribe una dirección..."
                                className="flex-1 bg-transparent text-white placeholder-zinc-700 outline-none text-sm font-medium"
                            />
                            {isSearching && (
                                <div className="size-4 border-2 border-primary/50 border-t-transparent rounded-full animate-spin" />
                            )}
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && (
                            <div className="absolute left-0 right-0 top-full bg-zinc-900 border border-white/10 border-t-0 rounded-b-2xl overflow-hidden shadow-2xl z-50">
                                {suggestions.map((suggestion) => (
                                    <div
                                        key={suggestion.id}
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-t border-white/5"
                                    >
                                        <p className="text-white text-sm font-medium truncate">{suggestion.name}</p>
                                        <p className="text-zinc-500 text-xs truncate">{suggestion.address}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Radius Slider */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Radio de seguridad</label>
                            <span className="text-primary font-black text-sm">{radius}m</span>
                        </div>
                        <input
                            type="range"
                            min="50"
                            max="1000"
                            step="50"
                            value={radius}
                            onChange={(e) => setRadius(Number(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary mb-2"
                        />
                        <p className="text-[10px] text-zinc-500 font-medium">
                            {selectedLocation
                                ? `Se creará la zona en: ${selectedLocation.name}`
                                : "Se usará tu ubicación actual si no seleccionas una dirección."}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl font-bold bg-white/5 text-white hover:bg-white/10 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !name.trim()}
                        className={clsx(
                            "flex-[2] py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95",
                            isLoading || !name.trim()
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-primary text-white shadow-xl shadow-primary/20 hover:brightness-110'
                        )}
                    >
                        {isLoading ? (
                            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add_location</span>
                                Guardar Zona
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
