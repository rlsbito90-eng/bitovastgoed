// off-market-normalize-ruw
// Verwerkt onverwerkte rijen uit off_market_signalen_ruw:
//   - score-filter (regelgebaseerd, geen AI)
//   - adres + assettype + signaaltype detectie
//   - dedupe op (adres+plaats+assettype+yyyymm) → upsert signaal
//   - markeert ruw-rij als verwerkt + signaal_id of skip_reden

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  AI_TRIGGER_CAP_PER_RUN,
  magAiAutoVerrijken,
  type SignaalAutoInput,
} from '../_shared/offMarketAutoTrigger.ts';

// EdgeRuntime is geïnjecteerd door Supabase Edge Runtime; type-shim voor TS.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ===== Normalize logic (gedupliceerd van src/lib/offMarket/import/normalize.ts) =====
interface BronConfig {
  positieve_keywords?: string[];
  negatieve_keywords?: string[];
  score_drempel?: number;
  gemeente?: string;
  provincie?: string;
}
const STRAAT_SUFFIXEN = [
  'straat','laan','weg','plein','kade','gracht','singel','dreef','hof','park',
  'baan','dijk','markt','wal','pad','steeg','rak','sloot','burg','polder',
  'plantsoen','brink','boulevard','allee',
].join('|');
const TUSSENVOEGSEL = '(?:van|der|den|de|het|ten|ter|aan|op|in|t)';
const NOISE_WOORDEN_LC = [
  'aanvraag','aangevraagd','aangevraagde','vergunning','omgevingsvergunning',
  'omzettingsvergunning','splitsingsvergunning','woonvormingsvergunning',
  'onttrekkingsvergunning','verleende','verleend','besluit','besluiten',
  'bekendmaking','kennisgeving','melding','voor','het','de','een','aan',
  'locatie','adres','pand','gebouw','complex','wijzigen','veranderen',
  'verbouwen','intern',
];
const NOISE_WOORD = '(?:' + NOISE_WOORDEN_LC.map(w =>
  `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`
).join('|') + ')';
const PREFIX_WOORD = `(?!${NOISE_WOORD}\\b)(?:[A-ZÀ-Ý][\\wÀ-ÿ'\\-]*|${TUSSENVOEGSEL})\\.?`;
const STRAAT_RE = new RegExp(
  `((?:${PREFIX_WOORD}\\s+){0,3}(?!${NOISE_WOORD}\\b)[A-ZÀ-Ý][\\wÀ-ÿ'\\-]*?(?:${STRAAT_SUFFIXEN}))\\.?\\s+(\\d{1,4})([A-Za-z])?(?:-([A-Za-z0-9]{1,4}))?\\b`,
);
const POSTCODE_RE = /\b([1-9]\d{3})\s?([A-Z]{2})\b/;
const PLAATS_NA_POSTCODE_RE = /\b[1-9]\d{3}\s?[A-Z]{2}\s+([A-ZÀ-Ý][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-]+){0,2})/;
const PLAATS_IN_TE_RE = /\b(?:in|te)\s+([A-ZÀ-Ý][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-]+){0,2})\b/;

function parseAdres(text: string) {
  if (!text) return { adres: null as string | null, postcode: null as string | null, plaats: null as string | null };
  const norm = text.replace(/\s+/g, ' ').trim();
  const s = norm.match(STRAAT_RE);
  const p = norm.match(POSTCODE_RE);
  let adres: string | null = null;
  if (s) {
    const straatnaam = s[1].replace(/\s+/g, ' ').trim();
    const letter = s[3] ?? '';
    const toev = s[4] ?? '';
    adres = `${straatnaam} ${s[2]}${letter}${toev ? `-${toev}` : ''}`;
  }
  let plaats: string | null = null;
  const naPc = norm.match(PLAATS_NA_POSTCODE_RE);
  if (naPc) plaats = naPc[1].trim();
  else {
    const inTe = norm.match(PLAATS_IN_TE_RE);
    if (inTe) plaats = inTe[1].trim();
  }
  // Strip vergunnings-/bekendmakingsruis uit plaatsnaam.
  if (plaats) plaats = cleanPlaatsImport(plaats) || null;
  return {
    adres,
    postcode: p ? `${p[1]} ${p[2]}` : null,
    plaats,
  };
}

