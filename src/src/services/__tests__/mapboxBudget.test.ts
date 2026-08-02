import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// ── Supabase mock ──────────────────────────────────────────
// rpc rejects so _persistAndCheck short-circuits and the optimistic
// _blocked flag set by track() is never overwritten by refreshCache().
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_f: string, _v: string) => ({
          // Awaited directly by refreshCache() (mapbox_budget)
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve, reject),
          // Double-chained .eq().eq().maybeSingle() (mapbox_geocache)
          eq: (_f2: string, _v2: string) => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      upsert: (_row: unknown, _opts?: unknown) => Promise.resolve({ error: null }),
    }),
    // Reject so _persistAndCheck never calls refreshCache() after track()
    rpc: vi.fn(() => Promise.reject(new Error('rpc disabled in tests'))),
  },
}));

// ── Fetch mock ─────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Imports (after mocks) ──────────────────────────────────
import {
  track,
  isBlocked,
  initBudget,
  BLOCK_EUR,
  ALERT_EUR,
  COSTS,
  getPeriod,
} from '../mapboxBudget';

// ── Tests ─────────────────────────────────────────────────
describe('mapboxBudget', () => {
  beforeAll(() => {
    // Mapbox geocode v6 response used by reverseGeocode L3 path
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ properties: { full_address: 'Carrer de Provença 292, Barcelona' } }],
      }),
    });
  });

  afterEach(() => {
    fetchMock.mockClear();
  });

  // ── (a) Same coordinates must not hit Mapbox API twice ───
  describe('reverse geocode L1 cache', () => {
    it('second call returns cached address without a second Mapbox API request', async () => {
      const { TrustedContactsService } = await import('../trustedContactsService');

      const addr1 = await TrustedContactsService.reverseGeocode(41.3948, 2.1628);
      const addr2 = await TrustedContactsService.reverseGeocode(41.3948, 2.1628);

      expect(addr1).toBe('Carrer de Provença 292, Barcelona');
      expect(addr2).toBe('Carrer de Provença 292, Barcelona');

      const geocodeCalls = fetchMock.mock.calls.filter(
        ([url]) => typeof url === 'string' && (url as string).includes('mapbox.com/search/geocode'),
      );
      expect(geocodeCalls).toHaveLength(1);
    });
  });

  // ── (b) Exceeding €50 blocks further billable calls ──────
  describe('budget enforcement', () => {
    it('isBlocked() returns true after spend exceeds BLOCK_EUR', async () => {
      // initBudget() fetches from DB (mocked → 0 total), sets _total = 0
      await initBudget();
      expect(isBlocked()).toBe(false);

      // Optimistically accumulate enough spend to cross BLOCK_EUR
      const callsToBlock = Math.ceil(BLOCK_EUR / COSTS['geocode_v6']) + 1;
      track('geocode_v6', callsToBlock);

      expect(isBlocked()).toBe(true);
    });

    it('searchPlaces returns [] without hitting Mapbox when blocked', async () => {
      expect(isBlocked()).toBe(true); // state persists within describe

      const { searchPlaces } = await import('../geocodingService');
      const results = await searchPlaces('restaurante');

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('getNearbyPOIs returns [] without hitting Mapbox when blocked', async () => {
      expect(isBlocked()).toBe(true);

      const { getNearbyPOIs } = await import('../poiService');
      const results = await getNearbyPOIs(41.3948, 2.1628, 2000);

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Cost constants ────────────────────────────────────────
  describe('constants', () => {
    it('all products have positive costs', () => {
      ['geocode_v5', 'geocode_v6', 'searchbox', 'directions'].forEach(p => {
        expect(COSTS[p]).toBeGreaterThan(0);
      });
    });

    it('BLOCK_EUR is higher than ALERT_EUR', () => {
      expect(BLOCK_EUR).toBeGreaterThan(ALERT_EUR);
    });

    it('getPeriod returns YYYY-MM', () => {
      expect(getPeriod()).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
