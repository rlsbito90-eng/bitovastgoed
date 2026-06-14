// off-market-import-bekendmakingen
// Haalt SRU-records op bij KOOP, slaat idempotent op in off_market_signalen_ruw.
// Authenticatie via JWT + interne rol-check. Geen AI, geen kosten.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT = 'BitoVastgoed-OffMarketRadar/1.0';
const HTTP_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

interface SruRecord {
  identifier: string;
  titel: string;
  datum: string | null;
  samenvatting: string;
  subjects: string[];
  creator: string | null;
  link: string;
}

// ===== SRU parser (gedupliceerd van src/lib/offMarket/import/sruParser.ts) =====
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
}
function stripTags(s: string): string {
  return decodeXml(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function pluckAll(block: string, localName: string): string[] {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${localName}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const v = stripTags(m[1]);
    if (v) out.push(v);
  }
  return out;
}
function pluckFirst(b: string, n: string): string | null { return pluckAll(b, n)[0] ?? null; }

function bouwSruUrl(opts: {
  endpoint: string; creator: string; subjects: string[];
  sinceIso: string; totIso?: string | null; startRecord: number; maximumRecords: number;
}): string {
  // KOOP SRU gebruikt prefix `dt.` (dcterms-alias). Gemeenteblad = identifier "gmb-...".
  // dt.subject is in praktijk niet doorzoekbaar → subjecten filteren we client-side in normalize.
  let cql =
    `(dt.identifier any "gmb") AND (dt.creator="${opts.creator}") AND (dt.modified >= "${opts.sinceIso}")`;
  if (opts.totIso) cql += ` AND (dt.modified <= "${opts.totIso}")`;
  const params = new URLSearchParams({
    operation: 'searchRetrieve', version: '2.0', query: cql,
    startRecord: String(opts.startRecord), maximumRecords: String(opts.maximumRecords),
  });
  return `${opts.endpoint}?${params.toString()}`;
}

function parseSruResponse(xml: string): { records: SruRecord[]; totaal: number } {
  const tm = xml.match(/<(?:[a-zA-Z0-9]+:)?numberOfRecords[^>]*>(\d+)<\/(?:[a-zA-Z0-9]+:)?numberOfRecords>/);
  const totaal = tm ? Number(tm[1]) : 0;
  const recordRe = /<(?:[a-zA-Z0-9]+:)?record(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?record>/g;
  const records: SruRecord[] = [];
  let m: RegExpExecArray | null;
  while ((m = recordRe.exec(xml)) !== null) {
    const block = m[1];
    const identifier = pluckFirst(block, 'identifier');
    if (!identifier) continue;
    const titel = (pluckFirst(block, 'title') ?? identifier).slice(0, 500);
    const datum = pluckFirst(block, 'modified') ?? pluckFirst(block, 'available') ?? pluckFirst(block, 'issued');
    const samenvatting = (pluckFirst(block, 'abstract') ?? pluckFirst(block, 'description') ?? '').slice(0, 1000);
    records.push({
      identifier, titel, datum, samenvatting,
      subjects: pluckAll(block, 'subject'),
      creator: pluckFirst(block, 'creator'),
      link: `https://zoek.officielebekendmakingen.nl/${identifier}.html`,
    });
  }
  return { records, totaal };
}

// ===== Fetch met retry + timeout =====
async function fetchMetRetry(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

// ===== Edge-handler =====
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
      const userId = claimsData.claims.sub as string;
      const { data: isIntern } = await admin.rpc('is_intern_gebruiker', { _user_id: userId });
      if (!isIntern) {
        return new Response(JSON.stringify({ error: 'Geen toegang' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    const body = await req.json().catch(() => ({}));
    const bronId = body.bron_id as string | undefined;
    const testMode = body.test_mode === true;
    // Modus bepalen — backwards compat: test_mode=true → 'test', anders 'handmatig'.
    const modusRaw = (body.modus as string | undefined)?.toLowerCase();
    const modus: 'test' | 'sync' | 'backfill' | 'handmatig' =
      modusRaw === 'test' || modusRaw === 'sync' || modusRaw === 'backfill' || modusRaw === 'handmatig'
        ? modusRaw
        : (testMode ? 'test' : 'handmatig');
    const lookbackOverride = body.lookback_days as number | undefined;
    const maxRecordsOverride = typeof body.max_records === 'number' && Number.isFinite(body.max_records)
      ? Math.max(1, Math.min(1000, Math.floor(body.max_records)))
      : undefined;
    if (!bronId) {
      return new Response(JSON.stringify({ error: 'bron_id verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: bron, error: bErr } = await admin
      .from('off_market_bronnen').select('*').eq('id', bronId).maybeSingle();
    if (bErr || !bron) {
      return new Response(JSON.stringify({ error: 'Bron niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!bron.actief) {
      return new Response(JSON.stringify({ error: 'Bron is niet actief' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cfg = (bron.config ?? {}) as Record<string, unknown>;
    const endpoint = bron.endpoint_url ?? 'https://repository.overheid.nl/sru';
    const creator = cfg.sru_creator as string | undefined;
    const subjects = (cfg.sru_subjects as string[] | undefined) ?? [];
    // Voorkeur: kolomwaarden uit bron. Fallback: cfg of defaults voor oudere bronnen.
    const cfgMax = Number(bron.max_records_per_run ?? cfg.max_records_per_run ?? 200);
    const maxRecords = Math.max(1, Math.min(1000, maxRecordsOverride ?? cfgMax));
    const lookbackFirst = Number(cfg.lookback_days_first_run ?? bron.lookback_days_default ?? 7);
    const lookbackDefault = Number(bron.lookback_days_default ?? cfg.lookback_days_default ?? 7);
    const overlapUren = Number(bron.lookback_overlap_uren ?? 24);
    if (!creator) {
      return new Response(JSON.stringify({ error: 'config.sru_creator ontbreekt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Bepaal sync-venster (query_vanaf / query_tot).
    const nu = new Date();
    let queryVanaf: Date;
    if (modus === 'sync') {
      if (bron.laatste_sync_op) {
        queryVanaf = new Date(new Date(bron.laatste_sync_op).getTime() - Math.max(0, overlapUren) * 3600_000);
      } else {
        queryVanaf = new Date(nu.getTime() - Math.max(1, lookbackDefault) * 86400_000);
      }
    } else {
      const lookbackDays = modus === 'test'
        ? (lookbackOverride ?? 30)
        : (lookbackOverride ?? (bron.laatste_run_op ? lookbackDefault : lookbackFirst));
      queryVanaf = new Date(nu.getTime() - Math.max(1, lookbackDays) * 86400_000);
    }
    const queryTot = nu;
    const sinceIso = queryVanaf.toISOString().slice(0, 10);

    // Run-logging — start direct met status=bezig.
    const { data: runRow } = await admin
      .from('off_market_import_runs')
      .insert({
        bron_id: bronId,
        modus,
        status: 'bezig',
        query_vanaf: queryVanaf.toISOString(),
        query_tot: queryTot.toISOString(),
      })
      .select('id')
      .single();
    const runId = runRow?.id as string | undefined;

    let startRecord = 1;
    let opgehaald = 0, nieuw = 0, dubbel = 0;
    let totaalServer = 0;
    let firstQueryUrl = '';
    const pageSize = 200;
    const TIME_BUDGET_MS = 50_000;

    try {
      while (opgehaald < maxRecords && (Date.now() - start) < TIME_BUDGET_MS) {
        const url = bouwSruUrl({
          endpoint, creator, subjects, sinceIso,
          startRecord, maximumRecords: Math.min(pageSize, maxRecords - opgehaald),
        });
        if (!firstQueryUrl) firstQueryUrl = url;
        console.log(JSON.stringify({
          fase: 'sru_fetch', bron: bron.naam, creator, sinceIso, modus,
          startRecord, url,
        }));
        const xml = await fetchMetRetry(url);
        const { records, totaal } = parseSruResponse(xml);
        if (startRecord === 1) totaalServer = totaal;
        console.log(JSON.stringify({
          fase: 'sru_response', bron: bron.naam,
          totaal_server: totaal, records_in_page: records.length, startRecord,
        }));
        if (records.length === 0) break;

        for (const r of records) {
          const payload = {
            titel: r.titel, datum: r.datum, samenvatting: r.samenvatting,
            subjects: r.subjects, creator: r.creator, link: r.link,
          };
          const { error: insErr } = await admin
            .from('off_market_signalen_ruw')
            .insert({ bron_id: bronId, extern_id: r.identifier, payload });
          if (insErr) {
            if (insErr.code === '23505') dubbel++;
            else throw insErr;
          } else {
            nieuw++;
          }
        }
        opgehaald += records.length;
        startRecord += records.length;
        if (startRecord > totaal) break;
        if (records.length < pageSize) break;
      }

      const duurMs = Date.now() - start;
      const afgebroken = opgehaald < maxRecords && duurMs >= TIME_BUDGET_MS;
      const status = {
        opgehaald, nieuw, dubbel, duur_ms: duurMs, sinceIso,
        totaal_server: totaalServer, max_records: maxRecords, afgebroken,
        test_mode: testMode, modus, query_url: firstQueryUrl,
        query_vanaf: queryVanaf.toISOString(), query_tot: queryTot.toISOString(),
      };
      const bronUpdate: Record<string, unknown> = {
        laatste_run_op: new Date().toISOString(),
        laatste_run_status: JSON.stringify(status),
        laatste_fout: null,
      };
      // Alleen bij succesvolle sync laatste_sync_op bijwerken.
      if (modus === 'sync' && !afgebroken) {
        bronUpdate.laatste_sync_op = queryTot.toISOString();
      }
      await admin.from('off_market_bronnen').update(bronUpdate).eq('id', bronId);

      if (runId) {
        await admin.from('off_market_import_runs').update({
          status: afgebroken ? 'afgebroken' : 'ok',
          afgerond_op: new Date().toISOString(),
          query_url: firstQueryUrl || null,
          server_total: totaalServer,
          opgehaald, nieuw, dubbel,
          duration_ms: duurMs,
        }).eq('id', runId);
      }

      return new Response(JSON.stringify({ ok: true, run_id: runId, ...status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const duurMs = Date.now() - start;
      await admin.from('off_market_bronnen').update({
        laatste_run_op: new Date().toISOString(),
        laatste_run_status: JSON.stringify({ status: 'mislukt', opgehaald, nieuw, dubbel, modus }),
        laatste_fout: msg.slice(0, 500),
      }).eq('id', bronId);
      if (runId) {
        await admin.from('off_market_import_runs').update({
          status: 'fout',
          afgerond_op: new Date().toISOString(),
          query_url: firstQueryUrl || null,
          server_total: totaalServer,
          opgehaald, nieuw, dubbel,
          duration_ms: duurMs,
          foutmelding: msg.slice(0, 1000),
        }).eq('id', runId);
      }
      return new Response(JSON.stringify({ error: msg, run_id: runId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    console.error('import error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
