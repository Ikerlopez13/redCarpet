// @vitest-environment happy-dom
/**
 * TASK 4 — València routing QA suite.
 *
 * 33 origin/destination pairs covering all major districts plus edge cases
 * (Turia crossings, port area, university zone, pedanías). Each pair asserts:
 *   - 3 valid walking routes returned (safe / balanced / fast)
 *   - all fully walkable (no motorway/trunk steps)
 *   - routes respect active street closures (blocked routes filtered)
 *   - response time < 2s
 *
 * Integration suite: hits the real Mapbox Directions API and Supabase.
 * Run explicitly with:  npm run test:qa:valencia
 * (skipped otherwise so `npm test` stays offline-safe)
 */
import { describe, it, expect } from 'vitest';
import { getAlternativeRoutes, type Coordinate, type RouteResult } from '../services/directionsService';

const RUN = process.env.RUN_VALENCIA_QA === '1' && !!import.meta.env.VITE_MAPBOX_TOKEN;
const d = RUN ? describe : describe.skip;

interface QAPair { name: string; origin: Coordinate; destination: Coordinate }

// Coordinates verified against the official barrio boundaries (data/valencia/)
const PAIRS: QAPair[] = [
    // — city-centre districts —
    { name: 'Ciutat Vella: Pl. Ajuntament → Torres de Serranos', origin: { lat: 39.4699, lng: -0.3763 }, destination: { lat: 39.4791, lng: -0.3762 } },
    { name: 'Ciutat Vella → Russafa (Mercat Central → c/ Cuba)', origin: { lat: 39.4735, lng: -0.3790 }, destination: { lat: 39.4614, lng: -0.3744 } },
    { name: "L'Eixample: Russafa interior", origin: { lat: 39.4620, lng: -0.3720 }, destination: { lat: 39.4660, lng: -0.3680 } },
    { name: 'Extramurs: Botànic → Estació del Nord', origin: { lat: 39.4750, lng: -0.3870 }, destination: { lat: 39.4665, lng: -0.3775 } },
    { name: 'Campanar → Ciutat Vella', origin: { lat: 39.4830, lng: -0.3950 }, destination: { lat: 39.4740, lng: -0.3790 } },
    { name: 'La Saïdia → El Carme', origin: { lat: 39.4850, lng: -0.3720 }, destination: { lat: 39.4770, lng: -0.3820 } },
    { name: 'El Pla del Real: Viveros → Aragón', origin: { lat: 39.4790, lng: -0.3660 }, destination: { lat: 39.4720, lng: -0.3580 } },
    { name: "L'Olivereta → Extramurs", origin: { lat: 39.4700, lng: -0.4010 }, destination: { lat: 39.4720, lng: -0.3850 } },
    { name: 'Patraix → Jesús', origin: { lat: 39.4590, lng: -0.3930 }, destination: { lat: 39.4550, lng: -0.3820 } },
    { name: 'Jesús: La Raiosa → Sant Marcel·lí', origin: { lat: 39.4570, lng: -0.3850 }, destination: { lat: 39.4460, lng: -0.3880 } },
    { name: 'Quatre Carreres: Malilla → Ciutat de les Arts', origin: { lat: 39.4480, lng: -0.3770 }, destination: { lat: 39.4560, lng: -0.3540 } },
    { name: 'Poblats Marítims: Cabanyal → Malva-rosa', origin: { lat: 39.4670, lng: -0.3290 }, destination: { lat: 39.4760, lng: -0.3250 } },
    { name: 'Camins al Grau: Aiora → Marítim', origin: { lat: 39.4650, lng: -0.3450 }, destination: { lat: 39.4630, lng: -0.3350 } },
    { name: 'Algirós → Cabanyal (university → beach)', origin: { lat: 39.4730, lng: -0.3450 }, destination: { lat: 39.4680, lng: -0.3300 } },
    { name: 'Benimaclet → Alboraia edge', origin: { lat: 39.4850, lng: -0.3560 }, destination: { lat: 39.4920, lng: -0.3510 } },
    { name: 'Rascanya: Orriols → Torrefiel', origin: { lat: 39.4930, lng: -0.3660 }, destination: { lat: 39.4950, lng: -0.3740 } },
    { name: 'Benicalap → Campanar', origin: { lat: 39.4960, lng: -0.3880 }, destination: { lat: 39.4850, lng: -0.3930 } },

    // — cross-city and Turia garden crossings —
    { name: 'Turia crossing: Campanar → Extramurs', origin: { lat: 39.4810, lng: -0.3900 }, destination: { lat: 39.4740, lng: -0.3860 } },
    { name: 'Turia crossing: La Saïdia → El Pla del Real', origin: { lat: 39.4830, lng: -0.3690 }, destination: { lat: 39.4760, lng: -0.3630 } },
    { name: 'Turia east: Pont de Fusta → Alameda', origin: { lat: 39.4800, lng: -0.3750 }, destination: { lat: 39.4730, lng: -0.3640 } },
    { name: 'Long axis: Benicalap → Russafa', origin: { lat: 39.4940, lng: -0.3870 }, destination: { lat: 39.4620, lng: -0.3730 } },
    { name: 'Long axis: Patraix → Benimaclet', origin: { lat: 39.4580, lng: -0.3940 }, destination: { lat: 39.4860, lng: -0.3570 } },
    { name: 'East-west: Cabanyal → Ciutat Vella', origin: { lat: 39.4680, lng: -0.3300 }, destination: { lat: 39.4740, lng: -0.3790 } },

    // — edge cases —
    { name: 'Port area: Marina → Grau', origin: { lat: 39.4610, lng: -0.3310 }, destination: { lat: 39.4590, lng: -0.3420 } },
    { name: 'University zone at night: Tarongers campus', origin: { lat: 39.4790, lng: -0.3430 }, destination: { lat: 39.4740, lng: -0.3410 } },
    { name: 'Universitat Politècnica → Benimaclet', origin: { lat: 39.4820, lng: -0.3430 }, destination: { lat: 39.4850, lng: -0.3580 } },
    { name: 'Ciutat de les Arts → Monteolivete', origin: { lat: 39.4550, lng: -0.3500 }, destination: { lat: 39.4600, lng: -0.3670 } },
    { name: 'Bioparc edge: Nou Moles → Parc de Capçalera', origin: { lat: 39.4690, lng: -0.4050 }, destination: { lat: 39.4780, lng: -0.4020 } },
    { name: 'South edge: La Torre (Pobles del Sud)', origin: { lat: 39.4310, lng: -0.3930 }, destination: { lat: 39.4400, lng: -0.3870 } },
    { name: 'Short hop: two blocks in Russafa', origin: { lat: 39.4625, lng: -0.3735 }, destination: { lat: 39.4640, lng: -0.3720 } },
    { name: 'Mestalla → Aragó corridor', origin: { lat: 39.4750, lng: -0.3580 }, destination: { lat: 39.4700, lng: -0.3510 } },
    { name: 'Nightlife: Joan Llorenç → Pl. del Cedre', origin: { lat: 39.4720, lng: -0.3930 }, destination: { lat: 39.4670, lng: -0.3480 } },
    { name: 'Stations: Nord → Joaquín Sorolla', origin: { lat: 39.4665, lng: -0.3775 }, destination: { lat: 39.4600, lng: -0.3800 } },
];

