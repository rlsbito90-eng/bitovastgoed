// V2.4 — BagOverzichtKaart toont doelobjectdetails (gebruik, oppervlakte, IDs, bouwjaar, pandstatus).
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/hooks/useBagVerrijken', () => ({
  useBagVerrijken: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useEnrichSignaal', () => ({
  useEnrichSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const signaal = {
  id: 'sig-test',
  bag_status: 'verrijkt',
  bag_match_kwaliteit: 'exact',
  bag_aantal_vbo: 2,
  bag_totaal_oppervlakte_m2: 103,
  bag_pandcontext_aantal_vbo: 2,
  bag_pandcontext_totaal_opp_m2: 103,
  bag_pandcontext_bron: 'huisnummer',
  bag_gebruiksdoelen: ['woonfunctie'],
  bag_bouwjaar: 1881,
  bag_pand_status: 'Pand in gebruik',
  bag_geselecteerd_adres: 'Teststraat 10-2, 1000AA Teststad',
  bag_geselecteerd_opp_m2: 47,
  bag_geselecteerd_gebruiksdoel: ['woonfunctie'],
  bag_geselecteerd_vbo_id: 'VBO_FAKE_DOEL',
  bag_vbos: [
    {
      nummeraanduiding_id: 'NA1', vbo_id: 'VBO_FAKE_DOEL',
      adres: 'Teststraat 10-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'],
      status: 'Verblijfsobject in gebruik',
      pandid: 'PAND_FAKE_001', pand_bouwjaar: 1881, pand_status: 'Pand in gebruik',
      is_doelobject: true, match_badge: 'MATCH · Doelobject',
    },
    {
      nummeraanduiding_id: 'NA2', vbo_id: 'VBO_FAKE_OTHER',
      adres: 'Teststraat 10-1', opp_m2: 56, gebruiksdoel: ['woonfunctie'],
      status: 'Verblijfsobject in gebruik',
      pandid: 'PAND_FAKE_001', pand_bouwjaar: 1881, pand_status: 'Pand in gebruik',
      is_doelobject: false, match_badge: 'Zelfde huisnummercontext',
    },
  ],
  ai_status: 'klaar', ai_score: 70,
} as unknown as OffMarketSignaal;

describe('BagOverzichtKaart — doelobjectsectie met BAG-details', () => {
  it('toont gebruik, oppervlakte, VBO/Pand-ID, bouwjaar, pandstatus', () => {
    const qc = new QueryClient();
    const { getByTestId } = render(
      <QueryClientProvider client={qc}>
        <BagOverzichtKaart signaal={signaal} />
      </QueryClientProvider>,
    );
    expect(getByTestId('bag-doelobject-gebruik').textContent?.toLowerCase()).toMatch(/woonfunctie/);
    expect(getByTestId('bag-doelobject-opp').textContent).toMatch(/47 m²/);
    expect(getByTestId('bag-doelobject-vboid').getAttribute('title')).toBe('VBO_FAKE_DOEL');
    expect(getByTestId('bag-doelobject-pandid').getAttribute('title')).toBe('PAND_FAKE_001');
    expect(getByTestId('bag-doelobject-bouwjaar').textContent).toMatch(/1881/);
    expect(getByTestId('bag-doelobject-pandstatus').textContent).toMatch(/Pand in gebruik/);
  });
});
