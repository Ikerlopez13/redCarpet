// Client-side per-product sliding-window rate limiter.
// Prevents loop bugs and excessive bursts from hitting billable Mapbox APIs.
// This is a defensive guard, not a security boundary — mapboxBudget.ts hard-blocks at €50.

const WINDOW_MS = 60_000; // 1 minute

const _windows = new Map<string, number[]>();

function _prune(ts: number[], now: number): number[] {
  return ts.filter(t => now - t < WINDOW_MS);
}

/**
 * Records one call attempt. Returns false (blocked) when the per-product
 * per-minute cap would be exceeded; true otherwise.
 *
 * Limits (per 60s):
 *   directions  → 15   (€0.03/min max, protects against navigation loops)
 *   geocode_v5  → 40
 *   geocode_v6  → 40
 *   searchbox   → 10   (€0.04/min max, session-based billing)
 */
export function allow(product: string, max: number): boolean {
  const now = Date.now();
  const ts = _prune(_windows.get(product) ?? [], now);
  if (ts.length >= max) {
    console.warn(`[RateLimit] ${product} exceeded ${max} calls/min — call blocked`);
    return false;
  }
  ts.push(now);
  _windows.set(product, ts);
  return true;
}

/**
 * Sanitizes user-supplied strings before they are forwarded to Mapbox APIs.
 * Strips control characters and caps length to prevent malformed requests.
 */
export function sanitizeQuery(q: string): string {
  return q
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // strip control chars
    .slice(0, 200);
}
