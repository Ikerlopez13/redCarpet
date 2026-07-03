# Red Carpet × Ajuntament de València — Sandbox

Pilot deployment: city-scoped authorities dashboard + barrio-level safety
scoring + score-aware routing, built multi-tenant so the next city onboards
in under a day.

## Architecture

- **App**: Capacitor + React (Vite). Routing in `src/services/directionsService.ts`
  (Mapbox Directions + safety re-ranking) with `src/services/citySafetyService.ts`
  (barrio scores + live authority alerts, cached client-side).
- **Backend**: Supabase (Postgres 17 + PostGIS + pgRouting + pg_cron).
  *"Server-side" enforcement = RLS policies + SECURITY DEFINER functions +
  triggers* — the dashboard client is untrusted by design.
- **Dashboard**: `src/dashboard/` served at `/dashboard` (web build only),
  guarded by `dashboard_users` roles.

## Deploying the sandbox

1. **Migrations** — run in order in the Supabase SQL editor (or `supabase db push`):
   - `20260703100000_multi_tenant_cities.sql` (cities, roles, RLS scoping)
   - `20260703110000_valencia_neighborhoods.sql` (barrios + PIP service)
   - `20260703120000_neighborhood_scores.sql` (scoring engine + choropleth RPC)
   - `20260703130000_authority_alerts.sql` (alerts, audit log, realtime)
   - `20260703140000_routing_edge_weights.sql` (pgRouting edge precompute)
   - `20260703150000_valencia_hardening.sql` (stats RPCs, rate limiting)
2. **Seed** — `npm run seed:valencia`
   Downloads official boundaries (or uses `data/valencia/*.geojson` cache),
   generates `supabase/seed/valencia_seed.sql` and executes it when
   `SUPABASE_DB_URL` is set; otherwise paste it into the SQL editor.
   Includes: city + 88 barrios + scoring config + backfill + coverage check +
   initial score compute + demo `city_admin` binding.
3. **Demo user** — create `demo.valencia@redcarpet.app` in Supabase Auth,
   then re-run the last block of the seed (it links the dashboard role).
4. **Crime baseline (manual, quarterly ~5 min)** — see below.

## Data sources & refresh cadence

| Source | What | Cadence | How |
|---|---|---|---|
| [Geoportal València](https://geoportal.valencia.es/server/rest/services/OPENDATA/UrbanismoEInfraestructuras/MapServer) layers 224/225 (CC-BY-4.0) | 88 barrios + 22 distritos, official boundaries | Rarely changes | `npm run seed:valencia` re-imports idempotently |
| [Ministerio del Interior — Balance de Criminalidad](https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/balances) | Municipal crime baseline | Quarterly | **Manual pull** (interior.gob.es is behind a Cloudflare challenge; the SES portal is a JS app). Copy `data/valencia/crime-stats-TEMPLATE.json`, fill figures, run `npm run ingest:crime data/valencia/crime-stats-<PERIOD>.json` |
| Red Carpet `danger_zones` | User incident reports | Live | Consumed at score recompute with 90-day half-life decay |
| `neighborhood_signals` table | Policía Local / OSM lighting / density proxies | As available | Insert normalized [0,1] values; picked up on next recompute |

## Scoring formula (Task 3)

`recompute_neighborhood_scores('valencia')` — weekly via pg_cron (Mon 04:00)
and on-demand:

```
baseline  = min(100, municipal infracciones per 1000 inhabitants)   [MI]
incidents = Σ exp(-ln2 · age_days / 90) per barrio, normalized 0-1  [Red Carpet]
signals   = mean of neighborhood_signals values (0-1)               [granular]
score     = clamp( baseline · (0.5 + w_inc·incidents + w_sig·signals) )
confidence = 0.3 + 0.3·has_incidents + 0.1·per_signal (max 1.0)
final     = confidence·score + (1-confidence)·baseline   ← low-confidence
                                                            collapses to baseline
```

Weights live in `config/valencia-scoring.config.json`, mirrored to the
`scoring_configs` table by the seed — **edit the table row to tune without
redeploying**. Choropleth endpoint (PostgREST GET):
`/rest/v1/rpc/get_neighborhood_scores_geojson?p_city_slug=valencia`

## Routing behaviour (Task 4)

- Barrio scores load once per 6h into the app and re-rank the 3 candidate
  routes; the pgRouting engine gets them precomputed per edge via
  `apply_neighborhood_scores_to_edges('valencia')`.
- `street_closed` alerts make crossing routes impassable (filtered out while
  an open alternative exists).
- Other danger alerts add severity-weighted penalties.
- **Puntos violeta** within 150 m grant the Safest route a bonus, doubled
  21:00–07:00. Optional daily schedule (e.g. 22:00–06:00 during Fallas) is
  evaluated server-side in the city's timezone.
- QA: `npm run test:qa:valencia` — 33 O/D pairs across all districts
  (3 routes, walkable, closures respected, <2 s). Unit tests: `npm test`.

### Known limitations

- Barrio exposure samples every 4th route coordinate (sub-ms; ~25 samples).
- If **every** candidate route crosses a closure, best-effort routes are
  returned with a console warning rather than nothing.
- The pgRouting engine (`rc_street_edges`) still needs the street graph
  imported (OSM) before `get_safe_route_geojson` returns routes; the app
  falls back to Mapbox until then.

## Dashboard (Task 5)

`/dashboard` — login restricted to `dashboard_users`:

- `city_admin` / `city_operator`: scoped to their city **by RLS**; operators
  cannot hard-delete. `superadmin`: everything.
- Overview choropleth (confidence-faded), toggles for alerts / puntos
  violeta / closures / incidents 7-30d; barrio panel with trend + sources.
- Alerts: map-click or bbox-restricted address search, punto violeta
  first-class (violet UI, schedule), one-click resolve (soft), audit trail
  written by DB trigger (`authority_audit_log`) — untamperable from clients.
- App sync: Supabase Realtime on `authority_alerts` + 45 s polling fallback
  → resolved alerts disappear from the app in <60 s. Authority alerts render
  with an official badge; puntos violeta in violet.

## Onboarding the next city (<1 day)

1. Find the city's official district/neighborhood GeoJSON (or WFS/ArcGIS).
2. Copy `scripts/seed-valencia.mjs` → adapt `GEOPORTAL`/`LAYERS` and property
   mapping (`code`, `name`, `district`) — everything else is city-agnostic.
3. Copy `config/valencia-scoring.config.json` → new slug.
4. Run the new seed; add the city's crime-stats JSON; create dashboard users
   with `city_id` = new city. **No schema changes required.**

## Security notes (Task 6)

- Every alert mutation is validated by DB trigger: geometry inside the city
  boundary, radius 10–2000 m, expiry > start.
- RLS is the tenancy boundary — verified paths: dashboard reads/mutations,
  audit log (append-only via SECURITY DEFINER trigger only).
- Rate limit: 30 alert mutations/min/user, enforced in-database. Configure
  transport-level limits additionally in Supabase → Settings → API.
