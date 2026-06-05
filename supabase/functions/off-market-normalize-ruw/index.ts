// off-market-normalize-ruw
// Verwerkt onverwerkte rijen uit off_market_signalen_ruw:
//   - score-filter (regelgebaseerd, geen AI)
//   - adres + assettype + signaaltype detectie
//   - dedupe op (adres+plaats+assettype+yyyymm) → upsert signaal
//   - markeert ruw-rij als verwerkt + signaal_id of skip_reden

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
const STRAAT_RE = /\b([A-ZÀ-Ý][\wÀ-ÿ\-' ]{2,40}?(?:straat|laan|weg|plein|kade|gracht|singel|dreef|hof|park|baan|dijk|markt|wal|pad|steeg)\.?)\s+(\d{1,4})\s*([a-zA-Z]{0,3})\b/;
const POSTCODE_RE = /\b([1-9]\d{3})\s?([A-Z]{2})\b/;

function parseAdres(text: string) {
  if (!text) return { adres: null as string | null, postcode: null as string | null };
  const norm = text.replace(/\s+/g, ' ').trim();
  const s = norm.match(STRAAT_RE);
  const p = norm.match(POSTCODE_RE);
  return {
    adres: s ? `${s[1].trim()} ${s[2]}${s[3] || ''}`.trim() : null,
    postcode: p ? `${p[1]} ${p[2]}` : null,
  };
}
const ASSETTYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(kantoor|kantoren|office)\b/i, 'kantoor'],
  [/\b(winkel|winkelpand|retail)\b/i, 'winkelpand'],
  [/\b(woon[-\s]?\/?winkelpand|woon\s+winkel)\b/i, 'woon_winkelpand'],
  [/\b(bedrijfshal|bedrijfscomplex|bedrijfspand)\b/i, 'bedrijfscomplex'],
  [/\b(light\s*industrial)\b/i, 'light_industrial'],
  [/\b(logistiek|distributiecentrum|dc\b)/i, 'logistiek'],
  [/\b(zorg|verpleeg|zorginstelling)\b/i, 'zorgvastgoed'],
  [/\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|herontwikkeling)\b/i, 'transformatieobject'],
  [/\b(ontwikkellocatie|bouwkavel)\b/i, 'ontwikkellocatie'],
];
function detectAssettype(t: string): string {
  for (const [re, type] of ASSETTYPE_KEYWORDS) if (re.test(t)) return type;
  return 'overig';
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
function scoreRecord(input: { titel: string; samenvatting: string; subjects: string[] }, cfg: BronConfig) {
  const blob = `${input.titel} ${input.samenvatting} ${input.subjects.join(' ')}`.toLowerCase();
  const redenen: string[] = [];
  let score = 0;
  const negHits = (cfg.negatieve_keywords ?? []).filter(k => blob.includes(k.toLowerCase()));
  if (negHits.length) { score -= 40; redenen.push(`negatief:${negHits.join(',')}`); }
  const posHits = (cfg.positieve_keywords ?? []).filter(k => blob.includes(k.toLowerCase()));
  if (posHits.length) { score += 30; redenen.push(`positief:${posHits.join(',')}`); }
  const a = parseAdres(`${input.titel} ${input.samenvatting}`);
  if (a.adres) { score += 20; redenen.push('adres'); }
  const at = detectAssettype(blob);
  if (at !== 'overig') { score += 15; redenen.push(`assettype:${at}`); }
  if (/\b(pand|gebouw|complex|portefeuille|mixed[-\s]?use)\b/i.test(blob)) {
    score += 10; redenen.push('commercieel');
  }
  return { score: Math.max(0, Math.min(100, score)), redenen };
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
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

    for (const r of (ruw ?? []) as any[]) {
      const cfg = cfgPerBron.get(r.bron_id) ?? {};
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      const titel = (payload.titel as string) ?? '';
      const samenvatting = (payload.samenvatting as string) ?? '';
      const subjects = (payload.subjects as string[]) ?? [];
      const datum = (payload.datum as string | null) ?? null;
      const link = (payload.link as string) ?? null;

      const drempel = Number(cfg.score_drempel ?? 40);
      const { score, redenen } = scoreRecord({ titel, samenvatting, subjects }, cfg);

      if (score < drempel) {
        await admin.from('off_market_signalen_ruw').update({
          verwerkt: true,
          payload: { ...payload, skip_reden: `score=${score}`, score, redenen },
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
      const insertPayload: any = {
        titel: titel.slice(0, 200) || 'Onbekende bekendmaking',
        omschrijving: samenvatting.slice(0, 500) || null,
        adres: adresInfo.adres,
        postcode: adresInfo.postcode,
        plaats: cfg.gemeente ?? null,
        provincie: cfg.provincie ?? null,
        assettype,
        type_signaal: signaaltype,
        bron_type: bronType,
        bron_id: r.bron_id,
        bron_url: link,
        bron_referentie: r.extern_id,
        bron_datum: datum,
        prioriteit: 'laag',
        status: 'nieuw_signaal',
        ai_status: 'niet_verrijkt',
        dedupe_hash: dedupeHash,
        notities: `[auto-import] score=${score} · ${redenen.join(' · ')}`,
      };

      const { data: nieuwSig, error: insErr } = await admin
        .from('off_market_signalen').insert(insertPayload).select('id').single();
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
        payload: { ...payload, score, redenen, dedupe_hash: dedupeHash },
      }).eq('id', r.id);
      gepromoveerd++;
    }

    return new Response(JSON.stringify({
      ok: true, verwerkt: (ruw ?? []).length, gepromoveerd, geskipt, merged, fouten,
      duur_ms: Date.now() - start,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('normalize error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
