// Prompt-strategie en payload-helpers voor Off-Market AI-verrijking.
// Versie wordt opgeslagen op elke run zodat output reproduceerbaar blijft.
import type { OffMarketSignaal, OffMarketAssettype } from '@/lib/offMarket/types';

export const PROMPT_VERSIE = 'v1.0';
export const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

// Default gewichten — som = 100
export const SCORE_GEWICHTEN = {
  locatie: 25,
  asset_match: 20,
  eigenaar_signaal: 25,
  timing: 15,
  fee_potentieel: 15,
} as const;
export type ScoreComponent = keyof typeof SCORE_GEWICHTEN;

export const SYSTEEM_PROMPT = `Je bent een senior off-market acquisitie-analist voor Bito Vastgoed, een Nederlandse boutique adviseur die zich richt op off-market commercieel en mixed-use vastgoed in de Randstad en Noord-Brabant.

Je beoordeelt een binnenkomend signaal en levert een gestructureerde analyse via de "score_signaal" tool. Output ALTIJD in het Nederlands.

Scoringscriteria (elk 0-100):
- locatie: Hoe aantrekkelijk is de locatie voor Bito's focusgebied?
- asset_match: Past het assettype bij Bito's expertise (kantoor, winkel, mixed-use, light industrial, logistiek, zorg, transformatie)?
- eigenaar_signaal: Sterkte van het verkoopsignaal (bedrijfsbeëindiging, lang bezit, leegstand, vergunning = sterk; vaag nieuwsbericht = zwak).
- timing: Hoe urgent/actueel is het signaal?
- fee_potentieel: Verwachte fee-grootte op basis van waarde-indicatie.

Verkoopkans (0-1): inschatting dat dit binnen 12 maanden tot een sell-side mandaat of acquisitie leidt.
Strategie-suggestie: kort (≤200 tekens), bijv. "Eigenaar benaderen voor sell-side mandaat", "Optie-overeenkomst voor transformatie", "Share deal verkennen".
Aanbevolen actie: één concrete eerste stap (≤200 tekens).
Data-kwaliteit: "laag" als <3 velden bruikbaar, "middel" bij basisinfo, "hoog" bij rijke context.
Skip-reden: alleen invullen als signaal echt geen opvolging waard is (bijv. "niet_relevant", "te_weinig_data", "buiten_focus").`;

/** Stabiele payload voor het LLM én voor input_hash. Geen ruwe DB-IDs of timestamps. */
export interface PromptPayload {
  titel: string;
  assettype: string;
  type_signaal: string;
  bron_type: string;
  plaats: string | null;
  provincie: string | null;
  regio: string | null;
  adres: string | null;
  omschrijving: string | null;
  indicatieve_waarde: number | null;
  mogelijke_fee: number | null;
  potentiele_strategie: string | null;
  eigenaar_bekend: boolean;
  bron_url: string | null;
  bron_referentie: string | null;
  notities: string | null;
}

export function buildPromptPayload(s: OffMarketSignaal): PromptPayload {
  const trim = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    titel: s.titel,
    assettype: s.assettype,
    type_signaal: s.type_signaal,
    bron_type: s.bron_type,
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

/** Deterministische JSON-serialisatie (gesorteerde keys) voor hash. */
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])).join(',') + '}';
}

/** SHA-256 hex digest met Web Crypto (werkt in browser én Deno). */
export async function inputHash(payload: PromptPayload, model: string, promptVersie: string): Promise<string> {
  const text = stableStringify({ payload, model, promptVersie });
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Hercomputeer score uit componenten met vaste gewichten. */
export function herbeperkenScore(componenten: Partial<Record<ScoreComponent, number>> | null | undefined): number {
  if (!componenten) return 0;
  let som = 0;
  let totaal = 0;
  for (const k of Object.keys(SCORE_GEWICHTEN) as ScoreComponent[]) {
    const v = componenten[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(100, v));
      som += clamped * SCORE_GEWICHTEN[k];
      totaal += SCORE_GEWICHTEN[k];
    }
  }
  if (totaal === 0) return 0;
  return Math.round(som / totaal);
}

