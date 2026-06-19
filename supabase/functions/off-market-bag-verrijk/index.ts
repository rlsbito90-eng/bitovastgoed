// Off-Market Radar V2.3 — BAG-verrijking als pre-check vóór betaald Kadaster.
// Gebruikt PDOK Locatieserver (gratis, geen key):
//   /search/v3_1/free   → vind nummeraanduidingen op adres
//   /search/v3_1/lookup → haal volledige BAG-velden per nummeraanduiding/VBO
//
// Schrijft alleen bag_*-velden. Overschrijft GEEN business-velden.
// Roept GEEN betaalde Kadaster-API aan.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PDOK_FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_LOOKUP = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup';
const MAX_VBOS = 6;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normPostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(c) ? c : null;
}

function extractHuisnummer(adres: string | null | undefined): string | null {
  if (!adres) return null;
  const m = String(adres).match(/\b(\d{1,5})\b/);
  return m ? m[1] : null;
}

interface SignaalShallow {
  id: string;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  titel: string | null;
  bag_status: string | null;
}

function buildFreeQuery(s: SignaalShallow): string {
  const parts: string[] = [];
  const pc = normPostcode(s.postcode);
  if (pc) parts.push(`${pc.slice(0, 4)} ${pc.slice(4)}`);
  if (s.adres) parts.push(s.adres);
  if (s.plaats) parts.push(s.plaats);
  return parts.filter(Boolean).join(' ').trim();
}

