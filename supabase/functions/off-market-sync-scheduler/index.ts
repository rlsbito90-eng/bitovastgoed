// off-market-sync-scheduler
// Wordt aangeroepen door pg_cron (uurlijks). Beveiligd met X-Cron-Secret header.
// Doel: voor alle bronnen met auto_import=true bepalen of ze aan de beurt zijn,
// roep dan de bestaande import-functie aan in modus=sync, en optioneel normalize
// in beperkte chunks. Raakt GEEN AI/Kadaster/KVK/brief-functionaliteit.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Frequentie = 'handmatig' | 'dagelijks' | 'wekelijks' | 'maandelijks';
const DAG_VAN_DE_MAAND = 28;
const MAX_NORMALIZE_CHUNKS = 3;
const TIME_BUDGET_MS = 55_000;

// --- Amsterdam-helpers (gedupliceerd van src/lib/offMarket/scheduler/planning.ts) ---
const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};
function amsterdamParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== 'literal') parts[p.type] = p.value;
  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: +(parts.hour === '24' ? '0' : parts.hour),
    minute: +parts.minute, second: +parts.second,
    weekday: WEEKDAY_MAP[parts.weekday] ?? 1,
  };
}
function amsterdamWallToUtc(y: number, m: number, d: number, h: number, min = 0): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min, 0));
  const p = amsterdamParts(guess);
  let diff = (h * 60 + min) - (p.hour * 60 + p.minute);
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return new Date(guess.getTime() + diff * 60_000);
}
function plusDagen(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
function berekenVolgendeRun(
  now: Date, frequentie: Frequentie, tijdstipUur: number, tijdstipMinuut: number, dagVanWeek: number | null,
): Date | null {
  if (frequentie === 'handmatig') return null;
  const uur = Math.max(0, Math.min(23, Math.floor(tijdstipUur)));
  const min = [0, 15, 30, 45].includes(tijdstipMinuut) ? tijdstipMinuut : 0;
  const p = amsterdamParts(now);
  if (frequentie === 'dagelijks') {
    const vandaag = amsterdamWallToUtc(p.year, p.month, p.day, uur, min);
    if (vandaag > now) return vandaag;
    const morgen = plusDagen(p.year, p.month, p.day, 1);
    return amsterdamWallToUtc(morgen.year, morgen.month, morgen.day, uur, min);
  }
  if (frequentie === 'wekelijks') {
    const target = dagVanWeek && dagVanWeek >= 1 && dagVanWeek <= 7 ? dagVanWeek : 1;
    let daysAhead = (target - p.weekday + 7) % 7;
    const vandaagCand = amsterdamWallToUtc(p.year, p.month, p.day, uur, min);
    if (daysAhead === 0 && vandaagCand <= now) daysAhead = 7;
    if (daysAhead === 0) return vandaagCand;
    const tgt = plusDagen(p.year, p.month, p.day, daysAhead);
    return amsterdamWallToUtc(tgt.year, tgt.month, tgt.day, uur, min);
  }
  if (frequentie === 'maandelijks') {
    let y = p.year, m = p.month;
    let cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur, min);
    if (cand <= now) {
      m += 1; if (m > 12) { m = 1; y += 1; }
      cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur, min);
    }
    return cand;
  }
  return null;
}