// TODO: consolideren met src/lib/offMarket/adresNormalisatie.ts#cleanPlaats
// zodra Deno/Node een gedeelde module ondersteunt voor deze edge function.
const PLAATS_NOISE_IMPORT = new Set<string>([
  'aanvraag','aanvragen','aangevraagd','aangevraagde',
  'vergunning','vergunningen','vergunningaanvraag',
  'omgevingsvergunning','splitsingsvergunning','omzettingsvergunning',
  'woonvormingsvergunning','onttrekkingsvergunning','kamerverhuurvergunning',
  'sloopvergunning','bouwvergunning',
  'woonvorming','omzetting','onttrekking','ontrekkingsvergunning',
  'bekendmaking','bekendmakingen',
  'het','de','een',
  'besluit','besluiten','intrekkingsbesluit','ontwerpbesluit',
  'melding','meldingen','ontwerp','kennisgeving','kennisgevingen',
  'verleend','verleende','ingetrokken','geweigerd','geweigerde',
]);
function cleanPlaatsImport(raw: string): string {
  const tokens = raw.replace(/\s+/g, ' ').trim().split(' ');
  const keep = tokens.filter(t => {
    const low = t.toLowerCase().replace(/[.,;:]+$/g, '');
    return low.length > 0 && !PLAATS_NOISE_IMPORT.has(low);
  });
  if (keep.length === 0) return '';
  const out = keep.join(' ');
  if (out === out.toLowerCase() || out === out.toUpperCase()) {
    return out
      .toLowerCase()
      .split(/(\s|-)/)
      .map(p => (p === ' ' || p === '-' ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('');
  }
  return out;
}

// TODO: consolideren met src/lib/offMarket/import/normalize.ts#ASSETTYPE_KEYWORDS
const ASSETTYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(appartementencomplex|appartementengebouw)\b/i, 'appartementencomplex'],
  [/\b(studentenhuisvesting|studentenwoning(?:en)?|studentencomplex)\b/i, 'studentenhuisvesting'],
  [/\b(woonhuis|herenhuis|grachtenpand|eengezinswoning)\b/i, 'woonhuis'],
  [/\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|herontwikkeling)\b/i, 'transformatieobject'],
  [/\b(woon[-\s]?\/?winkelpand|woon\s+winkel)\b/i, 'woon_winkelpand'],
  [/\b(gemengd\s+vastgoed|gemengde\s+bestemming)\b/i, 'gemengd_vastgoed'],
  [/\b(splitsingsvergunning|splitsen\s+in\s+appartementsrechten|appartementensplitsing|appartementsrecht(?:en)?|woonvormingsvergunning|woonvorming|woningvorm(?:ing|en)|omzettingsvergunning|onttrekkingsvergunning|onttrekking\s+woonruimte|samenvoegen\s+woonruimte|kamergewijze\s+verhuur|kamerverhuur|woningdelen|woonfunctie|appartement(?:en)?)\b/i, 'wonen'],
  [/\b(ontwikkellocatie|bouwkavel)\b/i, 'ontwikkellocatie'],
  [/\b(light\s*industrial)\b/i, 'light_industrial'],
  [/\b(logistiek|distributiecentrum|dc\b)/i, 'logistiek'],
  [/\b(zorg|verpleeg|zorginstelling)\b/i, 'zorgvastgoed'],
  [/\b(bedrijfshal|bedrijfscomplex|bedrijfspand)\b/i, 'bedrijfscomplex'],
  [/\b(kantoor|kantoren|office)\b/i, 'kantoor'],
  [/\b(winkel|winkelpand|retail)\b/i, 'winkelpand'],
];
function detectAssettype(t: string): string {
  for (const [re, type] of ASSETTYPE_KEYWORDS) if (re.test(t)) return type;
  return 'overig';
}
function detectStrategie(text: string): string | null {
  if (!text) return null;
  if (/\b(splitsingsvergunning|splitsen\s+in\s+appartementsrechten|appartementensplitsing|appartementsrechten|woonvormingsvergunning|woonvorming|kadastrale\s+splitsing|juridische\s+splitsing)\b/i.test(text)) return 'Splitsingspotentie';
  if (/\b(uitponding|uitponden)\b/i.test(text)) return 'Uitponding';
  if (/\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen)\b/i.test(text)) return 'Transformatie';
  return null;
}
const SIGNAALTYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen)\b/i, 'transformatiepotentie'],
  [/\b(functiewijziging|wijzigen\s+gebruik|gebruikswijziging)\b/i, 'functiewijziging'],
  [/\b(leegstand)\b/i, 'leegstand'],
  [/\b(bedrijfsbe[eë]indiging|opheffing|liquidatie)\b/i, 'bedrijfsbeeindiging'],
];
function detectSignaaltype(t: string): string {
  for (const [re, type] of SIGNAALTYPE_KEYWORDS) if (re.test(t)) return type;
  return 'vergunning_bekendmaking';
}
function detectBronType(subj: string[]): 'vergunning' | 'bekendmaking' {
  return /vergunning/.test(subj.join(' ').toLowerCase()) ? 'vergunning' : 'bekendmaking';
}

