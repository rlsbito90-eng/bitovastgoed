// Off-Market Radar AI-verrijking V2.
// Provider-onafhankelijk, budget-guarded en fail-closed.
// Geen automatische BAG- of Kadaster-cascade vanuit deze functie.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  AiProviderError,
  estimateCostUsd,
  invokeAiProvider,
  normaliseModel,
  resolveDefaultModel,
  type AiProvider,
} from '../_shared/offMarketAiProvider.ts';
import { AiBudgetError, requireAiBudget } from '../_shared/offMarketAiBudget.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT_VERSIE = 'v2.2-cost-guard';
const SCORE_GEWICHTEN = { locatie: 25, asset_match: 20, eigenaar_signaal: 25, timing: 15, fee_potentieel: 15 } as const;
type ScoreComponent = keyof typeof SCORE_GEWICHTEN;
const ASSETTYPES = [
  'kantoor','winkelpand','woon_winkelpand','bedrijfscomplex','light_industrial','logistiek','zorgvastgoed',
  'transformatieobject','ontwikkellocatie','vastgoedportefeuille','overig','wonen','appartementencomplex','woonhuis',
  'studentenhuisvesting','gemengd_vastgoed',
] as const;
type Assettype = typeof ASSETTYPES[number];
const ASSETTYPE_SET = new Set<string>(ASSETTYPES);

const SYSTEEM_PROMPT = `Je bent een senior off-market acquisitie-analist voor Bito Vastgoed, een Nederlandse boutique vastgoedadviseur.
Je beoordeelt één off-market signaal en levert uitsluitend de gestructureerde tool-output score_signaal.
Output is altijd in het Nederlands.

Scoringscriteria 0-100:
- locatie: aantrekkelijkheid binnen Bito's focusregio;
- asset_match: aansluiting op commercieel, mixed-use, residentieel, transformatie, light industrial, logistiek en zorgvastgoed;
- eigenaar_signaal: sterkte van het mogelijke verkoop-/herpositioneringssignaal;
- timing: actualiteit en urgentie;
- fee_potentieel: commercieel potentieel.

Verkoopkans is 0-1. Gebruik voor geclassificeerd_assettype uitsluitend één waarde uit het opgegeven enum.
Aanbevolen actie en strategie_suggestie zijn concreet en maximaal 200 tekens.
Samenvatting maximaal 400 tekens. Skip_reden alleen invullen wanneer opvolging werkelijk niet zinvol is.`;

