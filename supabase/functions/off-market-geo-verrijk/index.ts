// Off-Market Geo-verrijking V1
// Verrijkt signalen met officiële gemeente/wijk/buurt op basis van lat/lng
// via PDOK Locatieserver reverse geocoder (open data, geen sleutel).
//
// Input: { signaal_id: uuid, force?: boolean }
//      | { batch: true, limit?: number, force?: boolean }

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse';
const BRON = 'pdok_locatieserver';

type GeoStatus = 'niet_verrijkt' | 'verrijkt' | 'geen_coordinaten' | 'geen_match' | 'fout';

interface GeoPatch {
  geo_gemeente_naam: string | null;
  geo_gemeente_code: string | null;
  geo_wijk_naam: string | null;
  geo_wijk_code: string | null;
  geo_buurt_naam: string | null;
  geo_buurt_code: string | null;
  geo_bron: string | null;
  geo_verrijkt_op: string;
  geo_status: GeoStatus;
  geo_foutmelding: string | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function pdokReverse(lat: number, lon: number): Promise<any> {
  const url = `${PDOK_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&type=gemeente,wijk,buurt&rows=10`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`PDOK HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw new Error('PDOK onbereikbaar');
}

/** Extract eerste doc per gewenst type uit PDOK response. */
function extractGeo(pdok: any): {
  gemeente?: { naam: string; code: string };
  wijk?: { naam: string; code: string };
  buurt?: { naam: string; code: string };
} {
  const docs: any[] = pdok?.response?.docs ?? [];
  const pick = (type: string) => docs.find((d) => d?.type === type);
  const out: any = {};
  const g = pick('gemeente');
  if (g?.gemeentenaam && g?.gemeentecode) {
    out.gemeente = { naam: String(g.gemeentenaam), code: String(g.gemeentecode) };
  }
  const w = pick('wijk');
  if (w?.wijknaam && w?.wijkcode) {
    out.wijk = { naam: String(w.wijknaam), code: String(w.wijkcode) };
  }
  const b = pick('buurt');
  if (b?.buurtnaam && b?.buurtcode) {
    out.buurt = { naam: String(b.buurtnaam), code: String(b.buurtcode) };
  }
  // Fallback: vul gemeente/wijk vanuit buurt-doc indien apart record ontbreekt.
  if (!out.gemeente && b?.gemeentenaam && b?.gemeentecode) {
    out.gemeente = { naam: String(b.gemeentenaam), code: String(b.gemeentecode) };
  }
  if (!out.wijk && b?.wijknaam && b?.wijkcode) {
    out.wijk = { naam: String(b.wijknaam), code: String(b.wijkcode) };
  }
  return out;
}

export function buildPatch(
  pdok: any,
): Pick<GeoPatch,
  'geo_gemeente_naam' | 'geo_gemeente_code' |
  'geo_wijk_naam' | 'geo_wijk_code' |
  'geo_buurt_naam' | 'geo_buurt_code'
> & { hasAny: boolean } {
  const g = extractGeo(pdok);
  return {
    geo_gemeente_naam: g.gemeente?.naam ?? null,
    geo_gemeente_code: g.gemeente?.code ?? null,
    geo_wijk_naam: g.wijk?.naam ?? null,
    geo_wijk_code: g.wijk?.code ?? null,
    geo_buurt_naam: g.buurt?.naam ?? null,
    geo_buurt_code: g.buurt?.code ?? null,
    hasAny: Boolean(g.gemeente || g.wijk || g.buurt),
  };
}

async function verrijkOne(
  supabase: ReturnType<typeof createClient>,
  signaalId: string,
  force: boolean,
): Promise<{ id: string; status: GeoStatus; skipped?: boolean; error?: string }> {
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
    const pdok = await pdokReverse(lat, lng);
    const p = buildPatch(pdok);
    const now = new Date().toISOString();
    if (!p.hasAny) {
      await supabase.from('off_market_signalen').update({
        geo_status: 'geen_match',
        geo_verrijkt_op: now,
        geo_foutmelding: null,
      }).eq('id', signaalId);
      return { id: signaalId, status: 'geen_match' };
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
    return { id: signaalId, status: 'verrijkt' };
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
      let q = supabase
        .from('off_market_signalen')
        .select('id')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(limit);
      if (!force) q = q.eq('geo_status', 'niet_verrijkt');
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
        // lichte throttle om PDOK te ontzien
        await new Promise((r) => setTimeout(r, 60));
      }
      return jsonResponse({ ok: true, ...tellers });
    }

    const signaalId = body?.signaal_id;
    if (!signaalId || typeof signaalId !== 'string') {
      return jsonResponse({ error: 'signaal_id ontbreekt' }, 400);
    }
    const res = await verrijkOne(supabase, signaalId, body?.force === true);
    return jsonResponse({ ok: true, ...res });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
