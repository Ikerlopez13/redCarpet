/**
 * Mapbox spend tracker.
 *
 * Pricing table (post-free-tier, conservative – USD ≈ EUR 1:1):
 *   geocode_v5  $0.75 / 1 000 req  → €0.00075 / call
 *   geocode_v6  $0.75 / 1 000 req  → €0.00075 / call
 *   searchbox   $4.00 / 1 000 ses  → €0.00400 / session
 *   directions  $2.00 / 1 000 req  → €0.00200 / call
 *
 * Thresholds:
 *   ≥ €10 → email alert (one per period)
 *   ≥ €50 → block new billable calls (degraded-gracefully)
 */

import { supabase } from './supabaseClient';

// ── Pricing ────────────────────────────────────────────────
export const COSTS: Record<string, number> = {
  geocode_v5:  0.00075,
  geocode_v6:  0.00075,
  searchbox:   0.00400,
  directions:  0.00200,
};

export const ALERT_EUR = 10;
export const BLOCK_EUR = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ── In-memory state ────────────────────────────────────────
let _total: number | null = null;
let _expiry = 0;
let _blocked = false;

// ── Helpers ────────────────────────────────────────────────
export function getPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function refreshCache(): Promise<number> {
  try {
    const { data } = await supabase
      .from('mapbox_budget')
      .select('estimated_eur')
      .eq('period', getPeriod());

    const total = (data ?? []).reduce(
      (s: number, r: any) => s + Number(r.estimated_eur ?? 0),
      0,
    );
    _total   = total;
    _expiry  = Date.now() + CACHE_TTL;
    _blocked = total >= BLOCK_EUR;
    return total;
  } catch {
    return _total ?? 0;
  }
}

// ── Public API ─────────────────────────────────────────────

/** Call once at app start to warm the cache (App.tsx). */
export async function initBudget(): Promise<void> {
  await refreshCache();
}

/** Synchronous — safe to call before every API hit. */
export function isBlocked(): boolean {
  return _blocked;
}

/** Estimated spend this billing period in EUR. */
export async function getMonthlyTotal(): Promise<number> {
  if (_total !== null && Date.now() < _expiry) return _total;
  return refreshCache();
}

/**
 * Record a billable call. Fire-and-forget — does not block callers.
 * @param product  Key from COSTS (e.g. 'geocode_v6')
 * @param calls    Number of API requests made (default 1)
 */
export function track(product: string, calls = 1): void {
  const cost = (COSTS[product] ?? 0) * calls;
  if (cost === 0) return;

  // Optimistic local update (synchronous fast path)
  if (_total !== null) {
    _total  += cost;
    _blocked = _total >= BLOCK_EUR;
  }

  // Async persistence — does not slow callers
  _persistAndCheck(product, calls, cost);
}

// ── Internal ───────────────────────────────────────────────

async function _persistAndCheck(product: string, calls: number, cost: number): Promise<void> {
  try {
    await supabase.rpc('mapbox_budget_increment', {
      p_period:  getPeriod(),
      p_product: product,
      p_calls:   calls,
      p_eur:     cost,
    });

    const total = await refreshCache();
    await _checkThresholds(total);
  } catch (err) {
    console.warn('[MapboxBudget] persist failed:', err);
  }
}

async function _checkThresholds(total: number): Promise<void> {
  if (total >= BLOCK_EUR) {
    const { error } = await supabase
      .from('mapbox_budget_log')
      .upsert(
        { period: getPeriod(), event: 'blocked', total_eur: total },
        { onConflict: 'period,event', ignoreDuplicates: true },
      );
    if (!error) _sendAlert('🚨 BLOQUEADO', total);
  } else if (total >= ALERT_EUR) {
    const { error } = await supabase
      .from('mapbox_budget_log')
      .upsert(
        { period: getPeriod(), event: 'alert_10eur', total_eur: total },
        { onConflict: 'period,event', ignoreDuplicates: true },
      );
    if (!error) _sendAlert('⚠️ AVISO 10€', total);
  }
}

function _sendAlert(level: string, total: number): void {
  fetch('https://tryredcarpet.com/api/notify-budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level,
      total_eur: total.toFixed(4),
      period: getPeriod(),
    }),
  }).catch(() => {});
}