async function pdokFetch(url: string): Promise<any> {
  let lastStatus = 0;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      lastStatus = r.status;
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 200 * (i + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`PDOK HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((res) => setTimeout(res, 200 * (i + 1)));
    }
  }
  throw new Error(`PDOK onbereikbaar (laatste status ${lastStatus})`);
}

async function pdokFree(q: string): Promise<any[]> {
  const url = new URL(PDOK_FREE);
  url.searchParams.set('q', q);
  url.searchParams.set('fq', 'type:adres');
  url.searchParams.set('fl',
    'id,weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,' +
    'postcode,woonplaatsnaam,nummeraanduiding_id,adresseerbaar_object_id');
  url.searchParams.set('rows', '10');
  const j = await pdokFetch(url.toString());
  return (j?.response?.docs ?? []) as any[];
}

async function pdokLookup(id: string): Promise<any | null> {
  const url = new URL(PDOK_LOOKUP);
  url.searchParams.set('id', id);
  url.searchParams.set('fl', '*');
  const j = await pdokFetch(url.toString());
  const docs = (j?.response?.docs ?? []) as any[];
  return docs[0] ?? null;
}

function pickFirst<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v;
}

function bepaalMatchKwaliteit(s: SignaalShallow, docs: any[]): string {
  if (docs.length === 0) return 'onzeker';
  const pc = normPostcode(s.postcode);
  const huisnr = extractHuisnummer(s.adres);
  if (docs.length === 1) {
    const d = docs[0];
    const docPc = String(d.postcode ?? '').replace(/\s+/g, '').toUpperCase();
    if (pc && huisnr && docPc === pc && String(d.huisnummer ?? '') === huisnr) {
      return 'exact';
    }
    if (pc && docPc === pc) return 'postcode_huisnummer';
    if (d.straatnaam && d.huisnummer) return 'straat_huisnummer';
    return 'onzeker';
  }
  // Filter docs op exact postcode+huisnummer; bij 1 hit → exact.
  if (pc && huisnr) {
    const exacte = docs.filter((d) =>
      String(d.postcode ?? '').replace(/\s+/g, '').toUpperCase() === pc
      && String(d.huisnummer ?? '') === huisnr);
    if (exacte.length === 1) return 'exact';
  }
  return 'onzeker';
}

interface BagVbo {
  nummeraanduiding_id: string;
  vbo_id: string;
  adres: string;
  opp_m2: number | null;
  gebruiksdoel: string[];
  status: string | null;
}

interface VerrijkResult {
  status: string;
  aantal_vbo?: number;
  error?: string;
  skipped?: boolean;
}

async function verrijk(
  supabase: any,
  signaalId: string,
  force: boolean,
): Promise<VerrijkResult> {
  const { data: s, error } = await supabase
    .from('off_market_signalen')
    .select('id, adres, postcode, plaats, titel, bag_status')
    .eq('id', signaalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error('Signaal niet gevonden');

  if (s.bag_status === 'verrijkt' && !force) {
    return { status: 'verrijkt', skipped: true };
  }
  if (s.bag_status === 'bezig' && !force) {
    return { status: 'bezig', skipped: true };
  }

  await supabase.from('off_market_signalen').update({
    bag_status: 'bezig',
    bag_foutmelding: null,
  }).eq('id', signaalId);

  try {
    const q = buildFreeQuery(s);
    if (!q) {
      await supabase.from('off_market_signalen').update({
        bag_status: 'geen_match',
        bag_foutmelding: 'Onvoldoende adresdata',
        bag_verrijkt_op: new Date().toISOString(),
      }).eq('id', signaalId);
      return { status: 'geen_match' };
    }

    const docs = await pdokFree(q);
    if (docs.length === 0) {
      await supabase.from('off_market_signalen').update({
        bag_status: 'geen_match',
        bag_verrijkt_op: new Date().toISOString(),
        bag_foutmelding: null,
      }).eq('id', signaalId);
      return { status: 'geen_match' };
    }

    const matchKw = bepaalMatchKwaliteit(s, docs);
    const isMeerdere = docs.length > 1 && matchKw !== 'exact';

    // Filter naar exacte matches als die er zijn, anders eerste N.
    const pc = normPostcode(s.postcode);
    const huisnr = extractHuisnummer(s.adres);
    let docsKlein = docs;
    if (pc && huisnr) {
      const exact = docs.filter((d) =>
        String(d.postcode ?? '').replace(/\s+/g, '').toUpperCase() === pc
        && String(d.huisnummer ?? '') === huisnr);
      if (exact.length > 0) docsKlein = exact;
    }
    docsKlein = docsKlein.slice(0, MAX_VBOS);

    const vbos: BagVbo[] = [];
    const pandIds = new Set<string>();
    const vboIds = new Set<string>();
    const gebruiksdoelen = new Set<string>();
    let totaalOpp = 0;
    let bouwjaar: number | null = null;
    let pandStatus: string | null = null;

    for (const d of docsKlein) {
      const lookupId = d.nummeraanduiding_id ?? d.id;
      if (!lookupId) continue;
      let det: any = null;
      try { det = await pdokLookup(String(lookupId)); } catch { continue; }
      if (!det) continue;
      const vboId = det.adresseerbaar_object_id ?? det.id ?? '';
      const oppRaw = pickFirst<any>(det.oppervlakte);
      const opp = oppRaw == null ? null
        : (typeof oppRaw === 'number' ? oppRaw
          : Number.isFinite(Number(oppRaw)) ? Number(oppRaw) : null);
      const gdArr = Array.isArray(det.gebruiksdoel)
        ? det.gebruiksdoel.map((x: any) => String(x))
        : (det.gebruiksdoel ? [String(det.gebruiksdoel)] : []);
      gdArr.forEach((x: string) => gebruiksdoelen.add(x));
      if (typeof opp === 'number' && Number.isFinite(opp)) totaalOpp += opp;
      const pandId = pickFirst<any>(det.pandid);
      if (pandId) pandIds.add(String(pandId));
      if (vboId) vboIds.add(String(vboId));
      const bjRaw = pickFirst<any>(det.bouwjaar);
      if (bjRaw != null) {
        const bj = Number(bjRaw);
        if (Number.isFinite(bj)) bouwjaar = bouwjaar == null ? bj : Math.min(bouwjaar, bj);
      }
      if (!pandStatus) {
        const ps = pickFirst<any>(det.pandstatus);
        if (ps) pandStatus = String(ps);
      }
      const status = pickFirst<any>(det.status);
      vbos.push({
        nummeraanduiding_id: String(lookupId),
        vbo_id: String(vboId),
        adres: String(det.weergavenaam ?? d.weergavenaam ?? ''),
        opp_m2: typeof opp === 'number' && Number.isFinite(opp) ? Math.round(opp) : null,
        gebruiksdoel: gdArr,
        status: status ? String(status) : null,
      });
    }

    const eindStatus = isMeerdere ? 'meerdere_matches' : 'verrijkt';

    await supabase.from('off_market_signalen').update({
      bag_status: eindStatus,
      bag_totaal_oppervlakte_m2: Math.round(totaalOpp) || null,
      bag_aantal_panden: pandIds.size || null,
      bag_aantal_vbo: vboIds.size || vbos.length || null,
      bag_gebruiksdoelen: Array.from(gebruiksdoelen),
      bag_bouwjaar: bouwjaar,
      bag_pand_status: pandStatus,
      bag_pand_ids: Array.from(pandIds),
      bag_vbo_ids: Array.from(vboIds),
      bag_match_kwaliteit: matchKw,
      bag_verrijkt_op: new Date().toISOString(),
      bag_foutmelding: null,
      bag_vbos: vbos,
    }).eq('id', signaalId);

    return { status: eindStatus, aantal_vbo: vbos.length };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await supabase.from('off_market_signalen').update({
      bag_status: 'fout',
      bag_foutmelding: msg.slice(0, 500),
      bag_verrijkt_op: new Date().toISOString(),
    }).eq('id', signaalId);
    return { status: 'fout', error: msg };
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
  const signaalId = body?.signaal_id;
  if (!signaalId || typeof signaalId !== 'string') {
    return jsonResponse({ error: 'signaal_id ontbreekt' }, 400);
  }

  try {
    const res = await verrijk(supabase, signaalId, body?.force === true);
    return jsonResponse({ ok: true, id: signaalId, ...res });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
