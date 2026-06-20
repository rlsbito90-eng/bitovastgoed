// Off-Market Radar — AI-verrijking van één signaal.
// JWT verplicht, alleen interne gebruikers. Cache op input_hash.
// Schrijft AI-velden in off_market_signalen en logt run in off_market_ai_runs.
// Overschrijft NOOIT business-velden (indicatieve_waarde, mogelijke_fee, prioriteit, etc.).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { magBagAutoVerrijken } from '../_shared/offMarketAutoTrigger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT_VERSIE = 'v1.0';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

const SCORE_GEWICHTEN = {
  locatie: 25, asset_match: 20, eigenaar_signaal: 25, timing: 15, fee_potentieel: 15,
} as const;
type ScoreComponent = keyof typeof SCORE_GEWICHTEN;

const SYSTEEM_PROMPT = `Je bent een senior off-market acquisitie-analist voor Bito Vastgoed, een Nederlandse boutique adviseur die zich richt op off-market commercieel en mixed-use vastgoed in de Randstad en Noord-Brabant.

Je beoordeelt een binnenkomend signaal en levert een gestructureerde analyse via de "score_signaal" tool. Output ALTIJD in het Nederlands.

Scoringscriteria (elk 0-100):
- locatie: Hoe aantrekkelijk is de locatie voor Bito's focusgebied?
- asset_match: Past het assettype bij Bito's expertise (kantoor, winkel, mixed-use, light industrial, logistiek, zorg, transformatie)?
- eigenaar_signaal: Sterkte van het verkoopsignaal.
- timing: Hoe urgent/actueel is het signaal?
- fee_potentieel: Verwachte fee-grootte op basis van waarde-indicatie.

Verkoopkans (0-1): inschatting dat dit binnen 12 maanden tot een sell-side mandaat of acquisitie leidt.
Strategie-suggestie: kort (≤200 tekens).
Aanbevolen actie: één concrete eerste stap (≤200 tekens).
Data-kwaliteit: "laag" bij <3 bruikbare velden.
Skip-reden: alleen vullen als signaal écht geen opvolging waard is.`;

const ASSETTYPE_SYNONIEMEN: Record<string, string> = {
  kantoor: 'kantoor', kantoren: 'kantoor', office: 'kantoor',
  winkel: 'winkelpand', winkelpand: 'winkelpand', retail: 'winkelpand',
  'woon-winkelpand': 'woon_winkelpand', woon_winkelpand: 'woon_winkelpand',
  bedrijfscomplex: 'bedrijfscomplex', bedrijfshal: 'bedrijfscomplex',
  light_industrial: 'light_industrial', 'light industrial': 'light_industrial',
  logistiek: 'logistiek', logistics: 'logistiek', distributie: 'logistiek',
  zorg: 'zorgvastgoed', zorgvastgoed: 'zorgvastgoed', healthcare: 'zorgvastgoed',
  transformatie: 'transformatieobject', transformatieobject: 'transformatieobject',
  ontwikkellocatie: 'ontwikkellocatie', ontwikkeling: 'ontwikkellocatie',
  portefeuille: 'vastgoedportefeuille', vastgoedportefeuille: 'vastgoedportefeuille',
};
function mapAssettype(ruw: string | null | undefined): string | null {
  if (!ruw) return null;
  const k = ruw.toLowerCase().trim().replace(/\s+/g, '_');
  return ASSETTYPE_SYNONIEMEN[k] ?? null;
}
function herbeperkenScore(comp: Record<string, number>): number {
  let som = 0; let totaal = 0;
  for (const k of Object.keys(SCORE_GEWICHTEN) as ScoreComponent[]) {
    const v = comp[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const c = Math.max(0, Math.min(100, v));
      som += c * SCORE_GEWICHTEN[k];
      totaal += SCORE_GEWICHTEN[k];
    }
  }
  return totaal === 0 ? 0 : Math.round(som / totaal);
}
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])).join(',') + '}';
}
async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const AI_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'score_signaal',
    description: 'Lever de gestructureerde beoordeling van het off-market signaal.',
    parameters: {
      type: 'object',
      properties: {
        score: { type: 'number' },
        score_componenten: {
          type: 'object',
          properties: {
            locatie: { type: 'number' }, asset_match: { type: 'number' },
            eigenaar_signaal: { type: 'number' }, timing: { type: 'number' },
            fee_potentieel: { type: 'number' },
          },
          required: ['locatie', 'asset_match', 'eigenaar_signaal', 'timing', 'fee_potentieel'],
          additionalProperties: false,
        },
        verkoopkans: { type: 'number' },
        samenvatting: { type: 'string' },
        aanbevolen_actie: { type: 'string' },
        strategie_suggestie: { type: 'string' },
        geclassificeerd_assettype: { type: 'string' },
        data_kwaliteit: { type: 'string', enum: ['laag', 'middel', 'hoog'] },
        skip_reden: { type: 'string' },
      },
      required: ['score_componenten', 'verkoopkans', 'samenvatting', 'aanbevolen_actie', 'strategie_suggestie'],
      additionalProperties: false,
    },
  },
};