// --- Handler ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // --- Auth: alleen via cron-secret ---
  const cronSecret = Deno.env.get('OFF_MARKET_CRON_SECRET');
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'OFF_MARKET_CRON_SECRET ontbreekt' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const provided = req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret');
  if (provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const start = Date.now();
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const functionsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { data: bronnen, error } = await admin
      .from('off_market_bronnen')
      .select('id, naam, actief, auto_import, auto_verwerken, frequentie, dag_van_week, tijdstip_uur, tijdstip_minuut, normalize_batch_size, max_records_per_run, volgende_run_op, laatste_sync_op, auto_start_op')
      .eq('actief', true)
      .eq('auto_import', true);

    if (error) throw error;

    const now = new Date();
    const todayAms = amsterdamParts(now);
    const todayYmd = `${todayAms.year}-${String(todayAms.month).padStart(2, '0')}-${String(todayAms.day).padStart(2, '0')}`;
    const kandidaten = (bronnen ?? []).filter((b: any) => {
      if (b.frequentie === 'handmatig') return false;
      // Respecteer auto_start_op: niet uitvoeren vóór de gekozen startdatum.
      if (b.auto_start_op && String(b.auto_start_op) > todayYmd) return false;
      if (!b.volgende_run_op) return true;
      return new Date(b.volgende_run_op).getTime() <= now.getTime();
    });


    const resultaten: any[] = [];

    for (const b of kandidaten as any[]) {
      if (Date.now() - start > TIME_BUDGET_MS) {
        resultaten.push({ bron_id: b.id, naam: b.naam, status: 'overgeslagen_tijd' });
        continue;
      }

      let syncResp: any = null;
      let normResp: any = null;
      let fout: string | null = null;

      try {
        const r = await fetch(`${functionsUrl}/off-market-import-bekendmakingen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
            'x-scheduler-source': 'cron',
          },
          body: JSON.stringify({ bron_id: b.id, modus: 'sync' }),
        });
        syncResp = await r.json().catch(() => ({}));
        if (!r.ok || syncResp?.error) {
          throw new Error(syncResp?.error || `import HTTP ${r.status}`);
        }

        if (b.auto_verwerken) {
          const batch = Math.max(1, Math.min(1000, Number(b.normalize_batch_size ?? 200)));
          let chunks = 0, totaalVerwerkt = 0;
          let agg = { verwerkt: 0, gepromoveerd: 0, geskipt: 0, merged: 0, fouten: 0 };
          while (chunks < MAX_NORMALIZE_CHUNKS && (Date.now() - start) < TIME_BUDGET_MS) {
            const nr = await fetch(`${functionsUrl}/off-market-normalize-ruw`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
                'apikey': serviceKey,
                'x-scheduler-source': 'cron',
              },
              body: JSON.stringify({ limit: batch, bron_id: b.id }),
            });
            const nd = await nr.json().catch(() => ({}));
            if (!nr.ok || nd?.error) {
              throw new Error(nd?.error || `normalize HTTP ${nr.status}`);
            }
            chunks++;
            agg.verwerkt += Number(nd.verwerkt ?? 0);
            agg.gepromoveerd += Number(nd.gepromoveerd ?? 0);
            agg.geskipt += Number(nd.geskipt ?? 0);
            agg.merged += Number(nd.merged ?? 0);
            agg.fouten += Number(nd.fouten ?? 0);
            totaalVerwerkt = agg.verwerkt;
            if (Number(nd.verwerkt ?? 0) < batch) break; // wachtrij leeg
          }
          normResp = { ...agg, chunks };
        }
      } catch (e) {
        fout = e instanceof Error ? e.message : String(e);
      }

      // Bereken nieuwe volgende_run_op (altijd, ook bij fout — anders blijft de bron 'aan de beurt').
      const volgende = berekenVolgendeRun(
        new Date(), b.frequentie as Frequentie, b.tijdstip_uur, b.dag_van_week,
      );
      await admin.from('off_market_bronnen').update({
        volgende_run_op: volgende?.toISOString() ?? null,
      }).eq('id', b.id);

      resultaten.push({
        bron_id: b.id,
        naam: b.naam,
        frequentie: b.frequentie,
        sync: syncResp ? {
          opgehaald: syncResp.opgehaald, nieuw: syncResp.nieuw, dubbel: syncResp.dubbel,
          totaal_server: syncResp.totaal_server, run_id: syncResp.run_id,
        } : null,
        normalize: normResp,
        volgende_run_op: volgende?.toISOString() ?? null,
        status: fout ? 'fout' : 'ok',
        fout,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      gestart_op: new Date(start).toISOString(),
      duur_ms: Date.now() - start,
      kandidaten: kandidaten.length,
      verwerkt: resultaten.length,
      resultaten,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('scheduler error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
