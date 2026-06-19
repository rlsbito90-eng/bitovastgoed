// Off-Market Radar V2.3 + V2.4 — BAG-verrijking als pre-check vóór betaald Kadaster.
// Gebruikt PDOK Locatieserver (gratis, geen key):
//   /search/v3_1/free   → vind nummeraanduidingen op adres of pandid
//   /search/v3_1/lookup → haal volledige BAG-velden per nummeraanduiding/VBO
// Fallback BAG Individuele Bevragingen v2 wordt geprobeerd indien Locatieserver
// geen VBO's vindt voor een pandid.
//
// Modes:
//   A) zonder selectie  → eerste match of matchkandidaten + meerdere_matches
//   B) met selectie     → bewaar doelobject, dan Mode C
//   C) pandcontext      → haal alle VBO's binnen hetzelfde BAG-pand
//
// Schrijft alleen bag_*-velden. Roept GEEN betaalde Kadaster-API aan.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PDOK_FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_LOOKUP = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup';
const BAG_IB_PAND_VBOS =
  'https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/panden';
const MAX_VBOS = 50;
const MAX_KANDIDATEN = 10;
const PARALLEL = 6;

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

/** Geordende lijst zoekvarianten. Postcode + huisnummer is leidend bij NL-adressen. */
function buildSearchQueries(s: SignaalShallow): string[] {
  const pc = normPostcode(s.postcode);
  const huisnr = extractHuisnummer(s.adres);
  const out: string[] = [];
  if (pc && huisnr) {
    const pcFmt = `${pc.slice(0, 4)} ${pc.slice(4)}`;
    if (s.plaats) out.push(`${pcFmt} ${huisnr} ${s.plaats}`);
    out.push(`${pcFmt} ${huisnr}`);
  }
  const volledig = buildFreeQuery(s);
  if (volledig) out.push(volledig);
  if (s.adres && s.plaats) out.push(`${s.adres} ${s.plaats}`);
  // De-dup
  return Array.from(new Set(out.map((q) => q.trim()).filter(Boolean)));
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
    'postcode,woonplaatsnaam,nummeraanduiding_id,adresseerbaarobject_id');
  url.searchParams.set('rows', '10');
  const j = await pdokFetch(url.toString());
  return (j?.response?.docs ?? []) as any[];
}

/** Probeer queries op volgorde tot er resultaten zijn. */
async function pdokFreeMulti(queries: string[]): Promise<{ docs: any[]; usedQuery: string }> {
  for (const q of queries) {
    try {
      const docs = await pdokFree(q);
      if (docs.length > 0) return { docs, usedQuery: q };
    } catch (e) {
      console.warn('[pdokFreeMulti] query faalde', q, (e as Error).message);
    }
  }
  return { docs: [], usedQuery: queries[queries.length - 1] ?? '' };
}

