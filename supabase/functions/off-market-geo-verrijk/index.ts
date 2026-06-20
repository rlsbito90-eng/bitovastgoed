// Off-Market Geo-verrijking V2
// Tweetraps: ensureCoords (PDOK free, adres → lat/lng) + reverse (PDOK reverse, lat/lng → gebied).
// Open data, geen sleutel. Geen BAG, geen Kadaster.
//
// Auth: bestaande JWT/intern-gebruikercontrole, plus `x-cron-secret`-bypass voor
// server-trigger vanuit `off-market-normalize-ruw`.
//
// Single  : { signaal_id: uuid, force?: boolean, debug?: boolean }
// Batch   : { batch: true, limit?: number, force?: boolean, retry_failed?: boolean }

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  ensureCoords,
  type GeocodeInput,
} from '../_shared/offMarketGeocode.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PDOK_REVERSE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse';
const BRON = 'pdok_locatieserver';

type GeoStatus = 'niet_verrijkt' | 'verrijkt' | 'geen_coordinaten' | 'geen_match' | 'fout';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildReverseUrl(lat: number, lon: number): string {
  const params = new URLSearchParams();
  params.append('lat', String(lat));
  params.append('lon', String(lon));
  params.append('type', 'gemeente');
  params.append('type', 'wijk');
  params.append('type', 'buurt');
  params.append('rows', '20');
  params.append('fl', '*');
  params.append('wt', 'json');
  return `${PDOK_REVERSE}?${params.toString()}`;
}

async function pdokReverse(lat: number, lon: number): Promise<{ pdok: any; httpStatus: number; url: string }> {
  const url = buildReverseUrl(lat, lon);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      lastStatus = res.status;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`PDOK HTTP ${res.status}`);
      return { pdok: await res.json(), httpStatus: res.status, url };
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw new Error(`PDOK onbereikbaar (laatste status ${lastStatus})`);
}

