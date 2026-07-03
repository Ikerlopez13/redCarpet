// Data layer for the authorities dashboard (Task 5 — València sandbox).
// All queries are city-scoped SERVER-SIDE by RLS (Task 1): a city_admin or
// city_operator physically cannot read or mutate rows of another city, no
// matter what this client sends. The filters here are UX, not security.

import { supabase } from '../services/supabaseClient';

export interface DashboardProfile {
    id: string;
    role: 'city_admin' | 'city_operator' | 'superadmin';
    city_id: string | null;
    display_name: string | null;
    city?: { id: string; name: string; slug: string; timezone: string; bounds?: [number, number, number, number] };
}

export type AlertType = 'street_closed' | 'danger_zone' | 'punto_violeta' | 'event' | 'poor_lighting' | 'works' | 'other';
export type AlertSeverity = 'low' | 'medium' | 'high';

export interface CityAlert {
    id: string;
    city_id: string;
    created_by: string;
    type: AlertType;
    title: string;
    description: string | null;
    severity: AlertSeverity;
    lat: number | null;
    lng: number | null;
    radius_m: number | null;
    starts_at: string;
    expires_at: string | null;
    daily_start: string | null;
    daily_end: string | null;
    status: 'active' | 'resolved';
    resolved_at: string | null;
    created_at: string;
}

export interface NewAlert {
    type: AlertType;
    title: string;
    description?: string;
    severity: AlertSeverity;
    lat: number;
    lng: number;
    radius_m: number;
    starts_at?: string;
    expires_at?: string | null;
    daily_start?: string | null;
    daily_end?: string | null;
}

/** Session user's dashboard profile, or null when not an authority user. */
export async function getDashboardProfile(): Promise<DashboardProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('dashboard_users')
        .select('id, role, city_id, display_name, city:cities(id, name, slug, timezone)')
        .eq('id', user.id)
        .maybeSingle();
    if (error || !data) return null;
    return data as unknown as DashboardProfile;
}

/** Bounding box of the user's city (map lock + geocoder restriction). */
export async function getCityBounds(cityId: string): Promise<[number, number, number, number] | null> {
    const { data, error } = await supabase.rpc('get_city_bounds', { p_city_id: cityId });
    if (error || !data) return null;
    return data as [number, number, number, number];
}

export async function getScoresGeojson(citySlug: string) {
    const { data, error } = await supabase.rpc('get_neighborhood_scores_geojson', { p_city_slug: citySlug });
    if (error) throw error;
    return data as GeoJSON.FeatureCollection;
}

export async function listAlerts(cityId: string, status?: 'active' | 'resolved'): Promise<CityAlert[]> {
    let q = supabase.from('authority_alerts')
        .select('*')
        .eq('city_id', cityId)
        .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CityAlert[];
}

export async function createAlert(cityId: string, userId: string, alert: NewAlert): Promise<CityAlert> {
    const { data, error } = await supabase.from('authority_alerts')
        .insert({ ...alert, city_id: cityId, created_by: userId })
        .select()
        .single();
    if (error) throw error;
    return data as CityAlert;
}

export async function updateAlert(id: string, patch: Partial<NewAlert>): Promise<void> {
    const { error } = await supabase.from('authority_alerts').update(patch).eq('id', id);
    if (error) throw error;
}

export async function resolveAlert(id: string, userId: string): Promise<void> {
    const { error } = await supabase.from('authority_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: userId })
        .eq('id', id);
    if (error) throw error;
}

/** Hard delete — RLS restricts this to city_admin / superadmin. */
export async function deleteAlert(id: string): Promise<void> {
    const { error } = await supabase.from('authority_alerts').delete().eq('id', id);
    if (error) throw error;
}

export async function listUserIncidents(cityId: string, sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
    const { data, error } = await supabase.from('danger_zones')
        .select('id, lat, lng, radius, type, description, votes_up, votes_down, created_at, expires_at')
        .eq('city_id', cityId)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function getScoreHistory(neighborhoodId: string, limit = 26) {
    const { data, error } = await supabase.from('neighborhood_scores')
        .select('score, confidence, components, data_sources, computed_at')
        .eq('neighborhood_id', neighborhoodId)
        .order('computed_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data ?? []).reverse();
}

export async function listAuditLog(cityId: string, limit = 200) {
    const { data, error } = await supabase.from('authority_audit_log')
        .select('*')
        .eq('city_id', cityId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data ?? [];
}

/** Live subscription: alerts of this city changed (create/resolve/delete). */
export function subscribeToAlerts(cityId: string, onChange: () => void) {
    const channel = supabase.channel(`authority-alerts-${cityId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'authority_alerts', filter: `city_id=eq.${cityId}` },
            onChange)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
}

/** Mapbox geocoding restricted to the city bbox (search stays inside the city). */
export async function geocodeInCity(
    query: string,
    bounds: [number, number, number, number]
): Promise<{ name: string; lat: number; lng: number }[]> {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        new URLSearchParams({
            access_token: token,
            bbox: bounds.join(','),
            limit: '5',
            language: 'es',
            types: 'address,poi,street'
        });
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
        name: f.place_name,
        lng: f.center[0],
        lat: f.center[1]
    }));
}
