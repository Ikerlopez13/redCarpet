import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rc-device-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // Auth por token de dispositivo de larga vida (sobrevive a la caducidad del JWT
    // y a que la app esté cerrada). El plugin lo manda en esta cabecera.
    const token = req.headers.get('x-rc-device-token') ?? '';
    if (!token) return json({ error: 'no_token' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tok } = await admin
      .from('location_ingest_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle();
    if (!tok) return json({ error: 'bad_token' }, 401);

    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > 256_000) return json({ error: 'payload_too_large' }, 413);

    const body = await req.json().catch(() => ({}));
    // El plugin Transistor postea la ubicación (httpRootProperty '.') como objeto
    // único; toleramos también { location: {...} } y arrays/batch.
    const raw = body?.location ?? body;
    const list = (Array.isArray(raw) ? raw : [raw]).slice(0, 100);

    const rows = list
      .filter((l: any) => {
        const lat = l?.coords?.latitude;
        const lng = l?.coords?.longitude;
        return Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      })
      .map((l: any) => ({
        user_id: tok.user_id,
        lat: l.coords.latitude,
        lng: l.coords.longitude,
        accuracy: l.coords.accuracy ?? null,
        speed: l.coords.speed ?? null,
        heading: l.coords.heading ?? null,
        battery_level:
          l.battery && typeof l.battery.level === 'number'
            ? Math.round(l.battery.level * 100)
            : null,
      }));

    if (rows.length > 0) {
      const { error } = await admin.from('locations').insert(rows);
      if (error) return json({ error: error.message }, 500);
    }

    return json({ ok: true, inserted: rows.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
