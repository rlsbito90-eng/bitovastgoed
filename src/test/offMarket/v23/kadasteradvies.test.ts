// V2.3 — Kadasteradvies-helper.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

function base(p: Partial<SignaalBagInput> = {}): SignaalBagInput {
  return {
    id: 's1',
    ai_status: 'klaar',
    ai_score: 70,
    bag_status: 'verrijkt',
    bag_match_kwaliteit: 'exact',
    bag_aantal_vbo: 2,
    bag_aantal_panden: 1,
    bag_totaal_oppervlakte_m2: 200,
    ...p,
  };
}

describe('berekenKadasteradvies', () => {
  it('geeft null wanneer BAG nog niet verrijkt is', () => {
    const r = berekenKadasteradvies(base({ bag_status: 'niet_verrijkt' }));
    expect(r.niveau).toBeNull();
  });

  it('geeft null bij geen_match', () => {
    const r = berekenKadasteradvies(base({ bag_status: 'geen_match' }));
    expect(r.niveau).toBeNull();
    expect(r.reden.toLowerCase()).toContain('match');
  });

  it('voorzichtig bij 2×50 m² + kamerverhuur', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 65,
      bag_aantal_vbo: 2,
      bag_totaal_oppervlakte_m2: 100,
      potentiele_strategie: 'Kamerverhuur / verhuur- & exploitatieoptimalisatie',
    }));
    expect(r.niveau).toBe('voorzichtig');
  });

  it('aanbevolen bij ai_score 70 en 2 VBO\'s', () => {
    const r = berekenKadasteradvies(base({ ai_score: 70, bag_aantal_vbo: 2, bag_totaal_oppervlakte_m2: 250 }));
    expect(r.niveau).toBe('aanbevolen');
  });

  it('aanbevolen bij ai_score 70 + strategie-fit zonder meerdere VBO\'s', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 72, bag_aantal_vbo: 1, bag_totaal_oppervlakte_m2: 140,
      potentiele_strategie: 'Transformatie',
    }));
    expect(r.niveau).toBe('aanbevolen');
  });

  it('sterk_aanbevolen bij ai_score 85, 3 VBO\'s en 200 m²', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 85, bag_aantal_vbo: 3, bag_totaal_oppervlakte_m2: 200,
    }));
    expect(r.niveau).toBe('sterk_aanbevolen');
  });

  it('laag bij klein/enkelvoudig object zonder strategie-fit', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 60, bag_aantal_vbo: 1, bag_totaal_oppervlakte_m2: 80,
      potentiele_strategie: 'Verkoop aan belegger',
    }));
    expect(r.niveau).toBe('laag');
  });

  it('laag bij ai_score < 50 ongeacht BAG', () => {
    const r = berekenKadasteradvies(base({ ai_score: 40, bag_aantal_vbo: 3, bag_totaal_oppervlakte_m2: 500 }));
    expect(r.niveau).toBe('laag');
  });

  it('voorzichtig bij onzekere matchkwaliteit', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 85, bag_aantal_vbo: 3, bag_totaal_oppervlakte_m2: 400,
      bag_match_kwaliteit: 'onzeker',
    }));
    expect(r.niveau).toBe('voorzichtig');
  });

  it('voorzichtig bij meerdere_matches', () => {
    const r = berekenKadasteradvies(base({ bag_status: 'meerdere_matches', ai_score: 80 }));
    expect(r.niveau).toBe('voorzichtig');
  });
});