type Vergunningtype =
  | 'splitsing' | 'woonvorming' | 'omzetting' | 'onttrekking'
  | 'functiewijziging' | 'transformatie' | 'ontwikkeling' | 'overig';
type AanvraagOfBesluit = 'aanvraag' | 'besluit' | 'melding' | 'onbekend';

const VERGUNNINGTYPE_PATTERNS: Array<[RegExp, Vergunningtype]> = [
  [/\bsplitsingsvergunning\b|\bsplitsing\b|appartementsrecht|uitponding|kadastrale\s+splitsing|juridische\s+splitsing/i, 'splitsing'],
  [/woonvormingsvergunning|woningvorm(?:ing|en)/i, 'woonvorming'],
  [/omzettingsvergunning|onzelfstandige\s+woonruimte|kamergewijze|kamerverhuur|woningdelen/i, 'omzetting'],
  [/onttrekkingsvergunning|onttrekking/i, 'onttrekking'],
  [/functiewijziging|wijzigen\s+gebruik|gebruikswijziging/i, 'functiewijziging'],
  [/transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|bergingen?\s+naar\s+woonruimte/i, 'transformatie'],
  [/woningbouwproject|nieuwbouw|projectontwikkeling|gebiedsontwikkeling|herontwikkeling|appartement/i, 'ontwikkeling'],
];
function detectVergunningtype(text: string): Vergunningtype {
  if (!text) return 'overig';
  for (const [re, type] of VERGUNNINGTYPE_PATTERNS) if (re.test(text)) return type;
  return 'overig';
}
function detectAanvraagOfBesluit(text: string, subjects: string[]): AanvraagOfBesluit {
  const blob = `${text} ${subjects.join(' ')}`.toLowerCase();
  if (/\b(verleende|verleend|besluit|besluiten|toegekend|toekenning|geweigerd|weigering|ingetrokken|intrekking)\b/.test(blob)) return 'besluit';
  if (/\b(aanvraag|aangevraagd|ingediende?|ingediend)\b/.test(blob)) return 'aanvraag';
  if (/\b(melding|gemeld|kennisgeving)\b/.test(blob)) return 'melding';
  return 'onbekend';
}

interface ScoreComponent { label: string; delta: number; }

