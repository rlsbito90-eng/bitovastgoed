// V2.4 — Kadasteradvies met doelobject + BAG-pandcontext.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

function base(p: Partial<SignaalBagInput> = {}): SignaalBagInput {
  return {
    id: 's',
    ai_status: 'klaar',
    ai_score: 70,
    bag_status: 'verrijkt',
    bag_match_kwaliteit: 'exact',
    bag_aantal_vbo: 2,
    bag_aantal_panden: 1,
    bag_totaal_oppervlakte_m2: 103,
    bag_pandcontext_aantal_vbo: 2,
    bag_pandcontext_totaal_opp_m2: 103,
    ...p,
  };
}

describe('berekenKadasteradvies — Doelobject + BAG-pandcontext', () => {
  it('klein doelobject + kleine pandcontext → voorzichtig', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 60,
      bag_geselecteerd_opp_m2: 56,
      bag_pandcontext_aantal_vbo: 2,
      bag_pandcontext_totaal_opp_m2: 103,
    }));
    expect(r.niveau).toBe('voorzichtig');
  });

  it('klein doelobject + grote pandcontext + AI ≥ 70 → aanbevolen', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 75,
      bag_geselecteerd_opp_m2: 50,
      bag_pandcontext_aantal_vbo: 4,
      bag_pandcontext_totaal_opp_m2: 240,
    }));
    expect(r.niveau).toBe('aanbevolen');
  });

  it('groot doelobject ≥150 m² + AI 70 → aanbevolen', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 72,
      bag_geselecteerd_opp_m2: 180,
      bag_pandcontext_aantal_vbo: 1,
      bag_pandcontext_totaal_opp_m2: 180,
    }));
    expect(r.niveau).toBe('aanbevolen');
  });

  it('groot doelobject + AI 85 → sterk_aanbevolen', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 85,
      bag_geselecteerd_opp_m2: 200,
      bag_pandcontext_aantal_vbo: 1,
      bag_pandcontext_totaal_opp_m2: 200,
    }));
    expect(r.niveau).toBe('sterk_aanbevolen');
  });

  it('strategie splitsing + ≥2 VBO → aanbevolen', () => {
    const r = berekenKadasteradvies(base({
      ai_score: 60,
      potentiele_strategie: 'Splitsingspotentie',
      bag_pandcontext_aantal_vbo: 3,
      bag_pandcontext_totaal_opp_m2: 220,
    }));
    expect(r.niveau).toBe('aanbevolen');
  });
});
