// V2.4 fix — doelobjectsectie toont VBO/Pand-ID volledig.
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
  id: 'sig-ids',
  bag_status: 'verrijkt',
  bag_match_kwaliteit: 'exact',
  bag_aantal_vbo: 1,
  bag_geselecteerd_adres: 'Teststraat 10-2, 1000AA Teststad',
  bag_geselecteerd_opp_m2: 47,
  bag_geselecteerd_gebruiksdoel: ['woonfunctie'],
  bag_geselecteerd_vbo_id: '0363010000649405',
  bag_vbos: [
    {
      nummeraanduiding_id: 'NA1', vbo_id: '0363010000649405',
      adres: 'Teststraat 10-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'],
      status: 'Verblijfsobject in gebruik',
      pandid: '0363100012162738', pand_bouwjaar: 1881, pand_status: 'Pand in gebruik',
      is_doelobject: true,
    },
  ],
} as unknown as OffMarketSignaal;

describe('BagOverzichtKaart — doelobject volledige BAG-IDs', () => {
  it('toont VBO-ID en Pand-ID volledig (geen ellipsis)', () => {
    const qc = new QueryClient();
    const { getByTestId } = render(
      <QueryClientProvider client={qc}>
        <BagOverzichtKaart signaal={signaal} />
      </QueryClientProvider>,
    );
    const vbo = getByTestId('bag-doelobject-vboid');
    const pand = getByTestId('bag-doelobject-pandid');
    expect(vbo.textContent).toBe('0363010000649405');
    expect(pand.textContent).toBe('0363100012162738');
    expect(vbo.textContent).not.toMatch(/…|\.\.\./);
    expect(pand.textContent).not.toMatch(/…|\.\.\./);
  });
});
