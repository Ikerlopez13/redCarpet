import { describe, it, expect } from 'vitest';
import { scoreAtPoint, isNightTime } from '../citySafetyService';
import { computeRouteSafetyMetrics, type RouteResult } from '../directionsService';
import type { AuthorityAlert } from '../citySafetyService';

// A 1km² square barrio around Plaza del Ayuntamiento with score 80
const dangerousBarrio = {
    bbox: [-0.383, 39.465, -0.368, 39.475] as [number, number, number, number],
    polygons: [[
        [-0.383, 39.465], [-0.368, 39.465], [-0.368, 39.475], [-0.383, 39.475], [-0.383, 39.465]
    ]],
    score: 80,
    confidence: 0.9,
    code: '11',
    name: 'TEST-CIUTAT VELLA'
};

const makeRoute = (coords: number[][]): RouteResult => ({
    distance: 1000,
    duration: 600,
    geometry: { type: 'LineString', coordinates: coords } as any,
    steps: [
        { instruction: 'a', distance: 500, duration: 300, name: 's', maneuver: { type: 'depart', instruction: 'a' } },
        { instruction: 'b', distance: 500, duration: 300, name: 's', maneuver: { type: 'arrive', instruction: 'b' } }
    ]
});

// route crossing the test barrio (Ciutat Vella)
const routeInside = makeRoute([
    [-0.380, 39.468], [-0.378, 39.469], [-0.376, 39.470], [-0.374, 39.471], [-0.372, 39.472]
]);
// route entirely outside (Benimaclet direction)
const routeOutside = makeRoute([
    [-0.360, 39.480], [-0.358, 39.482], [-0.356, 39.484], [-0.354, 39.486], [-0.352, 39.488]
]);

describe('scoreAtPoint (point-in-polygon)', () => {
    it('resolves a point inside the barrio to its score', () => {
        expect(scoreAtPoint(-0.375, 39.470, [dangerousBarrio])).toBe(80);
    });
    it('returns null outside every barrio', () => {
        expect(scoreAtPoint(-0.350, 39.490, [dangerousBarrio])).toBeNull();
    });
    it('bbox prefilter rejects far-away points cheaply', () => {
        expect(scoreAtPoint(2.17, 41.38, [dangerousBarrio])).toBeNull(); // Barcelona
    });
});

describe('computeRouteSafetyMetrics', () => {
    it('accumulates barrio exposure along the route', () => {
        const m = computeRouteSafetyMetrics(routeInside, [], [dangerousBarrio]);
        expect(m.barrioExposure).toBe(80);
        const m2 = computeRouteSafetyMetrics(routeOutside, [], [dangerousBarrio]);
        expect(m2.barrioExposure).toBe(0);
    });

    it('flags routes crossing an active street closure as blocked', () => {
        const closure: AuthorityAlert = {
            id: '1', type: 'street_closed', title: 'Corte por obras', severity: 'high',
            lat: 39.470, lng: -0.376, radius_m: 100, segment_geojson: null, expires_at: null
        };
        expect(computeRouteSafetyMetrics(routeInside, [closure], []).blockedByClosure).toBe(true);
        expect(computeRouteSafetyMetrics(routeOutside, [closure], []).blockedByClosure).toBe(false);
    });

    it('detects closures defined as street segments', () => {
        const closure: AuthorityAlert = {
            id: '2', type: 'street_closed', title: 'Calle cortada', severity: 'high',
            lat: null, lng: null, radius_m: null,
            segment_geojson: { type: 'LineString', coordinates: [[-0.377, 39.4695], [-0.375, 39.4705]] },
            expires_at: null
        };
        expect(computeRouteSafetyMetrics(routeInside, [closure], []).blockedByClosure).toBe(true);
    });

    it('counts puntos violeta within 150m as a bonus, not a penalty', () => {
        const violeta: AuthorityAlert = {
            id: '3', type: 'punto_violeta', title: 'Punto Violeta Fallas', severity: 'low',
            lat: 39.4695, lng: -0.377, radius_m: null, segment_geojson: null, expires_at: null
        };
        const m = computeRouteSafetyMetrics(routeInside, [violeta], []);
        expect(m.violetaCount).toBe(1);
        expect(m.authorityPenalty).toBe(0);
        expect(m.blockedByClosure).toBe(false);
    });

    it('weights danger alerts by severity', () => {
        const mk = (sev: AuthorityAlert['severity']): AuthorityAlert => ({
            id: sev, type: 'danger_zone', title: 't', severity: sev,
            lat: 39.470, lng: -0.376, radius_m: 200, segment_geojson: null, expires_at: null
        });
        const low = computeRouteSafetyMetrics(routeInside, [mk('low')], []).authorityPenalty;
        const high = computeRouteSafetyMetrics(routeInside, [mk('high')], []).authorityPenalty;
        expect(high).toBeGreaterThan(low);
    });
});

describe('isNightTime', () => {
    it('is true at 23:00 and 03:00, false at 12:00', () => {
        expect(isNightTime(new Date('2026-07-03T23:00:00'))).toBe(true);
        expect(isNightTime(new Date('2026-07-03T03:00:00'))).toBe(true);
        expect(isNightTime(new Date('2026-07-03T12:00:00'))).toBe(false);
    });
});
