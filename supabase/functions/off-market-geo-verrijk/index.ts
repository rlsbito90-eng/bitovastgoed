// Off-Market Geo-verrijking V1
// Verrijkt signalen met officiële gemeente/wijk/buurt op basis van lat/lng
// via PDOK Locatieserver reverse geocoder (open data, geen sleutel).
//
// Input: { signaal_id: uuid, force?: boolean, debug?: boolean }
//      | { batch: true, limit?: number, force?: boolean, retry_failed?: boolean }

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PDOK_BASE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse';
const BRON = 'pdok_locatieserver';

type GeoStatus = 'niet_verrijkt' | 'verrijkt' | 'geen_coordinaten' | 'geen_match' | 'fout';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildPdokUrl(lat: number, lon: number): string {
  const params = new URLSearchParams();
  params.append('lat', String(lat));
  params.append('lon', String(lon));
  // Meerdere type-parameters (PDOK verwacht aparte values, geen comma-list).
  params.append('type', 'gemeente');
  params.append('type', 'wijk');
  params.append('type', 'buurt');
  params.append('rows', '20');
  // CRITICAL: zonder fl=* retourneert PDOK alleen type/weergavenaam/id/score/afstand.
  params.append('fl', '*');
  params.append('wt', 'json');
  return `${PDOK_BASE}?${params.toString()}`;
}

async function pdokReverse(
  lat: number,
  lon: number,
): Promise<{ pdok: any; httpStatus: number; url: string }> {
  const url = buildPdokUrl(lat, lon);
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
      const pdok = await res.json();
      return { pdok, httpStatus: res.status, url };
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw new Error(`PDOK onbereikbaar (laatste status ${lastStatus})`);
}

/** Strip suffix " Amsterdam" of "Gemeente " etc. uit weergavenaam wanneer mogelijk. */
function cleanWeergave(w: string | undefined, kind: 'gemeente' | 'wijk' | 'buurt'): string | null {
  if (!w) return null;
  let s = String(w).trim();
  if (kind === 'gemeente') s = s.replace(/^Gemeente\s+/i, '');
  return s || null;
}

function pickName(d: any, namen: string[], fallbackKind: 'gemeente' | 'wijk' | 'buurt'): string | null {
  for (const n of namen) {
    const v = d?.[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return cleanWeergave(d?.weergavenaam, fallbackKind);
}

function pickCode(d: any, codes: string[]): string | null {
  for (const c of codes) {
    const v = d?.[c];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

export function buildPatch(pdok: any): {
  geo_gemeente_naam: string | null;
  geo_gemeente_code: string | null;
  geo_wijk_naam: string | null;
  geo_wijk_code: string | null;
  geo_buurt_naam: string | null;
  geo_buurt_code: string | null;
  hasAny: boolean;
} {
  // Tolerant: accepteer zowel response.docs als response.response.docs.
  const docs: any[] =
    pdok?.response?.docs ??
    pdok?.response?.response?.docs ??
    pdok?.docs ??
    [];

  const byType = (t: string) =>
    docs.find((d) => String(d?.type ?? '').toLowerCase() === t);

  const g = byType('gemeente');
  const w = byType('wijk');
  const b = byType('buurt');

  let gemeenteNaam = pickName(g, ['gemeentenaam', 'gemeente_naam'], 'gemeente');
  let gemeenteCode = pickCode(g, ['gemeentecode', 'gemeente_code']);
  // Fallback: pak gemeente uit wijk/buurt doc als losse doc ontbreekt.
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

async function verrijkOne(
  supabase: ReturnType<typeof createClient>,
  signaalId: string,
  force: boolean,
  debug = false,
): Promise<{ id: string; status: GeoStatus; skipped?: boolean; error?: string; debug?: any }> {
  const { data: signaal, error } = await supabase
    .from('off_market_signalen')
    .select('id, lat, lng, geo_status')
    .eq('id', signaalId)
    .maybeSingle();
  if (error) return { id: signaalId, status: 'fout', error: error.message };
  if (!signaal) return { id: signaalId, status: 'fout', error: 'Signaal niet gevonden' };

  if (signaal.geo_status === 'verrijkt' && !force) {
    return { id: signaalId, status: 'verrijkt', skipped: true };
  }

  const lat = signaal.lat == null ? null : Number(signaal.lat);
  const lng = signaal.lng == null ? null : Number(signaal.lng);
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    await supabase.from('off_market_signalen').update({
      geo_status: 'geen_coordinaten',
      geo_verrijkt_op: new Date().toISOString(),
      geo_foutmelding: null,
    }).eq('id', signaalId);
    return { id: signaalId, status: 'geen_coordinaten' };
  }

  try {
    const { pdok, httpStatus, url } = await pdokReverse(lat, lng);
    const p = buildPatch(pdok);
    const now = new Date().toISOString();
    const dbg = debug ? {
      url, httpStatus,
      numFound: pdok?.response?.numFound,
      types: (pdok?.response?.docs ?? []).slice(0, 5).map((d: any) => d?.type),
      sample: (pdok?.response?.docs ?? [])[0],
      patch: p,
    } : undefined;

    if (!p.hasAny) {
      await supabase.from('off_market_signalen').update({
        geo_status: 'geen_match',
        geo_verrijkt_op: now,
        geo_foutmelding: null,
      }).eq('id', signaalId);
      return { id: signaalId, status: 'geen_match', debug: dbg };
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
    return { id: signaalId, status: 'verrijkt', debug: dbg };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await supabase.from('off_market_signalen').update({
      geo_status: 'fout',
      geo_foutmelding: msg.slice(0, 500),
      geo_verrijkt_op: new Date().toISOString(),
    }).eq('id', signaalId);
    return { id: signaalId, status: 'fout', error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Niet geautoriseerd' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  try {
    if (body?.batch === true) {
      const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 100);
      const force = body.force === true;
      const retryFailed = body.retry_failed === true;

      let q = supabase
        .from('off_market_signalen')
        .select('id, geo_gemeente_naam')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(limit);

      if (force) {
        // Geen extra filter — verwerk alles inclusief reeds verrijkt.
      } else if (retryFailed) {
        // Retry mislukte/niet-gematchte records die nog geen gemeente hebben.
        q = q.in('geo_status', ['niet_verrijkt', 'geen_match', 'fout']).is('geo_gemeente_naam', null);
      } else {
        q = q.eq('geo_status', 'niet_verrijkt');
      }

      const { data: rows, error } = await q;
      if (error) return jsonResponse({ error: error.message }, 500);

      const tellers = { totaal: rows?.length ?? 0, verrijkt: 0, skipped: 0, geen_coordinaten: 0, geen_match: 0, fout: 0 };
      for (const r of rows ?? []) {
        const res = await verrijkOne(supabase, r.id as string, force);
        if (res.skipped) tellers.skipped++;
        else if (res.status === 'verrijkt') tellers.verrijkt++;
        else if (res.status === 'geen_coordinaten') tellers.geen_coordinaten++;
        else if (res.status === 'geen_match') tellers.geen_match++;
        else if (res.status === 'fout') tellers.fout++;
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
