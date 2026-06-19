// V2.4 — Kamerverhuur / verhuur- & exploitatieoptimalisatie: klein doelobject
// blijft minimaal voorzichtig, ook bij lagere AI-score. Govert-Flinck-achtige case.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';

describe('Kadasteradvies — kamerverhuur klein doelobject', () => {
  it('Govert-Flinck-achtige fixture geeft voorzichtig', () => {
    const r = berekenKadasteradvies({
      ai_status: 'klaar', ai_score: 65,
      bag_status: 'verrijkt', bag_match_kwaliteit: 'exact',
      bag_aantal_vbo: 2,
      bag_totaal_oppervlakte_m2: 103,
      bag_pandcontext_aantal_vbo: 2,
      bag_pandcontext_totaal_opp_m2: 103,
      bag_geselecteerd_opp_m2: 56,
      potentiele_strategie: 'Kamerverhuur / verhuur- & exploitatieoptimalisatie',
    });
    expect(r.niveau).toBe('voorzichtig');
    expect(r.reden.toLowerCase()).toMatch(/kamerverhuur|exploitatie/);
  });

  it('lage AI-score + klein doelobject + kamerverhuur → niet laag', () => {
    const r = berekenKadasteradvies({
      ai_status: 'klaar', ai_score: 35,
      bag_status: 'verrijkt', bag_match_kwaliteit: 'exact',
      bag_pandcontext_aantal_vbo: 2,
      bag_pandcontext_totaal_opp_m2: 103,
      bag_geselecteerd_opp_m2: 56,
      potentiele_strategie: 'verhuur- & exploitatieoptimalisatie',
    });
    expect(r.niveau).not.toBe('laag');
    expect(r.niveau).toBe('voorzichtig');
  });
});
