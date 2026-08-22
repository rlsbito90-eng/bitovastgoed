// Off-Market Radar BAG runtime V2.6 — compacte canonieke productieruntime.
//
// Doel:
// - strikte BAG-doelobjectselectie;
// - volledige VBO/pandcontext via gratis PDOK Locatieserver + BAG WFS;
// - veilige cron-auth met Edge-env OF service-role-only runtime-secret fallback;
// - handmatige interne gebruiker via JWT;
// - uitsluitend BAG-velden + Kadasteradvies schrijven;
// - GEEN betaalde Kadaster-call, GEEN AI-call.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { berekenKadasteradvies, type SignaalKadasterInput } from '../_shared/kadasteradvies.ts';

const FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const LOOKUP = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup';
const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const MAX_CONTEXT = 50;
const MAX_CANDIDATES = 10;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
function normPc(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+/g, '').toUpperCase() : '';
  return /^\d{4}[A-Z]{2}$/.test(s) ? s : null;
}
function cleanSignalAddress(v: unknown): string {
  let s = typeof v === 'string' ? v.trim() : '';
  if (s.includes(' - ')) s = s.split(' - ').pop()!.trim();
  s = s.replace(/^(?:Aanvraag|Besluit)(?:\s+voor)?(?:\s+op\s+aanvraag)?\s+(?:splitsingsvergunning|woonvormingsvergunning|omzettingsvergunning|onttrekkingsvergunning|omgevingsvergunning|vergunning)(?:\s+(?:verleend|geweigerd|ingetrokken|buiten\s+behandeling\s+gesteld))?\s*/i, '');
  s = s.replace(/^(?:Verleend|Geweigerd)\s*[-–—:]?\s*/i, '');
  return s.trim();
}
const STOP = new Set(['IN','TE','AAN','BIJ','VOOR','VAN','OP','NABIJ','NA','MET','UIT','OM','DE','HET','EEN','AMSTERDAM','ROTTERDAM','UTRECHT','HAAG','DEN']);
function realSuffix(v: string | null): string | null {
  const t = (v ?? '').trim().toUpperCase();
  if (!t || STOP.has(t) || /^\d{4}[A-Z]{0,2}$/.test(t)) return null;
  return /^([A-Z]|\d{1,4}|\d{1,3}[A-Z]|[A-Z]\d{1,3}|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(t) ? t : null;
}
interface Parsed { nr: string | null; letter: string | null; addition: string | null }
function parseHouse(raw: unknown): Parsed {
  if (!raw) return { nr: null, letter: null, addition: null };
  const s = String(raw).replace(/\b\d{4}\s?[A-Za-z]{2}\b/g, ' ');
  let m = s.match(/\b(\d{1,5})-([A-Za-z0-9]{1,6})\b/);
  if (m && realSuffix(m[2])) {
    const x = realSuffix(m[2])!;
    return /^[A-Z]$/.test(x) ? { nr: m[1], letter: x, addition: null } : { nr: m[1], letter: null, addition: x };
  }
  m = s.match(/\b(\d{1,5})\s+([A-Za-z0-9]{1,6})\b/);
  if (m && realSuffix(m[2])) {
    const x = realSuffix(m[2])!;
    return /^[A-Z]$/.test(x) ? { nr: m[1], letter: x, addition: null } : { nr: m[1], letter: null, addition: x };
  }
  m = s.match(/\b(\d{1,5})([A-Za-z])\b/);
  if (m) return { nr: m[1], letter: m[2].toUpperCase(), addition: null };
  m = s.match(/\b(\d{1,5})\b/);
  return { nr: m?.[1] ?? null, letter: null, addition: null };
}
function parsedSignal(s: any): Parsed {
  const a = parseHouse(s.adres);
  if (a.nr && (a.letter || a.addition)) return a;
  const t = parseHouse(s.titel);
  if (a.nr) return { nr: a.nr, letter: t.nr === a.nr ? t.letter : null, addition: t.nr === a.nr ? t.addition : null };
  return t;
}
function suffixMatches(p: Parsed, d: any): boolean {
  const wanted = realSuffix(p.letter) ?? realSuffix(p.addition);
  if (!wanted) return false;
  const got = [d.huisletter, d.huisnummertoevoeging].map((x) => realSuffix(x ? String(x) : null)).filter(Boolean);
  return got.includes(wanted);
}

async function cronAuthorized(admin: any, provided: string | null): Promise<boolean> {
  if (!provided) return false;
  const env = Deno.env.get('OFF_MARKET_CRON_SECRET')?.trim();
  if (env && env === provided) return true;
  const { data } = await admin.from('off_market_runtime_secrets').select('value').eq('key', 'cron_secret').maybeSingle();
  return typeof data?.value === 'string' && data.value === provided;
}
async function authorized(req: Request, admin: any): Promise<boolean> {
  if (await cronAuthorized(admin, req.headers.get('x-cron-secret'))) return true;
  const h = req.headers.get('Authorization') ?? '';
  if (!h.toLowerCase().startsWith('bearer ')) return false;
  const token = h.replace(/^Bearer\s+/i, '');
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: h } } });
  const { data: claims, error } = await user.auth.getClaims(token);
  if (error || !claims?.claims?.sub) return false;
  const { data: intern } = await admin.rpc('is_intern_gebruiker', { _user_id: claims.claims.sub as string });
  return intern === true;
}

