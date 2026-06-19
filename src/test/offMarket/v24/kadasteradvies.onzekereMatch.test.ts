// V2.4 — Onzekere/meerdere match → maximaal voorzichtig.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';

describe('Kadasteradvies — onzekere match', () => {
  it('bag_status=meerdere_matches → voorzichtig zelfs bij hoge AI-score', () => {
    const r = berekenKadasteradvies({
      ai_status: 'klaar', ai_score: 90,
      bag_status: 'meerdere_matches', bag_match_kwaliteit: 'onzeker',
      bag_aantal_vbo: 4, bag_totaal_oppervlakte_m2: 400,
    });
    expect(r.niveau).toBe('voorzichtig');
    expect(r.reden.toLowerCase()).toMatch(/onzeker|meerdere|kies/);
  });

  it('matchkwaliteit=onzeker bij verrijkt → voorzichtig', () => {
    const r = berekenKadasteradvies({
      ai_status: 'klaar', ai_score: 88,
      bag_status: 'verrijkt', bag_match_kwaliteit: 'onzeker',
      bag_aantal_vbo: 3, bag_totaal_oppervlakte_m2: 250,
    });
    expect(r.niveau).toBe('voorzichtig');
  });
});
