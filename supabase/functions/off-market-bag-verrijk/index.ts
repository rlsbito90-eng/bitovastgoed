// Off-Market Radar V2.3 + V2.4 — BAG-verrijking als pre-check vóór betaald Kadaster.
// Gebruikt PDOK Locatieserver (gratis, geen key):
//   /search/v3_1/free   → vind nummeraanduidingen op adres of pandid
//   /search/v3_1/lookup → haal volledige BAG-velden per nummeraanduiding/VBO
// Fallback BAG Individuele Bevragingen v2 wordt geprobeerd indien Locatieserver
// geen VBO's vindt voor een pandid.
//
// Modes:
//   A) zonder selectie  → eerste match of matchkandidaten + meerdere_matches
//      (V2.4: filter strikt op postcode+basis-huisnummer; auto-doelobject bij toevoeging-match)
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

/** V2.4 — parse basis-huisnummer + huisletter + toevoeging defensief.
 *  Voorbeelden: "330", "330-1", "330 1", "330H", "330-H", "330A", "330 II". */
export interface ParsedHuisnummer {
  huisnummer: string | null;
  huisletter: string | null;
  toevoeging: string | null;
}
function parseHuisnummer(raw: string | null | undefined): ParsedHuisnummer {
  if (!raw) return { huisnummer: null, huisletter: null, toevoeging: null };
  const s = String(raw);
  // 1) "<nr>-<rest>" of "<nr> <rest>" met spatie/streepje
  let m = s.match(/\b(\d{1,5})[\s\-]+([A-Za-z0-9]{1,6})\b/);
  if (m) {
    const nr = m[1];
    const tv = m[2];
    if (/^[A-Za-z]$/.test(tv)) {
      return { huisnummer: nr, huisletter: tv.toUpperCase(), toevoeging: null };
    }
    return { huisnummer: nr, huisletter: null, toevoeging: tv.toUpperCase() };
  }
  // 2) "<nr><letter>"  bv 330A, 332B
  m = s.match(/\b(\d{1,5})([A-Za-z])\b/);
  if (m) {
    return { huisnummer: m[1], huisletter: m[2].toUpperCase(), toevoeging: null };
  }
  // 3) alleen nummer
  m = s.match(/\b(\d{1,5})\b/);
  if (m) return { huisnummer: m[1], huisletter: null, toevoeging: null };
  return { huisnummer: null, huisletter: null, toevoeging: null };
}

/** Combineer informatie uit adres + titel om de meest complete parse te krijgen. */
function parseSignaalHuisnummer(s: SignaalShallow): ParsedHuisnummer {
  const a = parseHuisnummer(s.adres);
  if (a.huisnummer && (a.huisletter || a.toevoeging)) return a;
  const t = parseHuisnummer(s.titel);
  // Prefer adres-huisnummer als basis, anders titel.
  const huisnummer = a.huisnummer ?? t.huisnummer ?? null;
  // Pak toevoeging/huisletter uit eerste die past bij huisnummer.
  let huisletter: string | null = null;
  let toevoeging: string | null = null;
  if (a.huisnummer && huisnummer && a.huisnummer === huisnummer) {
    huisletter = a.huisletter;
    toevoeging = a.toevoeging;
  }
  if (!huisletter && !toevoeging && t.huisnummer === huisnummer) {
    huisletter = t.huisletter;
    toevoeging = t.toevoeging;
  }
  return { huisnummer, huisletter, toevoeging };
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
  const parsed = parseSignaalHuisnummer(s);
  const huisnr = parsed.huisnummer;
  const out: string[] = [];
  if (pc && huisnr) {
    const pcFmt = `${pc.slice(0, 4)} ${pc.slice(4)}`;
    if (s.plaats) out.push(`${pcFmt} ${huisnr} ${s.plaats}`);
    out.push(`${pcFmt} ${huisnr}`);
  }
  const volledig = buildFreeQuery(s);
  if (volledig) out.push(volledig);
  if (s.adres && s.plaats) out.push(`${s.adres} ${s.plaats}`);
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
  url.searchParams.set('rows', '20');
  const j = await pdokFetch(url.toString());
  return (j?.response?.docs ?? []) as any[];
}

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

function docPc(d: any): string {
  return String(d?.postcode ?? '').replace(/\s+/g, '').toUpperCase();
}

interface BagVbo {
  nummeraanduiding_id: string;
  vbo_id: string;
  adres: string;
  opp_m2: number | null;
  gebruiksdoel: string[];
  status: string | null;
  is_doelobject?: boolean;
  match_badge?: string | null;
}