function cleanWeergave(w: string | undefined, kind: 'gemeente' | 'wijk' | 'buurt'): string | null {
  if (!w) return null;
  let s = String(w).trim();
  if (kind === 'gemeente') s = s.replace(/^Gemeente\s+/i, '');
  return s || null;
}
function pickName(d: any, namen: string[], kind: 'gemeente' | 'wijk' | 'buurt'): string | null {
  for (const n of namen) {
    const v = d?.[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return cleanWeergave(d?.weergavenaam, kind);
}
function pickCode(d: any, codes: string[]): string | null {
  for (const c of codes) {
    const v = d?.[c];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

export function buildPatch(pdok: any) {
  const docs: any[] = pdok?.response?.docs ?? pdok?.response?.response?.docs ?? pdok?.docs ?? [];
  const byType = (t: string) => docs.find((d) => String(d?.type ?? '').toLowerCase() === t);
  const g = byType('gemeente');
  const w = byType('wijk');
  const b = byType('buurt');
  let gemeenteNaam = pickName(g, ['gemeentenaam', 'gemeente_naam'], 'gemeente');
  let gemeenteCode = pickCode(g, ['gemeentecode', 'gemeente_code']);
  if (!gemeenteNaam) gemeenteNaam = pickName(w, ['gemeentenaam'], 'gemeente') ?? pickName(b, ['gemeentenaam'], 'gemeente');
  if (!gemeenteCode) gemeenteCode = pickCode(w, ['gemeentecode']) ?? pickCode(b, ['gemeentecode']);
  let wijkNaam = pickName(w, ['wijknaam', 'wijk_naam'], 'wijk');
  let wijkCode = pickCode(w, ['wijkcode', 'wijk_code']);
  if (!wijkNaam) wijkNaam = pickName(b, ['wijknaam'], 'wijk');
  if (!wijkCode) wijkCode = pickCode(b, ['wijkcode']);
  const buurtNaam = pickName(b, ['buurtnaam', 'buurt_naam'], 'buurt');
  const buurtCode = pickCode(b, ['buurtcode', 'buurt_code']);
  return {
    geo_gemeente_naam: gemeenteNaam,
    geo_gemeente_code: gemeenteCode,
    geo_wijk_naam: wijkNaam,
    geo_wijk_code: wijkCode,
    geo_buurt_naam: buurtNaam,
    geo_buurt_code: buurtCode,
    hasAny: Boolean(gemeenteNaam || wijkNaam || buurtNaam),
  };
}

interface VerrijkResultaat {
  id: string;
  status: GeoStatus;
  skipped?: boolean;
  ensured_coords?: boolean;
  error?: string;
  debug?: unknown;
}

async function verrijkOne(
  supabase: ReturnType<typeof createClient>,
  signaalId: string,
  force: boolean,
  debug = false,
): Promise<VerrijkResultaat> {
  const { data: signaal, error } = await supabase
    .from('off_market_signalen')
    .select('id, lat, lng, geo_status, adres, postcode, plaats')
    .eq('id', signaalId)
    .maybeSingle();
  if (error) return { id: signaalId, status: 'fout', error: error.message };
  if (!signaal) return { id: signaalId, status: 'fout', error: 'Signaal niet gevonden' };

  if (signaal.geo_status === 'verrijkt' && !force) {
    return { id: signaalId, status: 'verrijkt', skipped: true };
  }

  let lat: number | null = signaal.lat == null ? null : Number(signaal.lat);
  let lng: number | null = signaal.lng == null ? null : Number(signaal.lng);
  let ensured = false;

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    const inv: GeocodeInput = {
      adres: (signaal as any).adres ?? null,
      postcode: (signaal as any).postcode ?? null,
      plaats: (signaal as any).plaats ?? null,
    };
    try {
      const r = await ensureCoords(inv);
      if (r.status === 'ok') {
        lat = r.match.lat;
        lng = r.match.lng;
        ensured = true;
        await supabase.from('off_market_signalen').update({ lat, lng } as never).eq('id', signaalId);
      } else if (r.status === 'geen_adres') {
        await supabase.from('off_market_signalen').update({
          geo_status: 'geen_coordinaten',
          geo_verrijkt_op: new Date().toISOString(),
          geo_foutmelding: null,
        }).eq('id', signaalId);
        return { id: signaalId, status: 'geen_coordinaten' };
      } else {
        await supabase.from('off_market_signalen').update({
          geo_status: 'geen_match',
          geo_verrijkt_op: new Date().toISOString(),
          geo_foutmelding: `ensureCoords: ${r.reden}`.slice(0, 500),
        }).eq('id', signaalId);
        return { id: signaalId, status: 'geen_match' };
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await supabase.from('off_market_signalen').update({
        geo_status: 'fout',
        geo_foutmelding: `ensureCoords: ${msg}`.slice(0, 500),
        geo_verrijkt_op: new Date().toISOString(),
      }).eq('id', signaalId);
      return { id: signaalId, status: 'fout', error: msg };
    }
  }

  try {
    const { pdok, httpStatus, url } = await pdokReverse(lat!, lng!);
    const p = buildPatch(pdok);
    const now = new Date().toISOString();
    const dbg = debug ? { url, httpStatus, ensured_coords: ensured, patch: p } : undefined;
    if (!p.hasAny) {
      await supabase.from('off_market_signalen').update({
        geo_status: 'geen_match',
        geo_verrijkt_op: now,
        geo_foutmelding: null,
      }).eq('id', signaalId);
      return { id: signaalId, status: 'geen_match', ensured_coords: ensured, debug: dbg };
    }
    await supabase.from('off_market_signalen').update({
      geo_gemeente_naam: p.geo_gemeente_naam,
      geo_gemeente_code: p.geo_gemeente_code,
      geo_wijk_naam: p.geo_wijk_naam,
      geo_wijk_code: p.geo_wijk_code,
      geo_buurt_naam: p.geo_buurt_naam,
      geo_buurt_code: p.geo_buurt_code,
      geo_bron: BRON,
      geo_verrijkt_op: now,
      geo_status: 'verrijkt',
      geo_foutmelding: null,
    }).eq('id', signaalId);
    return { id: signaalId, status: 'verrijkt', ensured_coords: ensured, debug: dbg };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await supabase.from('off_market_signalen').update({
      geo_status: 'fout',
      geo_foutmelding: `reverse: ${msg}`.slice(0, 500),
      geo_verrijkt_op: new Date().toISOString(),
    }).eq('id', signaalId);
    return { id: signaalId, status: 'fout', error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const cronSecret = Deno.env.get('OFF_MARKET_CRON_SECRET');
  const providedCron = req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret');
  const isCronCall = !!cronSecret && !!providedCron && providedCron === cronSecret;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (!isCronCall) {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Niet geautoriseerd' }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const token = auth.replace(/^Bearer\s+/i, '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonResponse({ error: 'Niet geautoriseerd' }, 401);
    }
    const { data: isIntern } = await supabase.rpc('is_intern_gebruiker', { _user_id: claimsData.claims.sub as string });
    if (!isIntern) return jsonResponse({ error: 'Geen toegang' }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  try {
    if (body?.batch === true) {
      const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 100);
      const force = body.force === true;
      const retryFailed = body.retry_failed === true;

      // Selecteer alle nog niet-verrijkte signalen (incl. zonder lat/lng).
      let q = supabase
        .from('off_market_signalen')
        .select('id, lat, lng, geo_status, geo_gemeente_naam, adres, postcode, plaats')
        .limit(limit);

      if (force) {
        // Geen extra filter — verwerk alles.
      } else if (retryFailed) {
        q = q.in('geo_status', ['niet_verrijkt', 'geen_match', 'geen_coordinaten', 'fout'])
             .is('geo_gemeente_naam', null);
      } else {
        q = q.eq('geo_status', 'niet_verrijkt');
      }

      const { data: rows, error } = await q;
      if (error) return jsonResponse({ error: error.message }, 500);

      const tellers = {
        totaal: rows?.length ?? 0,
        verrijkt: 0, skipped: 0,
        geen_coordinaten: 0, geen_match: 0, fout: 0,
        ensured_coords: 0,
      };
      for (const r of rows ?? []) {
        const res = await verrijkOne(supabase, r.id as string, force);
        if (res.skipped) tellers.skipped++;
        else if (res.status === 'verrijkt') tellers.verrijkt++;
        else if (res.status === 'geen_coordinaten') tellers.geen_coordinaten++;
        else if (res.status === 'geen_match') tellers.geen_match++;
        else if (res.status === 'fout') tellers.fout++;
        if (res.ensured_coords) tellers.ensured_coords++;
        await new Promise((r) => setTimeout(r, 60));
      }
      return jsonResponse({ ok: true, ...tellers });
    }

    const signaalId = body?.signaal_id;
    if (!signaalId || typeof signaalId !== 'string') {
      return jsonResponse({ error: 'signaal_id ontbreekt' }, 400);
    }
    const res = await verrijkOne(supabase, signaalId, body?.force === true, body?.debug === true);
    return jsonResponse({ ok: true, ...res });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
