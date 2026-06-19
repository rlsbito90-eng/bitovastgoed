// V2.4 — BAG-oordeel mag zonder Kadasterdata geen juridische termen gebruiken.
import { describe, it, expect } from 'vitest';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

const FORBIDDEN = [
  'appartementsrechten',
  'appartementsrecht',
  'juridische splitsing',
  'eigendom',
  'eigenaar',
];

function check(reden: string) {
  const low = reden.toLowerCase();
  for (const term of FORBIDDEN) {
    expect(low, `reden bevat verboden term "${term}": ${reden}`).not.toContain(term);
  }
}

describe('BAG-terminologie — geen juridische conclusies', () => {
  const scenarios: SignaalBagInput[] = [
    { bag_status: 'verrijkt', bag_match_kwaliteit: 'exact', ai_score: 80, bag_pandcontext_aantal_vbo: 3, bag_pandcontext_totaal_opp_m2: 250 },
    { bag_status: 'meerdere_matches', bag_match_kwaliteit: 'onzeker', ai_score: 80 },
    { bag_status: 'verrijkt', bag_match_kwaliteit: 'exact', ai_score: 65, bag_geselecteerd_opp_m2: 56, bag_pandcontext_aantal_vbo: 2, bag_pandcontext_totaal_opp_m2: 103, potentiele_strategie: 'kamerverhuur' },
    { bag_status: 'verrijkt', bag_match_kwaliteit: 'exact', ai_score: 60, potentiele_strategie: 'Splitsingspotentie', bag_pandcontext_aantal_vbo: 3 },
    { bag_status: 'geen_match' },
    { bag_status: 'fout' },
  ];
  scenarios.forEach((sc, i) => {
    it(`scenario ${i + 1} — reden gebruikt geen juridische BAG-conclusies`, () => {
      const r = berekenKadasteradvies(sc);
      check(r.reden);
    });
  });
});
