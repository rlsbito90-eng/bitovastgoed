// V2.4 — Kleinschalige BAG-adrescontext (≤2 VBO + <150 m²) → maximaal voorzichtig.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';

describe('Kadasteradvies — kleine BAG-adrescontext begrenst tot voorzichtig', () => {
  it('AI 75 + 2 VBO + 103 m² + strategie onbekend → voorzichtig', () => {
    const r = berekenKadasteradvies({
      ai_status: 'klaar', ai_score: 75,
      bag_status: 'verrijkt', bag_match_kwaliteit: 'exact',
      bag_aantal_vbo: 2, bag_totaal_oppervlakte_m2: 103,
      bag_pandcontext_aantal_vbo: 2, bag_pandcontext_totaal_opp_m2: 103,
    });
    expect(r.niveau).toBe('voorzichtig');
    expect(r.reden.toLowerCase()).toMatch(/kleinschalig|circa\s*103|2 vbo/);
  });

  it('AI 88 + 1 VBO + 56 m² → voorzichtig, niet aanbevolen', () => {
    const r = berekenKadasteradvies({
      ai_status: 'klaar', ai_score: 88,
      bag_status: 'verrijkt', bag_match_kwaliteit: 'exact',
      bag_aantal_vbo: 1, bag_totaal_oppervlakte_m2: 56,
      bag_pandcontext_aantal_vbo: 1, bag_pandcontext_totaal_opp_m2: 56,
    });
    expect(r.niveau).toBe('voorzichtig');
  });
});
