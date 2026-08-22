// Vastgoed Intelligence — energielabelverrijking via EP-Online Public REST API v5.
// BAG-gecentreerd en herbruikbaar door Radar, Pandenverkennen, Vastgoedkansen en Objecten.
// Geen AI, geen BAG-write en absoluut geen Kadaster-call.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const EP_BASE = 'https://public.ep-online.nl/api/v5';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function date(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = value.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

async function cronAuthorized(admin: ReturnType<typeof createClient>, provided: string | null) {
  if (!provided) return false;
  const envSecret = Deno.env.get('OFF_MARKET_CRON_SECRET')?.trim();
  if (envSecret && envSecret === provided) return true;
  const { data } = await admin
    .from('off_market_runtime_secrets')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle();
  return typeof data?.value === 'string' && data.value === provided;
}

async function requireAuthorization(req: Request, admin: ReturnType<typeof createClient>) {
  if (await cronAuthorized(admin, req.headers.get('x-cron-secret'))) return;
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) throw new Error('AUTH_401');
  const token = auth.replace(/^Bearer\s+/i, '');
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims?.sub) throw new Error('AUTH_401');
  const { data: isIntern } = await admin.rpc('is_intern_gebruiker', { _user_id: claims.claims.sub as string });
  if (!isIntern) throw new Error('AUTH_403');
}

function normalizePayload(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    const first = raw.find((item) => item && typeof item === 'object' && !Array.isArray(item));
    return first ? first as Record<string, unknown> : null;
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    await requireAuthorization(req, admin);

    const { data: config, error: configError } = await admin
      .from('vastgoed_intelligence_config')
      .select('energy_enabled,energy_refresh_days')
      .eq('id', true)
      .maybeSingle();
    if (configError || !config) return json({ error: 'Energieconfiguratie ontbreekt' }, 503);
    if (config.energy_enabled !== true) return json({ error: 'Energieverrijking staat uit', blocked: true }, 409);

    const apiKey = Deno.env.get('EP_ONLINE_API_KEY')?.trim();
    if (!apiKey) return json({ error: 'EP_ONLINE_API_KEY ontbreekt', blocked: true }, 503);

    const body = await req.json().catch(() => ({}));
    const bagVboId = typeof body.bag_vbo_id === 'string' ? body.bag_vbo_id.trim() : '';
    if (!/^\d{16}$/.test(bagVboId)) {
      return json({ error: 'Geldig BAG adresseerbaar-object/VBO-id van 16 cijfers is verplicht' }, 400);
    }

    const refreshDays = Math.max(1, Number(config.energy_refresh_days ?? 30));
    if (body.force !== true) {
      const cutoff = new Date(Date.now() - refreshDays * 86400000).toISOString();
      const { data: recent } = await admin
        .from('vastgoed_energielabel_snapshots')
        .select('*')
        .eq('bag_vbo_id', bagVboId)
        .gte('opgehaald_op', cutoff)
        .order('opgehaald_op', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) return json({ ok: true, cached: true, snapshot: recent });
    }

    const endpoint = `${EP_BASE}/PandEnergielabel/AdresseerbaarObject/${encodeURIComponent(bagVboId)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: { Authorization: apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) return json({ ok: true, found: false, bag_vbo_id: bagVboId }, 200);
    if (!response.ok) {
      const bodyText = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
      return json({ error: `EP-Online HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}` }, 502);
    }

    const raw = await response.json();
    const p = normalizePayload(raw);
    if (!p) return json({ error: 'EP-Online gaf geen bruikbare labelpayload terug' }, 502);

    const snapshot = {
      bag_vbo_id: bagVboId,
      bag_nummeraanduiding_id: text(body.bag_nummeraanduiding_id),
      bag_pand_id: text(body.bag_pand_id),
      adres: text(body.adres) ?? text(pick(p, 'Adres', 'adres', 'StraatHuisnummer', 'straatHuisnummer')),
      postcode: text(body.postcode) ?? text(pick(p, 'Postcode', 'postcode')),
      plaats: text(body.plaats) ?? text(pick(p, 'Plaats', 'plaats', 'Woonplaats', 'woonplaats')),
      energielabel: text(pick(p, 'Energieklasse', 'energieklasse', 'Energielabel', 'energielabel', 'Labelklasse', 'labelklasse')),
      gebouwklasse: text(pick(p, 'Gebouwklasse', 'gebouwklasse')),
      gebruiksfunctie: text(pick(p, 'Gebruiksfunctie', 'gebruiksfunctie', 'Gebouwtype', 'gebouwtype')),
      energie_index: num(pick(p, 'EnergieIndex', 'energieIndex', 'energie_index')),
      primair_fossiel_energiegebruik: num(pick(p, 'PrimairFossielEnergiegebruik', 'primairFossielEnergiegebruik', 'primair_fossiel_energiegebruik')),
      registratiedatum: date(pick(p, 'Registratiedatum', 'registratiedatum', 'RegistratieDatum')),
      geldig_tot: date(pick(p, 'GeldigTot', 'geldigTot', 'Geldigheidsdatum', 'geldigheidsdatum')),
      status: text(pick(p, 'Status', 'status')),
      match_kwaliteit: 'exact',
      bron: 'ep_online',
      bron_referentie: text(pick(p, 'Registratienummer', 'registratienummer', 'OpnameId', 'opnameId')),
      raw_payload: raw,
      opgehaald_op: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await admin
      .from('vastgoed_energielabel_snapshots')
      .insert(snapshot)
      .select('*')
      .single();
    if (insertError) throw insertError;

    return json({ ok: true, cached: false, found: true, snapshot: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'AUTH_401') return json({ error: 'Niet geautoriseerd' }, 401);
    if (message === 'AUTH_403') return json({ error: 'Geen toegang' }, 403);
    return json({ error: message.slice(0, 1000) }, 500);
  }
});