// Gewogen positieve patronen (gedeeld met src/lib/offMarket/import/normalize.ts).
const WEIGHTED_POSITIVE: Array<{ re: RegExp; label: string; delta: number }> = [
  { re: /\bsplitsingsvergunning\b/i, label: 'splitsingsvergunning', delta: 40 },
  { re: /\bsplitsing/i, label: 'splitsing', delta: 30 },
  { re: /\bappartementsrecht(en)?\b/i, label: 'appartementsrecht', delta: 20 },
  { re: /\b(uitponding|uitponden|kadastrale\s+splitsing|juridische\s+splitsing)\b/i, label: 'uitponding', delta: 20 },
  { re: /\bwoonvormingsvergunning\b/i, label: 'woonvormingsvergunning', delta: 35 },
  { re: /\bwoningvorm(?:ing|en)\b/i, label: 'woningvorming', delta: 30 },
  { re: /\b(?:nieuwe\s+)?zelfstandige\s+woonruimte[n]?\b/i, label: 'zelfstandige woonruimte', delta: 20 },
  { re: /\bomzettingsvergunning\b/i, label: 'omzettingsvergunning', delta: 35 },
  { re: /\bonzelfstandige\s+woonruimte[n]?\b/i, label: 'onzelfstandige woonruimte', delta: 35 },
  { re: /\b(kamergewijze\s+verhuur|kamerverhuur|woningdelen)\b/i, label: 'kamerverhuur', delta: 25 },
  { re: /\bvan\s+\d+\b[^.\n]{0,60}\b(?:naar|in)\s+\d+\b/i, label: 'wijziging aantal kamers', delta: 20 },
  { re: /\bonttrekkingsvergunning\b/i, label: 'onttrekkingsvergunning', delta: 20 },
  // 'tweede woning' onttrekking = particuliere tweede-woning-vergunning → geen acquisitiekans.
  { re: /\btweede\s+woning\b/i, label: 'tweede woning (geen acquisitiekans)', delta: -40 },
  { re: /\bbergingen?\s+naar\s+woonruimte[n]?\b/i, label: 'bergingen naar woonruimte', delta: 30 },
  { re: /\b(garage|kelder|zolder|bedrijfsruimte)\s+naar\s+woonruimte[n]?\b/i, label: 'ruimte naar woonruimte', delta: 25 },
  { re: /\bwoningbouwproject\b/i, label: 'woningbouwproject', delta: 25 },
  { re: /appartement(?:en|encomplex)?\b/i, label: 'appartementen', delta: 20 },
  { re: /\bnieuwbouw\b/i, label: 'nieuwbouw', delta: 20 },
  { re: /\bsociale\s+huur/i, label: 'sociale huur', delta: 15 },
  { re: /\b(projectontwikkeling|gebiedsontwikkeling|grotere\s+ontwikkeling)\b/i, label: 'projectontwikkeling', delta: 15 },
  { re: /\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|herontwikkeling)\b/i, label: 'transformatie', delta: 25 },
  { re: /\b(functiewijziging|wijzigen\s+gebruik|gebruikswijziging)\b/i, label: 'functiewijziging', delta: 20 },
  { re: /\bleegstand\b/i, label: 'leegstand', delta: 15 },
  { re: /\b(bedrijfsbe[eë]indiging|opheffing|liquidatie)\b/i, label: 'bedrijfsbeeindiging', delta: 20 },
];

