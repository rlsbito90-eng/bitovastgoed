// V2.7 — Server-port van berekenKadasteradvies levert dezelfde uitkomsten als client-versie.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies as serverAdvies } from '../../../../supabase/functions/_shared/kadasteradvies';
import { berekenKadasteradvies as clientAdvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

function fix(p: Partial<SignaalBagInput> = {}): SignaalBagInput {
  return {
    id: 'sig-x',
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

const cases: Array<{ naam: string; input: SignaalBagInput }> = [
  { naam: 'BAG niet verrijkt', input: fix({ bag_status: 'niet_verrijkt' }) },
  { naam: 'geen_match', input: fix({ bag_status: 'geen_match' }) },
  { naam: 'fout', input: fix({ bag_status: 'fout' }) },
  { naam: 'meerdere_matches', input: fix({ bag_status: 'meerdere_matches' }) },
  { naam: 'score < 50', input: fix({ ai_score: 40 }) },
  { naam: 'aanbevolen 70 + 2 VBO + 250 m²', input: fix({ ai_score: 70, bag_totaal_oppervlakte_m2: 250 }) },
  { naam: 'sterk_aanbevolen 85 + 3 VBO', input: fix({ ai_score: 85, bag_aantal_vbo: 3, bag_totaal_oppervlakte_m2: 200 }) },
  { naam: 'onzekere match', input: fix({ ai_score: 85, bag_match_kwaliteit: 'onzeker' }) },
  {
    naam: 'kleine context + kamerverhuur → voorzichtig',
    input: fix({
      ai_score: 70, bag_aantal_vbo: 2, bag_totaal_oppervlakte_m2: 103,
      bag_pandcontext_aantal_vbo: 2, bag_pandcontext_totaal_opp_m2: 103,
      potentiele_strategie: 'Kamerverhuur en exploitatieoptimalisatie',
    }),
  },
  {
    naam: 'klein doelobject + grote pandcontext + 75 → aanbevolen',
    input: fix({
      ai_score: 75,
      bag_geselecteerd_opp_m2: 45,
      bag_pandcontext_aantal_vbo: 4,
      bag_pandcontext_totaal_opp_m2: 320,
    }),
  },
  {
    naam: 'enkelvoudig klein zonder strategie → laag',
    input: fix({
      ai_score: 60, bag_aantal_vbo: 1, bag_totaal_oppervlakte_m2: 80,
      potentiele_strategie: 'Verkoop aan belegger',
    }),
  },
];

describe('Kadasteradvies — server-port pariteit met client', () => {
  for (const c of cases) {
    it(c.naam, () => {
      const a = clientAdvies(c.input);
      const b = serverAdvies(c.input as Record<string, unknown>);
      expect(b.niveau).toBe(a.niveau);
      expect(b.reden).toBe(a.reden);
    });
  }
});