async function pdokFreeByPandid(pandid: string): Promise<any[]> {
  const url = new URL(PDOK_FREE);
  url.searchParams.set('q', '*');
  url.searchParams.append('fq', 'type:adres');
  url.searchParams.append('fq', `pandid:${pandid}`);
  url.searchParams.set('fl',
    'id,weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,' +
    'postcode,woonplaatsnaam,nummeraanduiding_id,adresseerbaar_object_id,pandid');
  url.searchParams.set('rows', String(MAX_VBOS));
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

/** Fallback — BAG Individuele Bevragingen v2 (publiek). Best-effort. */
async function bagIbVbosByPand(pandid: string): Promise<string[]> {
  try {
    const url = `${BAG_IB_PAND_VBOS}/${encodeURIComponent(pandid)}/adresseerbareobjecten`;
    const r = await fetch(url, {
      headers: { Accept: 'application/hal+json', 'X-Api-Version': '2' },
    });
    if (!r.ok) {
      await r.text();
      return [];
    }
    const j = await r.json();
    const list = (j?._embedded?.adresseerbareObjecten ?? []) as any[];
    return list
      .map((a) => a?.identificatie ?? a?.adresseerbaarObjectIdentificatie)
      .filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
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

interface BagMatchKandidaat {
  adres: string;
  vbo_id?: string | null;
  nummeraanduiding_id?: string | null;
  /** PDOK locatieserver doc-id ("adr-..."). Nodig voor latere lookup. */
  pdok_id?: string | null;
  opp_m2?: number | null;
  gebruiksdoel?: string[] | null;
  status?: string | null;
  pandid?: string | null;
  match_kwaliteit?: string | null;
  match_reden?: string | null;
}

interface LookupVbo {
  nummeraanduiding_id: string;
  vbo_id: string;
  adres: string;
  opp_m2: number | null;
  gebruiksdoel: string[];
  status: string | null;
  pandid: string | null;
  bouwjaar: number | null;
  pandstatus: string | null;
}

function detailToVbo(det: any, fallbackAdres = ''): LookupVbo {
  const oppRaw = pickFirst<any>(det.oppervlakte);
  const opp = oppRaw == null ? null
    : (typeof oppRaw === 'number' ? oppRaw
      : Number.isFinite(Number(oppRaw)) ? Number(oppRaw) : null);
  const gdArr = Array.isArray(det.gebruiksdoel)
    ? det.gebruiksdoel.map((x: any) => String(x))
    : (det.gebruiksdoel ? [String(det.gebruiksdoel)] : []);
  const pandId = pickFirst<any>(det.pandid);
  const bjRaw = pickFirst<any>(det.bouwjaar);
  const bj = bjRaw != null && Number.isFinite(Number(bjRaw)) ? Number(bjRaw) : null;
  const ps = pickFirst<any>(det.pandstatus);
  const status = pickFirst<any>(det.status);
  return {
    nummeraanduiding_id: String(det.nummeraanduiding_id ?? ''),
    vbo_id: String(det.adresseerbaarobject_id ?? det.adresseerbaar_object_id ?? ''),
    adres: String(det.weergavenaam ?? fallbackAdres ?? ''),
    opp_m2: typeof opp === 'number' && Number.isFinite(opp) ? Math.round(opp) : null,
    gebruiksdoel: gdArr,
    status: status ? String(status) : null,
    pandid: pandId ? String(pandId) : null,
    bouwjaar: bj,
    pandstatus: ps ? String(ps) : null,
  };
}

async function runParallel<T, R>(
  items: T[], parallel: number, fn: (it: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += parallel) {
    const slice = items.slice(i, i + parallel);
    const res = await Promise.allSettled(slice.map(fn));
    out.push(...res);
  }
  return out;
}

interface PandContext {
  vbos: BagVbo[];
  pandIds: string[];
  vboIds: string[];
  gebruiksdoelen: string[];
  totaalOpp: number;
  bouwjaar: number | null;
  pandStatus: string | null;
  meerVbosBeschikbaar: boolean;
}

async function fetchPandContext(pandid: string): Promise<PandContext> {
  // 1. Locatieserver eerst.
  let lookupIds: string[] = [];
  let primair: any[] = [];
  try {
    primair = await pdokFreeByPandid(pandid);
    lookupIds = primair
      .map((d) => d.nummeraanduiding_id ?? d.id)
      .filter((v) => typeof v === 'string') as string[];
  } catch { /* fall through */ }

  // 2. Fallback — BAG IB v2.
  if (lookupIds.length === 0) {
    const vboIds = await bagIbVbosByPand(pandid);
    lookupIds = vboIds; // worden ook door /lookup geaccepteerd op vbo-id
  }

  const meerVbosBeschikbaar = lookupIds.length > MAX_VBOS;
  const beperkt = lookupIds.slice(0, MAX_VBOS);

  const results = await runParallel(beperkt, PARALLEL, async (id) => {
    const det = await pdokLookup(String(id));
    if (!det) return null;
    return detailToVbo(det);
  });

  const vbos: BagVbo[] = [];
  const pandIds = new Set<string>([pandid]);
  const vboIds = new Set<string>();
  const gebruiksdoelen = new Set<string>();
  let totaalOpp = 0;
  let bouwjaar: number | null = null;
  let pandStatus: string | null = null;

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const v = r.value;
    if (v.vbo_id) vboIds.add(v.vbo_id);
    if (v.pandid) pandIds.add(v.pandid);
    v.gebruiksdoel.forEach((g) => gebruiksdoelen.add(g));
    if (typeof v.opp_m2 === 'number') totaalOpp += v.opp_m2;
    if (v.bouwjaar != null) bouwjaar = bouwjaar == null ? v.bouwjaar : Math.min(bouwjaar, v.bouwjaar);
    if (!pandStatus && v.pandstatus) pandStatus = v.pandstatus;
    vbos.push({
      nummeraanduiding_id: v.nummeraanduiding_id,
      vbo_id: v.vbo_id,
      adres: v.adres,
      opp_m2: v.opp_m2,
      gebruiksdoel: v.gebruiksdoel,
      status: v.status,
    });
  }

  return {
    vbos,
    pandIds: Array.from(pandIds),
    vboIds: Array.from(vboIds),
    gebruiksdoelen: Array.from(gebruiksdoelen),
    totaalOpp,
    bouwjaar,
    pandStatus,
    meerVbosBeschikbaar,
  };
}

interface VerrijkResult {
  status: string;
  aantal_vbo?: number;
  kandidaten?: number;
  error?: string;
  skipped?: boolean;
}

async function verrijk(
  supabase: any,
  signaalId: string,
  opts: { force?: boolean; selectedVboId?: string; selectedNaId?: string },
): Promise<VerrijkResult> {
  const { data: s, error } = await supabase
    .from('off_market_signalen')
    .select('id, adres, postcode, plaats, titel, bag_status')
    .eq('id', signaalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error('Signaal niet gevonden');

  const hasSelection = !!(opts.selectedVboId || opts.selectedNaId);

  if (!hasSelection) {
    if (s.bag_status === 'verrijkt' && !opts.force) {
      return { status: 'verrijkt', skipped: true };
    }
    if (s.bag_status === 'bezig' && !opts.force) {
      return { status: 'bezig', skipped: true };
    }
  }

  await supabase.from('off_market_signalen').update({
    bag_status: 'bezig',
    bag_foutmelding: null,
  }).eq('id', signaalId);

  try {
    // ====== Mode B + C — met selectie ======
    if (hasSelection) {
      const lookupId = opts.selectedNaId || opts.selectedVboId!;
      const det = await pdokLookup(lookupId);
      if (!det) {
        await supabase.from('off_market_signalen').update({
          bag_status: 'fout',
          bag_foutmelding: 'Gekozen BAG-match niet gevonden in PDOK',
          bag_verrijkt_op: new Date().toISOString(),
        }).eq('id', signaalId);
        return { status: 'fout', error: 'Gekozen BAG-match niet gevonden' };
      }
      const gekozen = detailToVbo(det);

      // Doelobject-velden persisteren
      const doelPatch: Record<string, unknown> = {
        bag_geselecteerd_vbo_id: gekozen.vbo_id || null,
        bag_geselecteerd_nummeraanduiding_id: gekozen.nummeraanduiding_id || null,
        bag_geselecteerd_adres: gekozen.adres || null,
        bag_geselecteerd_opp_m2: gekozen.opp_m2,
        bag_geselecteerd_gebruiksdoel: gekozen.gebruiksdoel,
      };

      // Mode C — pandcontext
      let ctx: PandContext;
      if (gekozen.pandid) {
        ctx = await fetchPandContext(gekozen.pandid);
      } else {
        // geen pandid → alleen het gekozen VBO als context
        ctx = {
          vbos: [{
            nummeraanduiding_id: gekozen.nummeraanduiding_id,
            vbo_id: gekozen.vbo_id,
            adres: gekozen.adres,
            opp_m2: gekozen.opp_m2,
            gebruiksdoel: gekozen.gebruiksdoel,
            status: gekozen.status,
          }],
          pandIds: [],
          vboIds: gekozen.vbo_id ? [gekozen.vbo_id] : [],
          gebruiksdoelen: gekozen.gebruiksdoel,
          totaalOpp: gekozen.opp_m2 ?? 0,
          bouwjaar: gekozen.bouwjaar,
          pandStatus: gekozen.pandstatus,
          meerVbosBeschikbaar: false,
        };
      }

      await supabase.from('off_market_signalen').update({
        ...doelPatch,
        bag_status: 'verrijkt',
        bag_match_kwaliteit: 'exact',
        bag_match_kandidaten: null,
        bag_vbos: ctx.vbos,
        bag_totaal_oppervlakte_m2: Math.round(ctx.totaalOpp) || null,
        bag_aantal_vbo: ctx.vboIds.length || ctx.vbos.length || null,
        bag_aantal_panden: ctx.pandIds.length || null,
        bag_gebruiksdoelen: ctx.gebruiksdoelen,
        bag_bouwjaar: ctx.bouwjaar,
        bag_pand_status: ctx.pandStatus,
        bag_pand_ids: ctx.pandIds,
        bag_vbo_ids: ctx.vboIds,
        bag_pandcontext_aantal_vbo: ctx.vbos.length,
        bag_pandcontext_totaal_opp_m2: Math.round(ctx.totaalOpp) || null,
        bag_verrijkt_op: new Date().toISOString(),
        bag_foutmelding: null,
      }).eq('id', signaalId);

      return { status: 'verrijkt', aantal_vbo: ctx.vbos.length };
    }

    // ====== Mode A — initial enrich ======
    const queries = buildSearchQueries(s);
    if (queries.length === 0) {
      await supabase.from('off_market_signalen').update({
        bag_status: 'geen_match',
        bag_foutmelding: 'Onvoldoende adresdata',
        bag_verrijkt_op: new Date().toISOString(),
      }).eq('id', signaalId);
      return { status: 'geen_match' };
    }

    const { docs, usedQuery } = await pdokFreeMulti(queries);
    console.log('[bag-verrijk] PDOK queries tried', queries, '→ used:', usedQuery, '→ docs:', docs.length);
    if (docs.length === 0) {
      await supabase.from('off_market_signalen').update({
        bag_status: 'geen_match',
        bag_verrijkt_op: new Date().toISOString(),
        bag_foutmelding: null,
      }).eq('id', signaalId);
      return { status: 'geen_match' };
    }

    const matchKw = bepaalMatchKwaliteit(s, docs);
    const pc = normPostcode(s.postcode);
    const huisnr = extractHuisnummer(s.adres);
    let exacte: any[] = docs;
    if (pc && huisnr) {
      const ex = docs.filter((d) =>
        String(d.postcode ?? '').replace(/\s+/g, '').toUpperCase() === pc
        && String(d.huisnummer ?? '') === huisnr);
      if (ex.length > 0) exacte = ex;
    }

    // Eén exacte hit → behandel als directe verrijking via Mode B-pad.
    if (exacte.length === 1 && matchKw === 'exact') {
      const d = exacte[0];
      const lookupId = d.id; // PDOK lookup vereist het "adr-..." doc-id
      if (lookupId) {
        const det = await pdokLookup(String(lookupId));
        if (det) {
          const gekozen = detailToVbo(det, d.weergavenaam ?? '');
          const ctx = gekozen.pandid
            ? await fetchPandContext(gekozen.pandid)
            : {
                vbos: [{
                  nummeraanduiding_id: gekozen.nummeraanduiding_id,
                  vbo_id: gekozen.vbo_id,
                  adres: gekozen.adres,
                  opp_m2: gekozen.opp_m2,
                  gebruiksdoel: gekozen.gebruiksdoel,
                  status: gekozen.status,
                }],
                pandIds: [],
                vboIds: gekozen.vbo_id ? [gekozen.vbo_id] : [],
                gebruiksdoelen: gekozen.gebruiksdoel,
                totaalOpp: gekozen.opp_m2 ?? 0,
                bouwjaar: gekozen.bouwjaar,
                pandStatus: gekozen.pandstatus,
                meerVbosBeschikbaar: false,
              };

          await supabase.from('off_market_signalen').update({
            bag_status: 'verrijkt',
            bag_match_kwaliteit: 'exact',
            bag_match_kandidaten: null,
            bag_geselecteerd_vbo_id: gekozen.vbo_id || null,
            bag_geselecteerd_nummeraanduiding_id: gekozen.nummeraanduiding_id || null,
            bag_geselecteerd_adres: gekozen.adres || null,
            bag_geselecteerd_opp_m2: gekozen.opp_m2,
            bag_geselecteerd_gebruiksdoel: gekozen.gebruiksdoel,
            bag_vbos: ctx.vbos,
            bag_totaal_oppervlakte_m2: Math.round(ctx.totaalOpp) || null,
            bag_aantal_vbo: ctx.vboIds.length || ctx.vbos.length || null,
            bag_aantal_panden: ctx.pandIds.length || null,
            bag_gebruiksdoelen: ctx.gebruiksdoelen,
            bag_bouwjaar: ctx.bouwjaar,
            bag_pand_status: ctx.pandStatus,
            bag_pand_ids: ctx.pandIds,
            bag_vbo_ids: ctx.vboIds,
            bag_pandcontext_aantal_vbo: ctx.vbos.length,
            bag_pandcontext_totaal_opp_m2: Math.round(ctx.totaalOpp) || null,
            bag_verrijkt_op: new Date().toISOString(),
            bag_foutmelding: null,
          }).eq('id', signaalId);

          return { status: 'verrijkt', aantal_vbo: ctx.vbos.length };
        }
      }
    }

    // Meerdere/onzekere matches → bouw eerst ALTIJD basis-kandidaten uit search docs.
    // Lookup-verrijking is best-effort en mag falen zonder de kandidaat te verwijderen.
    const docsKandidaat = docs.slice(0, MAX_KANDIDATEN);
    const basisReden = docs.length > 1 ? 'Meerdere PDOK-treffers' : 'Onzekere PDOK-treffer';
    const basisKandidaten: BagMatchKandidaat[] = docsKandidaat.map((d) => ({
      adres: String(d.weergavenaam ?? ''),
      vbo_id: d.adresseerbaarobject_id ? String(d.adresseerbaarobject_id) : null,
      nummeraanduiding_id: d.nummeraanduiding_id ? String(d.nummeraanduiding_id) : null,
      pdok_id: d.id ? String(d.id) : null,
      opp_m2: null,
      gebruiksdoel: null,
      status: null,
      pandid: null,
      match_kwaliteit: matchKw,
      match_reden: basisReden,
    }));

    const enriched = await runParallel(docsKandidaat, PARALLEL, async (d) => {
      const id = d.id; // adr-... voor lookup
      if (!id) return null;
      const det = await pdokLookup(String(id));
      if (!det) return null;
      return detailToVbo(det, d.weergavenaam ?? '');
    });

    const kandidaten: BagMatchKandidaat[] = basisKandidaten.map((basis, i) => {
      const r = enriched[i];
      if (r && r.status === 'fulfilled' && r.value) {
        const v = r.value;
        return {
          ...basis,
          adres: basis.adres || v.adres,
          vbo_id: basis.vbo_id || v.vbo_id || null,
          nummeraanduiding_id: basis.nummeraanduiding_id || v.nummeraanduiding_id || null,
          opp_m2: v.opp_m2,
          gebruiksdoel: v.gebruiksdoel?.length ? v.gebruiksdoel : null,
          status: v.status,
          pandid: v.pandid,
        };
      }
      return basis;
    });

    console.log('[bag-verrijk] kandidaten geschreven:', kandidaten.length);
    await supabase.from('off_market_signalen').update({
      bag_status: 'meerdere_matches',
      bag_match_kwaliteit: matchKw,
      bag_match_kandidaten: kandidaten,
      bag_verrijkt_op: new Date().toISOString(),
      bag_foutmelding: null,
    }).eq('id', signaalId);

    return {
      status: 'meerdere_matches',
      kandidaten: kandidaten.length,
      used_query: usedQuery,
    };
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
  const selectedVboId = typeof body?.selected_vbo_id === 'string' ? body.selected_vbo_id : undefined;
  const selectedNaId = typeof body?.selected_nummeraanduiding_id === 'string'
    ? body.selected_nummeraanduiding_id : undefined;

  try {
    const res = await verrijk(supabase, signaalId, {
      force: body?.force === true,
      selectedVboId, selectedNaId,
    });
    return jsonResponse({ ok: true, id: signaalId, ...res });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