function buildPayload(s: Record<string, unknown>) {
  const trim = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    titel: s.titel as string,
    assettype: s.assettype as string,
    type_signaal: s.type_signaal as string,
    bron_type: s.bron_type as string,
    plaats: trim(s.plaats),
    provincie: trim(s.provincie),
    regio: trim(s.regio),
    adres: trim(s.adres),
    omschrijving: trim(s.omschrijving),
    indicatieve_waarde: s.indicatieve_waarde != null ? Number(s.indicatieve_waarde) : null,
    mogelijke_fee: s.mogelijke_fee != null ? Number(s.mogelijke_fee) : null,
    potentiele_strategie: trim(s.potentiele_strategie),
    eigenaar_bekend: !!s.eigenaar_bekend,
    bron_url: trim(s.bron_url),
    bron_referentie: trim(s.bron_referentie),
    notities: trim(s.notities),
  };
}

function mapOutput(out: Record<string, unknown>, model: string, promptVersie: string) {
  const compRaw = (out.score_componenten ?? {}) as Record<string, number>;
  const componenten: Record<string, number> = {};
  for (const k of Object.keys(SCORE_GEWICHTEN) as ScoreComponent[]) {
    const v = compRaw[k];
    componenten[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
  }
  const score = herbeperkenScore(componenten);
  const vk = out.verkoopkans;
  const verkoopkans = typeof vk === 'number' && Number.isFinite(vk) ? Math.max(0, Math.min(1, vk)) : null;
  const clip = (s: unknown, max: number) => {
    if (typeof s !== 'string') return null;
    const t = s.trim();
    if (!t) return null;
    return t.length > max ? t.slice(0, max) : t;
  };
  const assettype = mapAssettype(typeof out.geclassificeerd_assettype === 'string' ? out.geclassificeerd_assettype : null);
  const skip = typeof out.skip_reden === 'string' && out.skip_reden.trim() ? out.skip_reden.trim().slice(0, 60) : null;
  return {
    ai_score: score,
    ai_score_componenten: componenten,
    ai_verkoopkans: verkoopkans,
    ai_samenvatting: clip(out.samenvatting, 400),
    ai_aanbevolen_actie: clip(out.aanbevolen_actie, 200),
    ai_strategie_suggestie: clip(out.strategie_suggestie, 200),
    ai_classificatie_assettype: assettype,
    ai_skip_reden: skip,
    ai_status: 'klaar' as const,
    ai_model: model,
    ai_prompt_versie: promptVersie,
    ai_laatst_verrijkt_op: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const start = Date.now();
  try {
    const cronSecret = Deno.env.get('OFF_MARKET_CRON_SECRET');
    const providedCron = req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret');
    const isCronCall = !!cronSecret && !!providedCron && providedCron === cronSecret;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!isCronCall) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userId = claimsData.claims.sub as string;

      const { data: roleData } = await admin.rpc('is_intern_gebruiker', { _user_id: userId });
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Geen toegang' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    const body = await req.json().catch(() => ({}));
    const signaalId = body.signaal_id as string | undefined;
    const force = !!body.force;
    const model = (body.model as string | undefined) ?? DEFAULT_MODEL;
    // BAG-cascade staat default aan. AI-backlog stuurt expliciet cascade_bag:false.
    const cascadeBag = body.cascade_bag !== false;
    if (!signaalId) {
      return new Response(JSON.stringify({ error: 'signaal_id verplicht' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    /**
     * Plan server-side BAG-cascade na succesvolle AI-persist.
     * - Skip volledig wanneer cascade_bag:false werd meegegeven.
     * - Re-fetch verse rij, evalueer guard, log geweigerde/falende invokes.
     * - Achtergrond-invocatie via EdgeRuntime.waitUntil; geen retry.
     */
    function planBagCascade(sid: string) {
      if (!cascadeBag) return;
      if (!cronSecret) {
        console.error('[enrich] BAG-cascade overgeslagen: OFF_MARKET_CRON_SECRET ontbreekt in runtime', sid);
        return;
      }
      const task = (async () => {
        try {
          const { data: fresh, error: fetchErr } = await admin
            .from('off_market_signalen').select('*').eq('id', sid).maybeSingle();
          if (fetchErr || !fresh) {
            console.error('[enrich] BAG-cascade: signaal niet gevonden', sid, fetchErr?.message);
            return;
          }
          const beslissing = magBagAutoVerrijken(fresh as Record<string, unknown>);
          if (!beslissing.toegestaan) {
            console.log('[enrich] BAG-cascade geweigerd:', sid, beslissing.reden);
            return;
          }
          const { data, error } = await admin.functions.invoke('off-market-bag-verrijk', {
            body: { signaal_id: sid, force: false },
            headers: { 'x-cron-secret': cronSecret! },
          });
          if (error) {
            console.error('[enrich] BAG-cascade invoke-fout:', sid, error.message ?? error);
            return;
          }
          if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
            console.error('[enrich] BAG-cascade response-fout:', sid, (data as { error: unknown }).error);
          }
        } catch (e) {
          console.error('[enrich] BAG-cascade faalde:', sid, e);
        }
      })();
      try {
        // @ts-ignore EdgeRuntime is een runtime-globale van Supabase Edge Functions.
        (globalThis as any).EdgeRuntime?.waitUntil?.(task);
      } catch {
        /* fail-soft: in lokale runtimes wordt task gewoon meegelopen. */
      }
    }


    const { data: signaal, error: sErr } = await admin
      .from('off_market_signalen').select('*').eq('id', signaalId).maybeSingle();
    if (sErr || !signaal) {
      return new Response(JSON.stringify({ error: 'Signaal niet gevonden' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('off_market_signalen').update({ ai_status: 'bezig' }).eq('id', signaalId);

    const payload = buildPayload(signaal as Record<string, unknown>);
    const hash = await sha256Hex(stableStringify({ payload, model, promptVersie: PROMPT_VERSIE }));

    // Cache lookup
    if (!force) {
      const { data: cached } = await admin
        .from('off_market_ai_runs')
        .select('output, model, prompt_versie')
        .eq('input_hash', hash).eq('succes', true)
        .order('run_op', { ascending: false }).limit(1).maybeSingle();
      if (cached?.output) {
        const update = mapOutput(cached.output as Record<string, unknown>, cached.model ?? model, cached.prompt_versie ?? PROMPT_VERSIE);
        await admin.from('off_market_signalen').update(update).eq('id', signaalId);
        await admin.from('off_market_ai_runs').insert({
          signaal_id: signaalId, model, prompt_versie: PROMPT_VERSIE,
          input_hash: hash, output: cached.output, kosten: 0,
          latentie_ms: Date.now() - start, succes: true,
        });
        return new Response(JSON.stringify({ ok: true, cached: true, update }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ontbreekt');

    const userMsg = 'Beoordeel het volgende signaal:\n\n' + JSON.stringify(payload, null, 2);
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        tools: [AI_TOOL_SCHEMA],
        tool_choice: { type: 'function', function: { name: 'score_signaal' } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text().catch(() => '');
      await admin.from('off_market_signalen').update({ ai_status: 'mislukt' }).eq('id', signaalId);
      await admin.from('off_market_ai_runs').insert({
        signaal_id: signaalId, model, prompt_versie: PROMPT_VERSIE,
        input_hash: hash, succes: false, fout: `HTTP ${aiResp.status}: ${text.slice(0, 500)}`,
        latentie_ms: Date.now() - start,
      });
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 502;
      const msg = aiResp.status === 429 ? 'AI rate-limit bereikt, probeer later opnieuw.'
                : aiResp.status === 402 ? 'AI-credits zijn op. Voeg credits toe in je workspace.'
                : 'AI-gateway fout.';
      return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      await admin.from('off_market_signalen').update({ ai_status: 'mislukt' }).eq('id', signaalId);
      await admin.from('off_market_ai_runs').insert({
        signaal_id: signaalId, model, prompt_versie: PROMPT_VERSIE,
        input_hash: hash, succes: false, fout: 'Geen tool-call in response',
        latentie_ms: Date.now() - start,
      });
      return new Response(JSON.stringify({ error: 'AI gaf geen gestructureerd antwoord.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiOutput = JSON.parse(toolCall.function.arguments);
    const update = mapOutput(aiOutput, model, PROMPT_VERSIE);

    await admin.from('off_market_signalen').update(update).eq('id', signaalId);
    await admin.from('off_market_ai_runs').insert({
      signaal_id: signaalId, model, prompt_versie: PROMPT_VERSIE,
      input_hash: hash, output: aiOutput, succes: true,
      latentie_ms: Date.now() - start,
    });

    return new Response(JSON.stringify({ ok: true, cached: false, update }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('enrich error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Onbekende fout' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
