// V2.4 — KadasterPreCheckBanner toont aantal VBO's, totaal m², gebruiksdoelen, bouwjaar en pandstatus.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import KadasterPreCheckBanner from '@/components/offmarket/bag/KadasterPreCheckBanner';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const signaal = {
  id: 'sig-test',
  bag_status: 'verrijkt',
  bag_match_kwaliteit: 'exact',
  bag_aantal_vbo: 2,
  bag_totaal_oppervlakte_m2: 103,
  bag_pandcontext_aantal_vbo: 2,
  bag_pandcontext_totaal_opp_m2: 103,
  bag_gebruiksdoelen: ['woonfunctie'],
  bag_bouwjaar: 1881,
  bag_pand_status: 'Pand in gebruik',
  bag_geselecteerd_adres: 'Teststraat 10-2, 1000AA Teststad',
  bag_geselecteerd_opp_m2: 47,
  ai_status: 'klaar',
  ai_score: 70,
} as unknown as OffMarketSignaal;

describe('KadasterPreCheckBanner — toont BAG-detailinformatie', () => {
  it('toont VBO-aantal, totaal m², gebruik, bouwjaar, pandstatus en doelobject', () => {
    const { getByTestId } = render(<KadasterPreCheckBanner signaal={signaal} />);
    expect(getByTestId('precheck-bag-cijfers').textContent).toMatch(/2 VBO/);
    expect(getByTestId('precheck-bag-cijfers').textContent).toMatch(/103 m²/);
    expect(getByTestId('precheck-bag-cijfers').textContent?.toLowerCase()).toMatch(/woonfunctie/);
    const pand = getByTestId('precheck-bag-pand').textContent ?? '';
    expect(pand).toMatch(/1881/);
    expect(pand).toMatch(/Pand in gebruik/);
    const doel = getByTestId('precheck-doelobject').textContent ?? '';
    expect(doel).toMatch(/Teststraat 10-2/);
    expect(doel).toMatch(/47 m²/);
  });
});