type BagMatchType =
  | 'exact_doelobject'
  | 'zelfde_huisnummer'
  | 'zelfde_bag_pand'
  | 'nabijgelegen_adres'
  | 'onzeker';

interface BagMatchKandidaat {
  adres: string;
  vbo_id?: string | null;
  nummeraanduiding_id?: string | null;
  pdok_id?: string | null;
  opp_m2?: number | null;
  gebruiksdoel?: string[] | null;
  status?: string | null;
  pandid?: string | null;
  postcode?: string | null;
  postcode_normalized?: string | null;
  huisnummer?: string | number | null;
  huisletter?: string | null;
  huisnummertoevoeging?: string | null;
  openbareruimte?: string | null;
  woonplaats?: string | null;
  match_type?: BagMatchType | null;
  is_doelobject_match?: boolean | null;
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
  huisnummer: string | null;
  huisletter: string | null;
  huisnummertoevoeging: string | null;
  postcode: string | null;
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
  const hn = det.huisnummer != null ? String(det.huisnummer) : null;
  const hl = det.huisletter ? String(det.huisletter).toUpperCase() : null;
  const ht = det.huisnummertoevoeging ? String(det.huisnummertoevoeging).toUpperCase() : null;
  const pc = det.postcode ? String(det.postcode).replace(/\s+/g, '').toUpperCase() : null;
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
    huisnummer: hn,
    huisletter: hl,
    huisnummertoevoeging: ht,
    postcode: pc,
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
  incompleet: boolean;
}