const TOOL = {
  name: 'score_signaal',
  description: 'Gestructureerde beoordeling van een off-market vastgoedsignaal.',
  parameters: {
    type: 'object',
    properties: {
      score_componenten: {
        type: 'object',
        properties: {
          locatie: { type: 'number' }, asset_match: { type: 'number' }, eigenaar_signaal: { type: 'number' },
          timing: { type: 'number' }, fee_potentieel: { type: 'number' },
        },
        required: ['locatie','asset_match','eigenaar_signaal','timing','fee_potentieel'],
        additionalProperties: false,
      },
      verkoopkans: { type: 'number' },
      samenvatting: { type: 'string' },
      aanbevolen_actie: { type: 'string' },
      strategie_suggestie: { type: 'string' },
      geclassificeerd_assettype: { type: 'string', enum: [...ASSETTYPES] },
      data_kwaliteit: { type: 'string', enum: ['laag','middel','hoog'] },
      skip_reden: { type: 'string' },
    },
    required: ['score_componenten','verkoopkans','samenvatting','aanbevolen_actie','strategie_suggestie','geclassificeerd_assettype','data_kwaliteit','skip_reden'],
    additionalProperties: false,
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])).join(',') + '}';
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}
function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Onbekende fout';
  return raw.replace(/sk-(?:proj-)?[A-Za-z0-9_\-]{12,}/g, '[REDACTED]').replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]').slice(0, 1000);
}
function clampScore(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}
function weightedScore(raw: Record<string, unknown>) {
  const componenten: Record<string, number> = {};
  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(SCORE_GEWICHTEN) as ScoreComponent[]) {
    const score = clampScore(raw[key]);
    componenten[key] = score;
    weighted += score * SCORE_GEWICHTEN[key];
    totalWeight += SCORE_GEWICHTEN[key];
  }
  return { total: totalWeight ? Math.round(weighted / totalWeight) : 0, componenten };
}
function normaliseAssettype(value: unknown): Assettype {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (ASSETTYPE_SET.has(raw)) return raw as Assettype;
  if (raw.includes('appartement') || raw.includes('splits') || raw.includes('uitpond')) return 'appartementencomplex';
  if (raw.includes('resident') || raw.includes('woon')) return 'wonen';
  if (raw.includes('mixed') || raw.includes('gemengd')) return 'gemengd_vastgoed';
  if (raw.includes('transform')) return 'transformatieobject';
  return 'overig';
}
function buildPayload(s: Record<string, unknown>) {
  const clean = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
  return {
    titel: clean(s.titel), type_signaal: clean(s.type_signaal), assettype: clean(s.assettype), bron_type: clean(s.bron_type),
    bron_datum: s.bron_datum ?? null, plaats: clean(s.plaats), provincie: clean(s.provincie), regio: clean(s.regio), adres: clean(s.adres),
    postcode: clean(s.postcode), omschrijving: clean(s.omschrijving), potentiele_strategie: clean(s.potentiele_strategie),
    indicatieve_waarde: s.indicatieve_waarde ?? null, mogelijke_fee: s.mogelijke_fee ?? null, eigenaar_bekend: s.eigenaar_bekend === true,
    geo_gemeente_naam: clean(s.geo_gemeente_naam), geo_wijk_naam: clean(s.geo_wijk_naam), geo_buurt_naam: clean(s.geo_buurt_naam),
  };
}
function mapUpdate(output: Record<string, unknown>, provider: AiProvider, model: string) {
  const score = weightedScore((output.score_componenten ?? {}) as Record<string, unknown>);
  const vk = Number(output.verkoopkans);
  return {
    ai_score: score.total,
    ai_score_componenten: score.componenten,
    ai_verkoopkans: Number.isFinite(vk) ? Math.max(0, Math.min(1, vk)) : null,
    ai_samenvatting: clip(output.samenvatting, 400),
    ai_aanbevolen_actie: clip(output.aanbevolen_actie, 200),
    ai_strategie_suggestie: clip(output.strategie_suggestie, 200),
    ai_classificatie_assettype: normaliseAssettype(output.geclassificeerd_assettype),
    ai_skip_reden: clip(output.skip_reden, 120),
    ai_status: 'klaar',
    ai_model: `${provider}:${model}`,
    ai_prompt_versie: PROMPT_VERSIE,
    ai_laatst_verrijkt_op: new Date().toISOString(),
  };
}
async function cronAuthorized(admin: ReturnType<typeof createClient>, provided: string | null): Promise<boolean> {
  if (!provided) return false;
  const envSecret = Deno.env.get('OFF_MARKET_CRON_SECRET')?.trim();
  if (envSecret && envSecret === provided) return true;
  const { data } = await admin.from('off_market_runtime_secrets').select('value').eq('key', 'cron_secret').maybeSingle();
  return typeof data?.value === 'string' && data.value === provided;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const started = Date.now();
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let signaalId: string | null = null;
  let provider: AiProvider | null = null;
  let model: string | null = null;
  let inputHash: string | null = null;
  let providerAttemptStarted = false;

  try {
    const providedCron = req.headers.get('x-cron-secret');
    const isCron = await cronAuthorized(admin, providedCron);
    if (!isCron) {
      const auth = req.headers.get('Authorization') ?? '';
      if (!auth.toLowerCase().startsWith('bearer ')) return json({ error: 'Niet geautoriseerd' }, 401);
      const token = auth.replace(/^Bearer\s+/i, '');
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Niet geautoriseerd' }, 401);
      const { data: isIntern } = await admin.rpc('is_intern_gebruiker', { _user_id: claimsData.claims.sub as string });
      if (!isIntern) return json({ error: 'Geen toegang' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    signaalId = typeof body.signaal_id === 'string' ? body.signaal_id : null;
    const force = body.force === true;
    if (!signaalId) return json({ error: 'signaal_id verplicht' }, 400);

    const budget = await requireAiBudget(admin as any);
    provider = budget.provider;
    model = normaliseModel(provider, typeof body.model === 'string' && body.model.trim() ? body.model : budget.default_model ?? resolveDefaultModel(provider));
    const pricingModel = budget.pricing_model ? normaliseModel(provider, budget.pricing_model) : null;
    if (!pricingModel || pricingModel !== model) {
      throw new AiBudgetError('pricing_missing', `Geen geldige prijsconfiguratie voor ${provider}:${model}`);
    }

    const { data: signaal, error: signaalError } = await admin.from('off_market_signalen').select('*').eq('id', signaalId).maybeSingle();
    if (signaalError || !signaal) return json({ error: 'Signaal niet gevonden' }, 404);
    const payload = buildPayload(signaal as Record<string, unknown>);
    inputHash = await sha256Hex(stableStringify({ provider, model, prompt: PROMPT_VERSIE, payload }));

    if (!force) {
      const { data: cached } = await admin.from('off_market_ai_runs').select('output').eq('input_hash', inputHash).eq('succes', true).order('run_op', { ascending: false }).limit(1).maybeSingle();
      if (cached?.output) {
        const update = mapUpdate(cached.output as Record<string, unknown>, provider, model);
        const { error: updateError } = await admin.from('off_market_signalen').update(update).eq('id', signaalId);
        if (updateError) throw new Error(`AI-signaalupdate mislukt: ${updateError.message}`);
        const { error: auditError } = await admin.from('off_market_ai_runs').insert({ signaal_id: signaalId, provider, model, prompt_versie: PROMPT_VERSIE, input_hash: inputHash, output: cached.output, kosten: 0, input_tokens: 0, output_tokens: 0, latentie_ms: Date.now() - started, succes: true });
        if (auditError) throw new Error(`AI-audit mislukt: ${auditError.message}`);
        return json({ ok: true, cached: true, provider, model, update });
      }
    }

    const { error: busyError } = await admin.from('off_market_signalen').update({ ai_status: 'bezig' }).eq('id', signaalId);
    if (busyError) throw new Error(`AI-status kon niet op bezig worden gezet: ${busyError.message}`);
    providerAttemptStarted = true;

    const result = await invokeAiProvider({
      provider, model, systemPrompt: SYSTEEM_PROMPT,
      userMessage: 'Beoordeel dit signaal:\n\n' + JSON.stringify(payload, null, 2),
      tool: TOOL, maxOutputTokens: 1200,
    });
    const cost = estimateCostUsd(result.usage, budget.input_usd_per_million, budget.output_usd_per_million);
    if (cost == null) throw new Error('AI-kosten konden niet betrouwbaar worden berekend');
    const update = mapUpdate(result.output, provider, result.model);
    const { error: updateError } = await admin.from('off_market_signalen').update(update).eq('id', signaalId);
    if (updateError) throw new Error(`AI-signaalupdate mislukt: ${updateError.message}`);
    const { error: auditError } = await admin.from('off_market_ai_runs').insert({
      signaal_id: signaalId, provider, model: result.model, prompt_versie: PROMPT_VERSIE, input_hash: inputHash,
      output: result.output, kosten: cost, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens,
      provider_request_id: result.requestId, latentie_ms: Date.now() - started, succes: true,
    });
    if (auditError) throw new Error(`AI-audit mislukt: ${auditError.message}`);
    return json({ ok: true, cached: false, provider, model: result.model, cost_usd: cost, update });
  } catch (error) {
    const message = safeErrorMessage(error);
    const status = error instanceof AiBudgetError ? 402 : error instanceof AiProviderError ? (error.status === 429 ? 429 : 502) : 500;
    if (providerAttemptStarted && signaalId) {
      await admin.from('off_market_signalen').update({ ai_status: 'niet_verrijkt' }).eq('id', signaalId);
      await admin.from('off_market_ai_runs').insert({
        signaal_id: signaalId, provider, model, prompt_versie: PROMPT_VERSIE, input_hash: inputHash,
        output: null, kosten: null, input_tokens: null, output_tokens: null, latentie_ms: Date.now() - started,
        succes: false, fout: message,
      });
    }
    return json({ error: message, blocked: error instanceof AiBudgetError }, status);
  }
});
