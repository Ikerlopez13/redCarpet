// ── GREEN CARPET ─────────────────────────────────────────────────────────
// Lógica de impacto de RedCarpet: aporte individual real + contador de
// comunidad (parte REAL persistida + parte SIMULADA determinista).
//
// TRANSPARENCIA (nota interna): el contador de "Comunidad" que se muestra al
// usuario es la SUMA de dos componentes:
//   1) real_co2_kg  → CO₂ real acumulado por rutas de usuarios reales (BD).
//   2) simulated(t) → incremento base SIMULADO y determinista en función del
//      tiempo, para transmitir actividad constante. NO es actividad real.
// Ambas partes están claramente separadas en el código. De cara al usuario se
// muestra un único número. Si esto debe comunicarse de otra forma por temas de
// transparencia/publicidad, cambiar SOLO la parte de presentación.

import { supabase } from './supabaseClient';

// Factor de conversión km → CO₂ evitado.
// 0,12 kg CO₂/km ≈ emisión media de un turismo (~120 g/km), en línea con la
// media de la flota europea (EEA / normativa CO₂ de turismos). Representa el
// CO₂ que se evita al no hacer ese trayecto en coche.
export const CO2_FACTOR_KG_PER_KM = 0.12;

/** Clave estable de una ruta (origen→destino redondeados) para no duplicar. */
function routeKey(o: { lat: number; lng: number }, d: { lat: number; lng: number }): string {
  return `${o.lat.toFixed(4)},${o.lng.toFixed(4)}->${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
}

/**
 * Registra una ruta y suma su CO₂ al aporte del usuario y al contador real de
 * comunidad. Idempotente por ruta+usuario dentro de 60 min (evita duplicar al
 * recalcular). Devuelve el nuevo total del usuario (kg), o null si falla.
 */
export async function recordRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  distanceMeters: number
): Promise<number | null> {
  const km = (distanceMeters || 0) / 1000;
  if (km <= 0) return null; // ruta de 0 km / inválida: no cuenta
  try {
    const { data, error } = await supabase.rpc('record_green_route', {
      p_route_key: routeKey(origin, destination),
      p_distance_km: Number(km.toFixed(4)),
    });
    if (error) throw error;
    return typeof data === 'number' ? data : Number(data ?? 0);
  } catch (e) {
    console.warn('[green] recordRoute failed:', e);
    return null;
  }
}

/** Aporte individual acumulado del usuario (kg CO₂, km, nº rutas). */
export async function getUserStats(userId: string): Promise<{ co2: number; km: number; routes: number }> {
  try {
    const { data } = await supabase
      .from('green_user_stats')
      .select('total_co2_kg, total_km, routes_count')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      co2: Number(data?.total_co2_kg ?? 0),
      km: Number(data?.total_km ?? 0),
      routes: Number(data?.routes_count ?? 0),
    };
  } catch {
    return { co2: 0, km: 0, routes: 0 };
  }
}

/** Parte REAL del contador de comunidad (kg CO₂ acumulados por rutas reales). */
export async function getCommunityReal(): Promise<number> {
  try {
    const { data } = await supabase
      .from('green_community')
      .select('real_co2_kg')
      .eq('id', 1)
      .maybeSingle();
    return Number(data?.real_co2_kg ?? 0);
  } catch {
    return 0;
  }
}

// ── Contador simulado (determinista, monótono, orgánico) ───────────────────
// Anclado a un EPOCH fijo → todos los clientes calculan el MISMO valor, nunca
// se reinicia (no depende de estado), nunca baja (derivada siempre positiva) y
// sobrevive a reinicios/despliegues (es una función pura del tiempo).
const SIM_EPOCH_MS = Date.UTC(2026, 0, 1); // 2026-01-01, fijo para siempre
const SIM_BASE_RATE = 0.02;                // kg CO₂/seg (~1,2 kg/min de base)
const SIM_PERIOD = 300;                     // s: ciclo de variación del ritmo (~5 min)

/**
 * CO₂ simulado acumulado en el instante `now`. Ritmo orgánico (varía ±50%)
 * pero SIEMPRE creciente: rate(s) = base·(1 + 0,5·sin(s/P)) ∈ [0,5·base, 1,5·base].
 * simulated(s) = base·(s + P/2 − (P/2)·cos(s/P)), con simulated(0)=0.
 */
export function communitySimulated(nowMs: number = Date.now()): number {
  const s = Math.max(0, (nowMs - SIM_EPOCH_MS) / 1000);
  const half = SIM_PERIOD / 2;
  return SIM_BASE_RATE * (s + half - half * Math.cos(s / SIM_PERIOD));
}

/** Número total que se muestra en "Comunidad" = real + simulado. */
export function communityTotal(realCo2: number, nowMs: number = Date.now()): number {
  return realCo2 + communitySimulated(nowMs);
}