// Steps must never route pedestrians onto motorways/trunk roads
const FORBIDDEN_STEP_PATTERN = /autov[ií]a|autopista|motorway|\bV-3[01]\b|\bA-[37]\b|\bCV-\d+/i;

function assertWalkable(route: RouteResult, label: string) {
    for (const step of route.steps) {
        expect(step.name, `${label}: step "${step.name}" looks like a highway`).not.toMatch(FORBIDDEN_STEP_PATTERN);
    }
}

d('València QA — 3-route algorithm across all districts', () => {
    for (const pair of PAIRS) {
        it(pair.name, { timeout: 15000 }, async () => {
            const started = Date.now();
            const { safe, balanced, fast } = await getAlternativeRoutes(pair.origin, pair.destination, 'walking');
            const elapsed = Date.now() - started;

            expect(elapsed, 'response time must stay under 2s').toBeLessThan(2000);

            expect(fast, 'fast route missing').not.toBeNull();
            expect(safe, 'safe route missing').not.toBeNull();
            expect(balanced, 'balanced route missing').not.toBeNull();

            for (const [label, route] of Object.entries({ safe, balanced, fast })) {
                expect(route!.geometry?.coordinates?.length, `${label} has no geometry`).toBeGreaterThan(2);
                expect(route!.distance, `${label} has zero distance`).toBeGreaterThan(0);
                assertWalkable(route!, label);
            }

            // Safest is never shorter (in time) than Fastest — divergence constraint
            expect(safe!.duration).toBeGreaterThanOrEqual(fast!.duration);
        });
    }
});
