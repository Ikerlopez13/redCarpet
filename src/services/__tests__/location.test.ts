import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// ── Supabase mock ──────────────────────────────────────────────────────────────
// Captures channel subscriptions so tests can simulate INSERT events.
let capturedInsertHandler: ((payload: any) => void) | null = null;

const mockChannel = {
  on: vi.fn((_event: string, _filter: any, handler: (p: any) => void) => {
    capturedInsertHandler = handler;
    return mockChannel;
  }),
  subscribe: vi.fn(() => mockChannel),
  unsubscribe: vi.fn(),
};

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_f: string, _v: string) => ({
          // Awaited by refreshCache() in mapboxBudget
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve, reject),
          // Used by reverseGeocode L2 (mapbox_geocache)
          eq: (_f2: string, _v2: string) => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          order: () => ({ limit: () => ({ single: async () => ({ data: null }) }) }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
      upsert: () => Promise.resolve({ error: null }),
    }),
    channel: vi.fn(() => mockChannel),
    rpc: vi.fn(() => Promise.reject(new Error('rpc disabled in tests'))),
  },
}));

// ── Fetch mock ────────────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Capacitor mocks (not available in Node) ───────────────────────────────────
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: async () => ({ location: 'granted' }),
    requestPermissions: async () => {},
    getCurrentPosition: async () => ({
      coords: { latitude: 41.3948, longitude: 2.1628, accuracy: 10, speed: null, heading: null },
      timestamp: Date.now(),
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: () => ({
    addWatcher: vi.fn(),
    removeWatcher: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('locationService', () => {
  beforeAll(() => {
    // Default geocode v6 response for L3 path (only called on cache miss)
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

  // ── (a) 5m move does NOT trigger a new Mapbox geocode call ──────────────────
  describe('geocode cache precision', () => {
    it('position change < 11m reuses L1 cache — no second Mapbox request', async () => {
      const { TrustedContactsService } = await import('../trustedContactsService');

      // Prime L1 cache with the base coordinate
      const addr1 = await TrustedContactsService.reverseGeocode(41.3948, 2.1628);
      expect(addr1).toBe('Carrer de Provença 292, Barcelona');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fetchMock.mockClear();

      // Move ~5m north: +0.000045° lat — toFixed(4) still '41.3948', same cache key
      const addr2 = await TrustedContactsService.reverseGeocode(41.39484, 2.16280);
      expect(addr2).toBe('Carrer de Provença 292, Barcelona');

      // No new Mapbox call — served from L1 in-memory cache
      const geocodeCalls = fetchMock.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('mapbox.com'),
      );
      expect(geocodeCalls).toHaveLength(0);
    });
  });

  // ── (b) Contact sees location update via realtime subscription ──────────────
  describe('subscribeToFamilyLocations', () => {
    it('fires onLocationUpdate callback on INSERT without page reload', async () => {
      const { subscribeToFamilyLocations } = await import('../locationService');

      const onUpdate = vi.fn();
      const memberIds = ['user-uuid-abc'];

      const sub = subscribeToFamilyLocations(memberIds, onUpdate);

      // Simulate Postgres INSERT event arriving via Supabase realtime channel
      const fakeLocation = {
        id: 'loc-001',
        user_id: 'user-uuid-abc',
        lat: 41.3948,
        lng: 2.1628,
        accuracy: 15,
        battery_level: 72,
        speed: null,
        heading: null,
        created_at: new Date().toISOString(),
      };
      capturedInsertHandler?.({ new: fakeLocation });

      expect(onUpdate).toHaveBeenCalledOnce();
      expect(onUpdate).toHaveBeenCalledWith('user-uuid-abc', fakeLocation);

      sub.unsubscribe();
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });
});