async function getJson(url: string): Promise<any> {
  let last = 0;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      last = r.status;
      if (r.status === 429 || r.status >= 500) { await new Promise((x) => setTimeout(x, 200 * (i + 1))); continue; }
      if (!r.ok) throw new Error(`PDOK HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((x) => setTimeout(x, 200 * (i + 1)));
    }
  }
  throw new Error(`PDOK onbereikbaar (${last})`);
}
async function free(q: string): Promise<any[]> {
  const u = new URL(FREE);
  u.searchParams.set('q', q); u.searchParams.set('fq', 'type:adres'); u.searchParams.set('rows', '20');
  u.searchParams.set('fl', 'id,weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,nummeraanduiding_id,adresseerbaarobject_id,adresseerbaar_object_id');
  return (await getJson(u.toString()))?.response?.docs ?? [];
}
async function lookup(id: string): Promise<any | null> {
  const u = new URL(LOOKUP); u.searchParams.set('id', id); u.searchParams.set('fl', '*');
  return ((await getJson(u.toString()))?.response?.docs ?? [])[0] ?? null;
}
function searchQueries(s: any): string[] {
  const pc = normPc(s.postcode); const p = parsedSignal(s); const out: string[] = [];
  if (pc && p.nr) { const f = `${pc.slice(0,4)} ${pc.slice(4)}`; if (s.plaats) out.push(`${f} ${p.nr} ${s.plaats}`); out.push(`${f} ${p.nr}`); }
  const a = cleanSignalAddress(s.adres || s.titel); if (a && s.plaats) out.push(`${a} ${s.plaats}`); if (a) out.push(a);
  return [...new Set(out)];
}
async function firstSearch(s: any): Promise<any[]> {
  for (const q of searchQueries(s)) { const docs = await free(q).catch(() => []); if (docs.length) return docs; }
  return [];
}

interface WfsVbo {
  vbo_id: string | null; pandid: string | null; adres: string; opp: number | null; uses: string[]; status: string | null;
  year: number | null; pand_status: string | null; postcode: string | null; nr: string | null; letter: string | null; addition: string | null;
}
function pick(o: any, keys: string[]) { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return null; }
function mapWfs(p: any): WfsVbo {
  const n = pick(p, ['oppervlakte','oppervlakte_m2','oppervlakteverblijfsobject','gebruiksoppervlakte']);
  const usesRaw = pick(p, ['gebruiksdoel','gebruiksdoelen','gebruiksdoelVerblijfsobject']);
  const uses = Array.isArray(usesRaw) ? usesRaw.map(String) : usesRaw ? String(usesRaw).split(/[,;]/).map((x) => x.trim()).filter(Boolean) : [];
  const yearRaw = pick(p, ['bouwjaar','oorspronkelijk_bouwjaar','oorspronkelijkBouwjaar']);
  const pc = normPc(pick(p, ['postcode'])); const nr = pick(p, ['huisnummer']); const letter = pick(p, ['huisletter']); const add = pick(p, ['toevoeging','huisnummertoevoeging']);
  const street = pick(p, ['openbare_ruimte','openbareruimte','straatnaam']); const place = pick(p, ['woonplaats','woonplaatsnaam']);
  const adres = [street, nr != null ? `${nr}${letter ?? ''}${add ? '-' + add : ''}` : null, pc, place].filter(Boolean).join(' ');
  return {
    vbo_id: pick(p, ['identificatie','verblijfsobject_id','adresseerbaarobject_id','adresseerbaar_object_id'])?.toString() ?? null,
    pandid: pick(p, ['pandidentificatie','pandid','pand_id','pand_identificatie'])?.toString() ?? null,
    adres, opp: n != null && Number.isFinite(Number(n)) ? Math.round(Number(n)) : null, uses,
    status: pick(p, ['status','statusVerblijfsobject','verblijfsobjectstatus'])?.toString() ?? null,
    year: yearRaw != null && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : null,
    pand_status: pick(p, ['pandstatus','pand_status','statusPand'])?.toString() ?? null,
    postcode: pc, nr: nr != null ? String(nr) : null, letter: letter ? String(letter).toUpperCase() : null, addition: add ? String(add).toUpperCase() : null,
  };
}
async function wfs(filter: string): Promise<WfsVbo[]> {
  const u = new URL(WFS); u.searchParams.set('service','WFS'); u.searchParams.set('version','2.0.0'); u.searchParams.set('request','GetFeature');
  u.searchParams.set('typeNames','bag:verblijfsobject'); u.searchParams.set('outputFormat','application/json'); u.searchParams.set('count', String(MAX_CONTEXT)); u.searchParams.set('filter', filter);
  const r = await fetch(u.toString(), { headers: { Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json(); return Array.isArray(j?.features) ? j.features.map((f: any) => mapWfs(f.properties ?? {})) : [];
}
async function wfsByVbo(id: string) {
  return (await wfs(`<Filter xmlns="http://www.opengis.net/ogc"><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${id}</Literal></PropertyIsEqualTo></Filter>`))[0] ?? null;
}
async function wfsByPand(id: string) {
  return await wfs(`<Filter xmlns="http://www.opengis.net/ogc"><PropertyIsEqualTo><PropertyName>pandidentificatie</PropertyName><Literal>${id}</Literal></PropertyIsEqualTo></Filter>`);
}
async function wfsByPcNr(pc: string, nr: string) {
  return await wfs(`<Filter xmlns="http://www.opengis.net/ogc"><And><PropertyIsEqualTo><PropertyName>postcode</PropertyName><Literal>${pc}</Literal></PropertyIsEqualTo><PropertyIsEqualTo><PropertyName>huisnummer</PropertyName><Literal>${nr}</Literal></PropertyIsEqualTo></And></Filter>`);
}

function docPc(d: any) { return normPc(d?.postcode); }
function docVbo(d: any) { return String(d?.adresseerbaarobject_id ?? d?.adresseerbaar_object_id ?? '').trim() || null; }
function exactDoc(s: any, d: any): boolean {
  const p = parsedSignal(s); const spc = normPc(s.postcode); const dpc = docPc(d);
  if (!p.nr || String(d?.huisnummer ?? '') !== p.nr) return false;
  if (spc && dpc && spc !== dpc) return false;
  const wanted = realSuffix(p.letter) ?? realSuffix(p.addition);
  return wanted ? suffixMatches(p, d) : true;
}

async function persistSelected(admin: any, s: any, d: any) {
  const vboId = docVbo(d) ?? String(d?.adresseerbaarobject_id ?? '');
  if (!/^\d{16}$/.test(vboId)) throw new Error('Gekozen BAG-match mist geldig VBO-ID');
  const target = await wfsByVbo(vboId);
  const pc = target?.postcode ?? docPc(d) ?? normPc(s.postcode);
  const nr = target?.nr ?? (d?.huisnummer != null ? String(d.huisnummer) : parsedSignal(s).nr);
  const pandid = target?.pandid ?? null;
  let context = pandid ? await wfsByPand(pandid) : [];
  if (!context.length && pc && nr) context = await wfsByPcNr(pc, nr);
  if (!context.some((x) => x.vbo_id === vboId)) {
    context.unshift(target ?? { vbo_id:vboId,pandid,adres:String(d?.weergavenaam ?? s.adres ?? ''),opp:null,uses:[],status:null,year:null,pand_status:null,postcode:pc,nr,letter:d?.huisletter??null,addition:d?.huisnummertoevoeging??null });
  }
  const byId = new Map<string,WfsVbo>();
  for (const x of context) if (x.vbo_id && !byId.has(x.vbo_id)) byId.set(x.vbo_id, x);
  const rows = [...byId.values()];
  const pandIds = [...new Set(rows.map((x) => x.pandid).filter(Boolean))] as string[];
  const vboIds = rows.map((x) => x.vbo_id!).filter(Boolean);
  const uses = [...new Set(rows.flatMap((x) => x.uses))];
  const total = rows.reduce((n,x) => n + (x.opp ?? 0), 0) || null;
  const years = rows.map((x) => x.year).filter((x):x is number => typeof x === 'number');
  const year = years.length ? Math.min(...years) : null;
  const selected = rows.find((x) => x.vbo_id === vboId) ?? target;
  const naId = d?.nummeraanduiding_id ? String(d.nummeraanduiding_id) : null;
  const bagVbos = rows.map((x) => ({
    nummeraanduiding_id: x.vbo_id === vboId ? naId ?? '' : '', vbo_id:x.vbo_id ?? '', adres:x.adres, opp_m2:x.opp,
    gebruiksdoel:x.uses, status:x.status, pandid:x.pandid, pand_bouwjaar:x.year, pand_status:x.pand_status,
    is_doelobject:x.vbo_id===vboId, match_badge:x.vbo_id===vboId?'MATCH · Doelobject':(pandid&&x.pandid===pandid?'Zelfde BAG-pand':'Zelfde huisnummercontext'),
  }));
  const patch = {
    bag_geselecteerd_vbo_id:vboId, bag_geselecteerd_nummeraanduiding_id:naId,
    bag_geselecteerd_adres:String(d?.weergavenaam ?? selected?.adres ?? s.adres ?? ''), bag_geselecteerd_opp_m2:selected?.opp ?? null,
    bag_geselecteerd_gebruiksdoel:selected?.uses ?? [], bag_status:'verrijkt', bag_match_kwaliteit:'exact', bag_match_kandidaten:null,
    bag_vbos:bagVbos, bag_totaal_oppervlakte_m2:total, bag_aantal_vbo:rows.length || null, bag_aantal_panden:pandIds.length || null,
    bag_gebruiksdoelen:uses, bag_bouwjaar:year, bag_pand_status:selected?.pand_status ?? rows.find((x)=>x.pand_status)?.pand_status ?? null,
    bag_pand_ids:pandIds, bag_vbo_ids:vboIds, bag_pandcontext_aantal_vbo:rows.length, bag_pandcontext_totaal_opp_m2:total,
    bag_pandcontext_incompleet:rows.length <= 1 && !pandid, bag_pandcontext_bron:pandid?'pandid':(pc&&nr?'huisnummer':'leeg'),
    bag_verrijkt_op:new Date().toISOString(), bag_foutmelding:null,
  };
  const { error } = await admin.from('off_market_signalen').update(patch).eq('id', s.id); if (error) throw error;
  return { status:'verrijkt', aantal_vbo:rows.length, selected_vbo_id:vboId };
}

async function run(admin: any, id: string, body: any) {
  const { data:s, error } = await admin.from('off_market_signalen').select('id,titel,adres,postcode,plaats,bag_status,bag_match_kandidaten').eq('id',id).maybeSingle();
  if (error || !s) throw new Error('Signaal niet gevonden');
  const chosenId = body.selected_pdok_id ?? body.selected_vbo_id ?? body.selected_nummeraanduiding_id ?? null;
  if (!body.force && !chosenId && s.bag_status === 'verrijkt') return { status:'verrijkt', skipped:true };
  await admin.from('off_market_signalen').update({ bag_status:'bezig', bag_foutmelding:null }).eq('id',id);
  try {
    if (chosenId) {
      let d = await lookup(String(chosenId));
      if (!d && Array.isArray(s.bag_match_kandidaten)) {
        const k = s.bag_match_kandidaten.find((x:any) => x.vbo_id===body.selected_vbo_id || x.nummeraanduiding_id===body.selected_nummeraanduiding_id);
        if (k?.pdok_id) d = await lookup(String(k.pdok_id));
      }
      if (!d || !exactDoc(s,d)) {
        await admin.from('off_market_signalen').update({ bag_status:'meerdere_matches', bag_foutmelding:'Gekozen BAG-match voldoet niet aan huisnummer/postcode/toevoeging', bag_verrijkt_op:new Date().toISOString() }).eq('id',id);
        return { status:'meerdere_matches', error:'Gekozen BAG-match afgewezen' };
      }
      return await persistSelected(admin,s,d);
    }
    const docs = await firstSearch(s);
    if (!docs.length) {
      await admin.from('off_market_signalen').update({ bag_status:'geen_match', bag_match_kwaliteit:null, bag_match_kandidaten:null, bag_foutmelding:null, bag_verrijkt_op:new Date().toISOString() }).eq('id',id);
      return { status:'geen_match' };
    }
    const p = parsedSignal(s); const pc = normPc(s.postcode);
    const primary = docs.filter((d) => (!p.nr || String(d?.huisnummer ?? '')===p.nr) && (!pc || !docPc(d) || docPc(d)===pc));
    const wanted = realSuffix(p.letter) ?? realSuffix(p.addition);
    const exactSuffix = wanted ? primary.filter((d) => suffixMatches(p,d)) : [];
    if (wanted && exactSuffix.length === 1) return { ...(await persistSelected(admin,s,exactSuffix[0])), auto_doelobject:true };
    if (!wanted && primary.length === 1 && exactDoc(s,primary[0])) return await persistSelected(admin,s,primary[0]);
    const ranked = [...primary, ...docs.filter((d)=>!primary.includes(d))].slice(0,MAX_CANDIDATES);
    const candidates = await Promise.all(ranked.map(async(d) => {
      const detail = d.id ? await lookup(String(d.id)).catch(()=>null) : null; const vboId = docVbo(d) ?? docVbo(detail); const w = vboId ? await wfsByVbo(vboId).catch(()=>null) : null;
      const isExact = wanted ? suffixMatches(p,d) && primary.includes(d) : primary.length===1 && primary.includes(d);
      return { adres:String(d.weergavenaam??''), vbo_id:vboId, nummeraanduiding_id:d.nummeraanduiding_id?String(d.nummeraanduiding_id):null, pdok_id:d.id?String(d.id):null,
        opp_m2:w?.opp??null, gebruiksdoel:w?.uses??null, status:w?.status??null, pandid:w?.pandid??null, pand_bouwjaar:w?.year??null, pand_status:w?.pand_status??null,
        postcode:d.postcode??null, postcode_normalized:docPc(d), huisnummer:d.huisnummer??null, huisletter:d.huisletter??null, huisnummertoevoeging:d.huisnummertoevoeging??null,
        openbareruimte:d.straatnaam??null, woonplaats:d.woonplaatsnaam??null, match_type:isExact?'exact_doelobject':(primary.includes(d)?'zelfde_huisnummer':'nabijgelegen_adres'),
        is_doelobject_match:isExact, match_kwaliteit:isExact?'exact':(primary.includes(d)?'waarschijnlijk':'onzeker'), match_reden:isExact?'Exacte toevoeging-match':(primary.includes(d)?'Zelfde huisnummer':'Nabijgelegen adres') };
    }));
    await admin.from('off_market_signalen').update({ bag_status:'meerdere_matches', bag_match_kwaliteit:primary.length?'waarschijnlijk':'onzeker', bag_match_kandidaten:candidates, bag_verrijkt_op:new Date().toISOString(), bag_foutmelding:null }).eq('id',id);
    return { status:'meerdere_matches', kandidaten:candidates.length };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    await admin.from('off_market_signalen').update({ bag_status:'fout', bag_foutmelding:m.slice(0,500), bag_verrijkt_op:new Date().toISOString() }).eq('id',id);
    return { status:'fout', error:m };
  }
}

async function persistAdvice(admin:any,id:string){
  const { data:s } = await admin.from('off_market_signalen').select('*').eq('id',id).maybeSingle();
  if (!s || s.bag_status!=='verrijkt') return;
  const a = berekenKadasteradvies(s as SignaalKadasterInput);
  await admin.from('off_market_signalen').update({ kadasteradvies:a.niveau, kadasteradvies_reden:a.reden, kadasteradvies_berekend_op:new Date().toISOString() }).eq('id',id);
}

Deno.serve(async(req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if (req.method!=='POST') return json({error:'Method not allowed'},405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (!(await authorized(req,admin))) return json({error:'Niet geautoriseerd'},401);
  const body = await req.json().catch(()=>({})); const id = typeof body.signaal_id==='string'?body.signaal_id:null;
  if (!id) return json({error:'signaal_id verplicht'},400);
  try { const result=await run(admin,id,body); await persistAdvice(admin,id).catch(()=>{}); return json({ok:true,id,...result}); }
  catch(e){ return json({ok:false,error:e instanceof Error?e.message:String(e)},500); }
});
