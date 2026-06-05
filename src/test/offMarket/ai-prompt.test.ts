import { describe, it, expect } from 'vitest';
import {
  buildPromptPayload, stableStringify, inputHash, herbeperkenScore,
  mapAssettype, mapAiOutput, PROMPT_VERSIE, DEFAULT_MODEL, SCORE_GEWICHTEN,
} from '@/lib/offMarket/ai/prompt';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

function maakSignaal(over: Partial<OffMarketSignaal> = {}): OffMarketSignaal {
  return {
    id: 'sig-1',
    titel: 'Kantoorpand Amsterdam Zuid',
    adres: 'Strawinskylaan 1',
    postcode: '1077 XX',
    plaats: 'Amsterdam',
    provincie: 'Noord-Holland',
    regio: 'Randstad',
    lat: null, lng: null,
    assettype: 'kantoor',
    bron_id: null,
    bron_type: 'handmatig',
    type_signaal: 'leegstand',
    omschrijving: '  Lange leegstand op zichtlocatie  ',
    eigenaar_bekend: true,
    eigenaar_relatie_id: null,
    potentiele_strategie: null,
    indicatieve_waarde: 5_000_000,
    mogelijke_fee: 75_000,
    prioriteit: 'midden',
    status: 'nieuw_signaal',
    volgende_actie_datum: null,
    volgende_actie_omschrijving: null,
    notities: null,
    bron_url: null,
    bron_referentie: null,
    bron_datum: null,
    gekoppeld_object_id: null,
    gekoppelde_deal_id: null,
    gearchiveerd_op: null,
    archief_reden: null,
    ai_score: null, ai_samenvatting: null, ai_aanbevolen_actie: null,
    ai_classificatie_assettype: null, ai_strategie_suggestie: null,
    ai_verkoopkans: null, ai_dedupe_groep_id: null,
    ai_laatst_verrijkt_op: null, ai_model: null, ai_prompt_versie: null,
    created_by: null, updated_by: null,
    created_at: '2026-06-05T00:00:00Z', updated_at: '2026-06-05T00:00:00Z',
    search_tsv: null,
    ...over,
  } as unknown as OffMarketSignaal;
}

describe('buildPromptPayload', () => {
  it('trimt strings en zet lege waarden op null', () => {
    const p = buildPromptPayload(maakSignaal({ omschrijving: '   ' }));
    expect(p.omschrijving).toBeNull();
    expect(p.plaats).toBe('Amsterdam');
  });
  it('trimt spaties in omschrijving', () => {
    const p = buildPromptPayload(maakSignaal());
    expect(p.omschrijving).toBe('Lange leegstand op zichtlocatie');
  });
  it('converteert numerieke velden naar Number', () => {
    const p = buildPromptPayload(maakSignaal({ indicatieve_waarde: '5000000' as any }));
    expect(p.indicatieve_waarde).toBe(5_000_000);
    expect(typeof p.indicatieve_waarde).toBe('number');
  });
});