async function fetchPandContext(pandid: string): Promise<PandContext> {
  let lookupIds: string[] = [];
  let primair: any[] = [];
  try {
    primair = await pdokFreeByPandid(pandid);
    lookupIds = primair.map((d) => d.id).filter((v) => typeof v === 'string') as string[];
  } catch { /* fall through */ }

  let fallbackUsed = false;
  if (lookupIds.length <= 1) {
    const vboIds = await bagIbVbosByPand(pandid);
    if (vboIds.length > lookupIds.length) {
      lookupIds = vboIds;
      fallbackUsed = true;
    }
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

  // Incompleet: na PDOK + fallback BAG-IB nog steeds 1 VBO terwijl fallback heeft gedraaid.
  const incompleet = vbos.length === 1 && fallbackUsed === false
    ? false // alleen 1 PDOK-hit gevonden, fallback niet getest (zou hier wel uitgevoerd zijn)
    : vbos.length <= 1 && fallbackUsed;

  return {
    vbos,
    pandIds: Array.from(pandIds),
    vboIds: Array.from(vboIds),
    gebruiksdoelen: Array.from(gebruiksdoelen),
    totaalOpp,
    bouwjaar,
    pandStatus,
    meerVbosBeschikbaar,
    incompleet,
  };
}

/** V2.4 — markeer doelobject + match_badge per VBO. */
function markeerDoelobject(
  vbos: BagVbo[],
  gekozenVboId: string | null,
  gekozenNaId: string | null,
): BagVbo[] {
  return vbos.map((v) => {
    const isDoel =
      (!!gekozenVboId && v.vbo_id === gekozenVboId) ||
      (!!gekozenNaId && v.nummeraanduiding_id === gekozenNaId);
    return {
      ...v,
      is_doelobject: isDoel,
      match_badge: isDoel ? 'MATCH · Doelobject' : 'Zelfde BAG-pand',
    };
  });
}

interface VerrijkResult {
  status: string;
  aantal_vbo?: number;
  kandidaten?: number;
  error?: string;
  skipped?: boolean;
  auto_doelobject?: boolean;
}

async function verrijk(
  supabase: any,
  signaalId: string,
  opts: {
    force?: boolean;
    selectedVboId?: string;
    selectedNaId?: string;
    selectedPdokId?: string;
  },
): Promise<VerrijkResult> {
  const { data: s, error } = await supabase
    .from('off_market_signalen')
    .select('id, adres, postcode, plaats, titel, bag_status, bag_match_kandidaten')
    .eq('id', signaalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error('Signaal niet gevonden');

  const hasSelection = !!(opts.selectedVboId || opts.selectedNaId || opts.selectedPdokId);

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
      let lookupId: string | null = opts.selectedPdokId ?? null;
      if (!lookupId) {
        const kandidaten = Array.isArray(s.bag_match_kandidaten)
          ? (s.bag_match_kandidaten as BagMatchKandidaat[]) : [];
        const match = kandidaten.find((k) =>
          (opts.selectedVboId && k.vbo_id === opts.selectedVboId) ||
          (opts.selectedNaId && k.nummeraanduiding_id === opts.selectedNaId),
        );
        lookupId = match?.pdok_id ?? null;
      }
      if (!lookupId) {
        lookupId = opts.selectedVboId ?? opts.selectedNaId ?? null;
      }
      const det = lookupId ? await pdokLookup(String(lookupId)) : null;
      if (!det) {
        await supabase.from('off_market_signalen').update({
          bag_status: 'fout',
          bag_foutmelding: 'Gekozen BAG-match niet gevonden in PDOK',
          bag_verrijkt_op: new Date().toISOString(),
        }).eq('id', signaalId);
        return { status: 'fout', error: 'Gekozen BAG-match niet gevonden' };
      }
      const gekozen = detailToVbo(det);

      const ctx: PandContext = gekozen.pandid
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
            incompleet: false,
          };

      const vbosMarked = markeerDoelobject(ctx.vbos, gekozen.vbo_id || null, gekozen.nummeraanduiding_id || null);

      await supabase.from('off_market_signalen').update({
        bag_geselecteerd_vbo_id: gekozen.vbo_id || null,
        bag_geselecteerd_nummeraanduiding_id: gekozen.nummeraanduiding_id || null,
        bag_geselecteerd_adres: gekozen.adres || null,
        bag_geselecteerd_opp_m2: gekozen.opp_m2,
        bag_geselecteerd_gebruiksdoel: gekozen.gebruiksdoel,
        bag_status: 'verrijkt',
        bag_match_kwaliteit: 'exact',
        bag_match_kandidaten: null,
        bag_vbos: vbosMarked,
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
        bag_pandcontext_incompleet: ctx.incompleet,
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

    // V2.4 — parse signaal-toevoeging
    const pc = normPostcode(s.postcode);
    const parsed = parseSignaalHuisnummer(s);
    const huisnr = parsed.huisnummer;
    const sigToevoeging = (parsed.toevoeging || '').toUpperCase() || null;
    const sigLetter = (parsed.huisletter || '').toUpperCase() || null;

    // Split docs in primair (zelfde pc+huisnr) en nearby (rest)
    let primair: any[] = docs;
    let nearby: any[] = [];
    if (pc && huisnr) {
      const same = docs.filter((d) => docPc(d) === pc && String(d.huisnummer ?? '') === huisnr);
      const other = docs.filter((d) => !(docPc(d) === pc && String(d.huisnummer ?? '') === huisnr));
      if (same.length > 0) {
        primair = same;
        nearby = other;
      }
    }

    // Bouw basis-kandidaten (eerst primair, dan nearby) tot MAX_KANDIDATEN
    const ranked = [...primair, ...nearby].slice(0, MAX_KANDIDATEN);
    const basisReden = primair.length > 1 ? 'Meerdere PDOK-treffers op huisnummer' : 'Onzekere PDOK-treffer';

    // Bepaal doelobject-match in primair op basis van toevoeging
    let doelobjectIdx: number | null = null;
    if (sigToevoeging || sigLetter) {
      for (let i = 0; i < primair.length; i++) {
        const d = primair[i];
        const dToe = String(d.huisnummertoevoeging ?? '').toUpperCase();
        const dLet = String(d.huisletter ?? '').toUpperCase();
        if (sigToevoeging && dToe === sigToevoeging) { doelobjectIdx = i; break; }
        if (sigLetter && dLet === sigLetter) { doelobjectIdx = i; break; }
      }
    }

    const basisKandidaten: BagMatchKandidaat[] = ranked.map((d, i) => {
      const dPc = docPc(d);
      const isPrimair = pc && huisnr ? (dPc === pc && String(d.huisnummer ?? '') === huisnr) : true;
      const dToe = d.huisnummertoevoeging ? String(d.huisnummertoevoeging).toUpperCase() : null;
      const dLet = d.huisletter ? String(d.huisletter).toUpperCase() : null;
      const isDoel = doelobjectIdx != null && i === doelobjectIdx;
      let match_type: BagMatchType;
      if (isDoel) match_type = 'exact_doelobject';
      else if (isPrimair) match_type = 'zelfde_huisnummer';
      else match_type = 'nabijgelegen_adres';
      return {
        adres: String(d.weergavenaam ?? ''),
        vbo_id: d.adresseerbaarobject_id ? String(d.adresseerbaarobject_id) : null,
        nummeraanduiding_id: d.nummeraanduiding_id ? String(d.nummeraanduiding_id) : null,
        pdok_id: d.id ? String(d.id) : null,
        opp_m2: null,
        gebruiksdoel: null,
        status: null,
        pandid: null,
        postcode: d.postcode ? String(d.postcode) : null,
        postcode_normalized: dPc || null,
        huisnummer: d.huisnummer != null ? String(d.huisnummer) : null,
        huisletter: dLet,
        huisnummertoevoeging: dToe,
        openbareruimte: d.straatnaam ? String(d.straatnaam) : null,
        woonplaats: d.woonplaatsnaam ? String(d.woonplaatsnaam) : null,
        match_type,
        is_doelobject_match: isDoel,
        match_kwaliteit: isDoel ? 'exact' : (isPrimair ? 'waarschijnlijk' : 'onzeker'),
        match_reden: isDoel
          ? `Toevoeging "${sigToevoeging ?? sigLetter}" matcht exact`
          : (isPrimair ? basisReden : 'Nabijgelegen huisnummer'),
      };
    });

    // Lookup-verrijking best-effort
    const enriched = await runParallel(ranked, PARALLEL, async (d) => {
      const id = d.id;
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
          huisletter: basis.huisletter ?? v.huisletter,
          huisnummertoevoeging: basis.huisnummertoevoeging ?? v.huisnummertoevoeging,
        };
      }
      return basis;
    });

    // V2.4 — auto-doelobject: één exact match via toevoeging → meteen Mode C draaien.
    if (doelobjectIdx != null) {
      const doel = kandidaten[doelobjectIdx];
      const lookupId = doel.pdok_id;
      const det = lookupId ? await pdokLookup(String(lookupId)) : null;
      if (det) {
        const gekozen = detailToVbo(det, doel.adres);
        const ctx: PandContext = gekozen.pandid
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
              incompleet: false,
            };
        const vbosMarked = markeerDoelobject(ctx.vbos, gekozen.vbo_id || null, gekozen.nummeraanduiding_id || null);

        await supabase.from('off_market_signalen').update({
          bag_status: 'verrijkt',
          bag_match_kwaliteit: 'exact',
          bag_match_kandidaten: null,
          bag_geselecteerd_vbo_id: gekozen.vbo_id || null,
          bag_geselecteerd_nummeraanduiding_id: gekozen.nummeraanduiding_id || null,
          bag_geselecteerd_adres: gekozen.adres || null,
          bag_geselecteerd_opp_m2: gekozen.opp_m2,
          bag_geselecteerd_gebruiksdoel: gekozen.gebruiksdoel,
          bag_vbos: vbosMarked,
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
          bag_pandcontext_incompleet: ctx.incompleet,
          bag_verrijkt_op: new Date().toISOString(),
          bag_foutmelding: null,
        }).eq('id', signaalId);

        return { status: 'verrijkt', aantal_vbo: ctx.vbos.length, auto_doelobject: true };
      }
    }

    // Exact één hit op huisnummer (geen toevoeging in signaal) → behandel als directe verrijking.
    if (primair.length === 1 && !sigToevoeging && !sigLetter) {
      const d = primair[0];
      const lookupId = d.id;
      const det = lookupId ? await pdokLookup(String(lookupId)) : null;
      if (det) {
        const gekozen = detailToVbo(det, d.weergavenaam ?? '');
        const ctx: PandContext = gekozen.pandid
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
              incompleet: false,
            };
        const vbosMarked = markeerDoelobject(ctx.vbos, gekozen.vbo_id || null, gekozen.nummeraanduiding_id || null);
        await supabase.from('off_market_signalen').update({
          bag_status: 'verrijkt',
          bag_match_kwaliteit: 'exact',
          bag_match_kandidaten: null,
          bag_geselecteerd_vbo_id: gekozen.vbo_id || null,
          bag_geselecteerd_nummeraanduiding_id: gekozen.nummeraanduiding_id || null,
          bag_geselecteerd_adres: gekozen.adres || null,
          bag_geselecteerd_opp_m2: gekozen.opp_m2,
          bag_geselecteerd_gebruiksdoel: gekozen.gebruiksdoel,
          bag_vbos: vbosMarked,
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
          bag_pandcontext_incompleet: ctx.incompleet,
          bag_verrijkt_op: new Date().toISOString(),
          bag_foutmelding: null,
        }).eq('id', signaalId);
        return { status: 'verrijkt', aantal_vbo: ctx.vbos.length };
      }
    }

    const matchKw = primair.length > 0 ? 'waarschijnlijk' : 'onzeker';
    console.log('[bag-verrijk] kandidaten geschreven:', kandidaten.length,
      'primair:', primair.length, 'nearby:', nearby.length);
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
  const selectedPdokId = typeof body?.selected_pdok_id === 'string'
    ? body.selected_pdok_id : undefined;

  try {
    const res = await verrijk(supabase, signaalId, {
      force: body?.force === true,
      selectedVboId, selectedNaId, selectedPdokId,
    });
    return jsonResponse({ ok: true, id: signaalId, ...res });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