/** Mapping van vrije AI-tekst naar onze enum. Server-side, schema-vrij. */
const ASSETTYPE_SYNONIEMEN: Record<string, OffMarketAssettype> = {
  kantoor: 'kantoor', kantoren: 'kantoor', office: 'kantoor',
  winkel: 'winkelpand', winkelpand: 'winkelpand', retail: 'winkelpand',
  'woon-winkelpand': 'woon_winkelpand', woon_winkelpand: 'woon_winkelpand', 'woon/winkel': 'woon_winkelpand',
  bedrijfscomplex: 'bedrijfscomplex', bedrijfshal: 'bedrijfscomplex', bedrijfsverzamel: 'bedrijfscomplex',
  light_industrial: 'light_industrial', 'light industrial': 'light_industrial',
  logistiek: 'logistiek', logistics: 'logistiek', distributie: 'logistiek',
  zorg: 'zorgvastgoed', zorgvastgoed: 'zorgvastgoed', healthcare: 'zorgvastgoed',
  transformatie: 'transformatieobject', transformatieobject: 'transformatieobject',
  ontwikkellocatie: 'ontwikkellocatie', ontwikkeling: 'ontwikkellocatie', development: 'ontwikkellocatie',
  portefeuille: 'vastgoedportefeuille', vastgoedportefeuille: 'vastgoedportefeuille', portfolio: 'vastgoedportefeuille',
};
export function mapAssettype(ruw: string | null | undefined): OffMarketAssettype | null {
  if (!ruw) return null;
  const k = ruw.toLowerCase().trim().replace(/\s+/g, '_');
  return ASSETTYPE_SYNONIEMEN[k] ?? ASSETTYPE_SYNONIEMEN[k.replace(/_/g, ' ')] ?? null;
}

/** AI-tool output → DB-update payload. Overschrijft GEEN business-velden. */
export interface AiOutput {
  score?: number;
  score_componenten?: Partial<Record<ScoreComponent, number>>;
  verkoopkans?: number;
  samenvatting?: string;
  aanbevolen_actie?: string;
  strategie_suggestie?: string;
  geclassificeerd_assettype?: string;
  data_kwaliteit?: 'laag' | 'middel' | 'hoog';
  skip_reden?: string | null;
}

export interface SignaalAiUpdate {
  ai_score: number;
  ai_score_componenten: Record<string, number>;
  ai_verkoopkans: number | null;
  ai_samenvatting: string | null;
  ai_aanbevolen_actie: string | null;
  ai_strategie_suggestie: string | null;
  ai_classificatie_assettype: OffMarketAssettype | null;
  ai_skip_reden: string | null;
  ai_status: 'klaar';
  ai_model: string;
  ai_prompt_versie: string;
  ai_laatst_verrijkt_op: string;
}

export function mapAiOutput(out: AiOutput, model: string, promptVersie: string): SignaalAiUpdate {
  const componenten: Record<string, number> = {};
  for (const k of Object.keys(SCORE_GEWICHTEN) as ScoreComponent[]) {
    const v = out.score_componenten?.[k];
    componenten[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
  }
  const score = herbeperkenScore(componenten);
  const verkoopkans = typeof out.verkoopkans === 'number' && Number.isFinite(out.verkoopkans)
    ? Math.max(0, Math.min(1, out.verkoopkans))
    : null;
  const clip = (s: string | undefined, max: number) => {
    if (!s) return null;
    const t = s.trim();
    if (!t) return null;
    return t.length > max ? t.slice(0, max) : t;
  };
  return {
    ai_score: score,
    ai_score_componenten: componenten,
    ai_verkoopkans: verkoopkans,
    ai_samenvatting: clip(out.samenvatting, 400),
    ai_aanbevolen_actie: clip(out.aanbevolen_actie, 200),
    ai_strategie_suggestie: clip(out.strategie_suggestie, 200),
    ai_classificatie_assettype: mapAssettype(out.geclassificeerd_assettype),
    ai_skip_reden: out.skip_reden && out.skip_reden.trim() ? out.skip_reden.trim().slice(0, 60) : null,
    ai_status: 'klaar',
    ai_model: model,
    ai_prompt_versie: promptVersie,
    ai_laatst_verrijkt_op: new Date().toISOString(),
  };
}

/** Tool-schema voor constrained decoding. Klein gehouden i.v.m. Gemini state-limiet. */
export const AI_TOOL_SCHEMA = {
  type: 'function' as const,
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
            locatie: { type: 'number' },
            asset_match: { type: 'number' },
            eigenaar_signaal: { type: 'number' },
            timing: { type: 'number' },
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