function scoreRecord(input: { titel: string; samenvatting: string; subjects: string[] }, cfg: BronConfig) {
  const blob = `${input.titel} ${input.samenvatting} ${input.subjects.join(' ')}`;
  const blobLower = blob.toLowerCase();
  const redenen: string[] = [];
  const componenten: ScoreComponent[] = [];
  let score = 0;

  const negHits = (cfg.negatieve_keywords ?? []).filter(k => blobLower.includes(k.toLowerCase()));
  if (negHits.length) {
    score -= 40; redenen.push(`negatief:${negHits.join(',')}`);
    componenten.push({ label: `onderhoud/ruis (${negHits.join(',')})`, delta: -40 });
  }

  for (const w of WEIGHTED_POSITIVE) {
    if (w.re.test(blob)) {
      score += w.delta;
      redenen.push(`+${w.delta} ${w.label}`);
      componenten.push({ label: w.label, delta: w.delta });
    }
  }

  const posHits = (cfg.positieve_keywords ?? []).filter(k => {
    const kl = k.toLowerCase();
    if (!blobLower.includes(kl)) return false;
    return !componenten.some(c => c.label.toLowerCase().includes(kl) || kl.includes(c.label.toLowerCase()));
  });
  if (posHits.length) {
    score += 10; redenen.push(`extra config-keywords:${posHits.join(',')}`);
    componenten.push({ label: `config-keywords (${posHits.join(',')})`, delta: 10 });
  }

  const a = parseAdres(`${input.titel} ${input.samenvatting}`);
  if (a.adres) { score += 20; redenen.push('adres'); componenten.push({ label: 'adres', delta: 20 }); }
  const at = detectAssettype(blobLower);
  if (at !== 'overig') { score += 15; redenen.push(`assettype:${at}`); componenten.push({ label: `assettype:${at}`, delta: 15 }); }
  if (/\b(pand|gebouw|complex|portefeuille|mixed[-\s]?use)\b/i.test(blob)) {
    score += 10; redenen.push('commercieel'); componenten.push({ label: 'commercieel', delta: 10 });
  }
  return { score: Math.max(0, Math.min(100, score)), redenen, componenten };
}
function formatScoreComponenten(componenten: ScoreComponent[]): string {
  if (!componenten.length) return '(geen componenten)';
  return componenten.map(c => `${c.delta >= 0 ? '+' : ''}${c.delta} ${c.label}`).join(' · ');
}
function yyyymm(d: string | null): string {
  if (!d) return 'onbekend';
  const m = d.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : 'onbekend';
}
function dedupeHashInput(adres: string | null, plaats: string | null, assettype: string, datum: string | null): string {
  const a = (adres ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const p = (plaats ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${a}|${p}|${assettype}|${yyyymm(datum)}`;
}
async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Handler =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const start = Date.now();
  try {
    const cronSecret = Deno.env.get('OFF_MARKET_CRON_SECRET');
    const providedCron = req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret');
    const isCronCall = !!cronSecret && !!providedCron && providedCron === cronSecret;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!isCronCall) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: isIntern } = await admin.rpc('is_intern_gebruiker', { _user_id: claimsData.claims.sub as string });
      if (!isIntern) {
        return new Response(JSON.stringify({ error: 'Geen toegang' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 1000);
    const bronFilter = body.bron_id as string | undefined;

    // Bronconfig vooraf inladen
    const { data: bronnen } = await admin.from('off_market_bronnen').select('id, config, naam');
    const cfgPerBron = new Map<string, BronConfig & { naam: string }>();
    (bronnen ?? []).forEach((b: any) => cfgPerBron.set(b.id, { ...(b.config ?? {}), naam: b.naam }));

    let q = admin.from('off_market_signalen_ruw').select('*').eq('verwerkt', false)
      .order('binnengekomen_op', { ascending: true }).limit(limit);
    if (bronFilter) q = q.eq('bron_id', bronFilter);
    const { data: ruw, error: ruwErr } = await q;
    if (ruwErr) throw ruwErr;

    let gepromoveerd = 0, geskipt = 0, merged = 0, fouten = 0;
    let aiGetriggerd = 0;
    const aiTriggerTaken: Array<Promise<unknown>> = [];

    function planAiTrigger(signaalId: string) {
      if (aiGetriggerd >= AI_TRIGGER_CAP_PER_RUN) return;
      if (!cronSecret) {
        console.error(
          '[normalize-ruw] AI auto-trigger overgeslagen: OFF_MARKET_CRON_SECRET ontbreekt in runtime',
          signaalId,
        );
        return;
      }
      aiGetriggerd++;
      aiTriggerTaken.push(
        admin.functions
          .invoke('off-market-enrich-signaal', {
            body: { signaal_id: signaalId, force: false },
            headers: { 'x-cron-secret': cronSecret },
          })
          .then(({ data, error }) => {
            if (error) {
              console.error(
                '[normalize-ruw] AI auto-trigger invoke-fout:',
                signaalId,
                error.message ?? error,
              );
              return null;
            }
            if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
              console.error(
                '[normalize-ruw] AI auto-trigger response-fout:',
                signaalId,
                (data as { error: unknown }).error,
              );
            }
            return data;
          })
          .catch((e) => {
            console.error('[normalize-ruw] AI auto-trigger faalde:', signaalId, e);
            return null;
          }),
      );
    }


    for (const r of (ruw ?? []) as any[]) {
      const cfg = cfgPerBron.get(r.bron_id) ?? {};
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      const titel = (payload.titel as string) ?? '';
      const samenvatting = (payload.samenvatting as string) ?? '';
      const subjects = (payload.subjects as string[]) ?? [];
      const datum = (payload.datum as string | null) ?? null;
      const link = (payload.link as string) ?? null;

      const drempel = Number(cfg.score_drempel ?? 40);
      const { score, redenen, componenten } = scoreRecord({ titel, samenvatting, subjects }, cfg);
      const scoreComponentenStr = formatScoreComponenten(componenten);

      if (score < drempel) {
        await admin.from('off_market_signalen_ruw').update({
          verwerkt: true,
          payload: {
            ...payload,
            skip_reden: `score=${score} (drempel=${drempel})`,
            score, redenen,
            score_componenten: componenten,
            score_componenten_tekst: scoreComponentenStr,
          },
        }).eq('id', r.id);
        geskipt++;
        continue;
      }

      const adresInfo = parseAdres(`${titel} ${samenvatting}`);
      const assettype = detectAssettype(`${titel} ${samenvatting}`);
      const signaaltype = detectSignaaltype(`${titel} ${samenvatting}`);
      const bronType = detectBronType(subjects);
      const hashInput = dedupeHashInput(adresInfo.adres, cfg.gemeente ?? null, assettype, datum);
      const dedupeHash = await sha256Hex(hashInput);

      // Check bestaand signaal
      const { data: bestaand } = await admin
        .from('off_market_signalen')
        .select('id, notities, ai_status')
        .eq('dedupe_hash', dedupeHash)
        .is('gearchiveerd_op', null)
        .maybeSingle();

      if (bestaand) {
        // Merge: behoud AI, voeg extra bron-info toe in notities (append-only audit trail).
        const stamp = new Date().toISOString().slice(0, 10);
        const note = `[auto-import ${stamp}] extra bron: ${(cfg as any).naam ?? 'bekendmaking'} – ${r.extern_id}${link ? ` (${link})` : ''}`;
        const nieuweNotities = bestaand.notities ? `${bestaand.notities}\n${note}` : note;
        await admin.from('off_market_signalen').update({
          notities: nieuweNotities,
          updated_at: new Date().toISOString(),
        }).eq('id', bestaand.id);
        await admin.from('off_market_signalen_ruw').update({
          verwerkt: true, signaal_id: bestaand.id,
          payload: { ...payload, merge_reden: 'dedupe-match', dedupe_hash: dedupeHash },
        }).eq('id', r.id);
        merged++;
        continue;
      }

      // Nieuw signaal aanmaken
      const blobText = `${titel} ${samenvatting}`;
      const insertPayload: any = {
        titel: titel.slice(0, 200) || 'Onbekende bekendmaking',
        omschrijving: samenvatting.slice(0, 500) || null,
        adres: adresInfo.adres,
        postcode: adresInfo.postcode,
        plaats: adresInfo.plaats ?? cfg.gemeente ?? null,
        provincie: cfg.provincie ?? null,
        assettype,
        type_signaal: signaaltype,
        vergunningtype: detectVergunningtype(blobText),
        aanvraag_of_besluit: detectAanvraagOfBesluit(blobText, subjects),
        bron_type: bronType,
        bron_id: r.bron_id,
        bron_url: link,
        bron_referentie: r.extern_id,
        bron_datum: datum,
        prioriteit: 'laag',
        status: 'nieuw_signaal',
        ai_status: 'niet_verrijkt',
        dedupe_hash: dedupeHash,
        potentiele_strategie: detectStrategie(blobText),
        notities: `[auto-import] score=${score}\nscore_componenten: ${scoreComponentenStr}`,
      };


      const { data: nieuwSig, error: insErr } = await admin
        .from('off_market_signalen').insert(insertPayload).select('*').single();
      if (insErr) {
        // Race condition: parallel insert met zelfde hash → merge alsnog
        if (insErr.code === '23505') {
          const { data: race } = await admin.from('off_market_signalen')
            .select('id').eq('dedupe_hash', dedupeHash).is('gearchiveerd_op', null).maybeSingle();
          if (race) {
            await admin.from('off_market_signalen_ruw').update({
              verwerkt: true, signaal_id: race.id,
              payload: { ...payload, merge_reden: 'race-dedupe', dedupe_hash: dedupeHash },
            }).eq('id', r.id);
            merged++;
            continue;
          }
        }
        console.error('insert signaal mislukt:', insErr);
        fouten++;
        continue;
      }

      await admin.from('off_market_signalen_ruw').update({
        verwerkt: true, signaal_id: nieuwSig.id,
        payload: {
          ...payload, score, redenen, dedupe_hash: dedupeHash,
          score_componenten: componenten,
          score_componenten_tekst: scoreComponentenStr,
        },
      }).eq('id', r.id);
      gepromoveerd++;

      // Automatische AI-verrijking — fire-and-forget via EdgeRuntime.waitUntil.
      // Gebruikt de volledige DB-row (incl. defaults) als input voor de guard;
      // fallback naar insertPayload + id als de row onverwacht niet beschikbaar is.
      const signaalVoorTrigger: SignaalAutoInput =
        (nieuwSig as SignaalAutoInput | null) ?? { ...insertPayload, id: nieuwSig?.id };
      const beslissing = magAiAutoVerrijken(signaalVoorTrigger);
      if (beslissing.toegestaan) {
        planAiTrigger(nieuwSig.id as string);
      }
    }

    // Achtergrond-invocations veilig laten doorlopen na response.
    if (aiTriggerTaken.length > 0) {
      const settle = Promise.allSettled(aiTriggerTaken);
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(settle);
      } else {
        // Fallback (lokaal/tests): await zodat invocations niet stilletjes wegvallen.
        await settle;
      }
    }

    return new Response(JSON.stringify({
      ok: true, verwerkt: (ruw ?? []).length, gepromoveerd, geskipt, merged, fouten,
      ai_getriggerd: aiGetriggerd, ai_trigger_cap: AI_TRIGGER_CAP_PER_RUN,
      duur_ms: Date.now() - start,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('normalize error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