describe('stableStringify', () => {
  it('sorteert object-keys', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it('werkt diep en met arrays', () => {
    const out = stableStringify({ z: [3, 1], a: { y: 1, x: 2 } });
    expect(out).toBe('{"a":{"x":2,"y":1},"z":[3,1]}');
  });
});

describe('inputHash cache-sleutel', () => {
  it('zelfde payload → zelfde hash', async () => {
    const p1 = buildPromptPayload(maakSignaal());
    const p2 = buildPromptPayload(maakSignaal());
    const h1 = await inputHash(p1, DEFAULT_MODEL, PROMPT_VERSIE);
    const h2 = await inputHash(p2, DEFAULT_MODEL, PROMPT_VERSIE);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
  it('andere prompt-versie → andere hash', async () => {
    const p = buildPromptPayload(maakSignaal());
    const h1 = await inputHash(p, DEFAULT_MODEL, 'v1.0');
    const h2 = await inputHash(p, DEFAULT_MODEL, 'v2.0');
    expect(h1).not.toBe(h2);
  });
  it('andere veldwaarde → andere hash', async () => {
    const a = buildPromptPayload(maakSignaal({ plaats: 'Amsterdam' }));
    const b = buildPromptPayload(maakSignaal({ plaats: 'Rotterdam' }));
    const ha = await inputHash(a, DEFAULT_MODEL, PROMPT_VERSIE);
    const hb = await inputHash(b, DEFAULT_MODEL, PROMPT_VERSIE);
    expect(ha).not.toBe(hb);
  });
});

describe('herbeperkenScore', () => {
  it('berekent gewogen gemiddelde van componenten', () => {
    const score = herbeperkenScore({
      locatie: 80, asset_match: 60, eigenaar_signaal: 70, timing: 50, fee_potentieel: 40,
    });
    const verwacht = Math.round((80*25 + 60*20 + 70*25 + 50*15 + 40*15) / 100);
    expect(score).toBe(verwacht);
  });
  it('clamps tussen 0-100', () => {
    const score = herbeperkenScore({
      locatie: 150, asset_match: -20, eigenaar_signaal: 50, timing: 50, fee_potentieel: 50,
    } as any);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
  it('lege componenten → 0', () => {
    expect(herbeperkenScore(null)).toBe(0);
    expect(herbeperkenScore({})).toBe(0);
  });
  it('gewichten sommeren tot 100', () => {
    const totaal = Object.values(SCORE_GEWICHTEN).reduce((a, b) => a + b, 0);
    expect(totaal).toBe(100);
  });
});

describe('mapAssettype', () => {
  it('mapt veelvoorkomende synoniemen', () => {
    expect(mapAssettype('Kantoor')).toBe('kantoor');
    expect(mapAssettype('office')).toBe('kantoor');
    expect(mapAssettype('light industrial')).toBe('light_industrial');
    expect(mapAssettype('Distributie')).toBe('logistiek');
    expect(mapAssettype('Retail')).toBe('winkelpand');
  });
  it('geeft null voor onbekend of leeg', () => {
    expect(mapAssettype(null)).toBeNull();
    expect(mapAssettype('')).toBeNull();
    expect(mapAssettype('boerderij')).toBeNull();
  });
});

describe('mapAiOutput', () => {
  it('zet AI-output volledig om naar update-payload zonder business-velden te raken', () => {
    const out = mapAiOutput({
      score_componenten: { locatie: 80, asset_match: 70, eigenaar_signaal: 90, timing: 60, fee_potentieel: 50 },
      verkoopkans: 0.65,
      samenvatting: '  Sterk signaal in Amsterdam Zuid.  ',
      aanbevolen_actie: 'Eigenaar bellen deze week.',
      strategie_suggestie: 'Sell-side mandaat aanbieden',
      geclassificeerd_assettype: 'Kantoor',
    } as any, 'google/gemini-3-flash-preview', 'v1.0');

    expect(out.ai_score).toBeGreaterThan(0);
    expect(out.ai_verkoopkans).toBe(0.65);
    expect(out.ai_samenvatting).toBe('Sterk signaal in Amsterdam Zuid.');
    expect(out.ai_classificatie_assettype).toBe('kantoor');
    expect(out.ai_status).toBe('klaar');
    expect(out.ai_model).toBe('google/gemini-3-flash-preview');
    expect(out.ai_prompt_versie).toBe('v1.0');
    expect(out.ai_laatst_verrijkt_op).toBeTypeOf('string');
    expect('mogelijke_fee' in out).toBe(false);
    expect('indicatieve_waarde' in out).toBe(false);
    expect('prioriteit' in out).toBe(false);
    expect('status' in out).toBe(false);
  });

  it('clamps verkoopkans op 0..1', () => {
    const out = mapAiOutput({ score_componenten: {}, verkoopkans: 5 } as any, 'm', 'v');
    expect(out.ai_verkoopkans).toBe(1);
    const out2 = mapAiOutput({ score_componenten: {}, verkoopkans: -2 } as any, 'm', 'v');
    expect(out2.ai_verkoopkans).toBe(0);
  });

  it('kapt lange teksten af', () => {
    const lang = 'x'.repeat(1000);
    const out = mapAiOutput({
      score_componenten: {}, verkoopkans: 0.5,
      samenvatting: lang, aanbevolen_actie: lang, strategie_suggestie: lang,
    } as any, 'm', 'v');
    expect(out.ai_samenvatting!.length).toBe(400);
    expect(out.ai_aanbevolen_actie!.length).toBe(200);
    expect(out.ai_strategie_suggestie!.length).toBe(200);
  });

  it('lege tekstvelden worden null', () => {
    const out = mapAiOutput({
      score_componenten: {}, verkoopkans: 0.5,
      samenvatting: '   ', aanbevolen_actie: '', strategie_suggestie: undefined,
    } as any, 'm', 'v');
    expect(out.ai_samenvatting).toBeNull();
    expect(out.ai_aanbevolen_actie).toBeNull();
    expect(out.ai_strategie_suggestie).toBeNull();
  });
});
