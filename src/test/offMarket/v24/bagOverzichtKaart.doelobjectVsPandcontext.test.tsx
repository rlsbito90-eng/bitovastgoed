// V2.4 — BagOverzichtKaart toont Doelobject + BAG-pandcontext.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function fixt(): OffMarketSignaal {
  return {
    id: 's1',
    titel: 'Voorbeeldpand',
    ai_status: 'klaar',
    ai_score: 60,
    bag_status: 'verrijkt',
    bag_match_kwaliteit: 'exact',
    bag_aantal_vbo: 2,
    bag_aantal_panden: 1,
    bag_totaal_oppervlakte_m2: 103,
    bag_gebruiksdoelen: ['woonfunctie'],
    bag_pandcontext_aantal_vbo: 2,
    bag_pandcontext_totaal_opp_m2: 103,
    bag_geselecteerd_vbo_id: 'v-330-1',
    bag_geselecteerd_adres: 'Govert Flinckstraat 330-1',
    bag_geselecteerd_opp_m2: 56,
    bag_geselecteerd_gebruiksdoel: ['woonfunctie'],
    bag_vbos: [
      { nummeraanduiding_id: 'n1', vbo_id: 'v-330-1', adres: 'Govert Flinckstraat 330-1', opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'In gebruik' },
      { nummeraanduiding_id: 'n2', vbo_id: 'v-330-2', adres: 'Govert Flinckstraat 330-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik' },
    ],
  } as unknown as OffMarketSignaal;
}

describe('BagOverzichtKaart — Doelobject vs BAG-pandcontext', () => {
  it('toont zowel Doelobject als BAG-pandcontext', () => {
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={fixt()} />);
    expect(getByTestId('bag-doelobject-sectie')).toBeInTheDocument();
    expect(getByTestId('bag-pandcontext-sectie')).toBeInTheDocument();
    expect(getByTestId('bag-doelobject-adres').textContent).toMatch(/330-1/);
    expect(getByTestId('bag-doelobject-adres').textContent).toMatch(/56 m²/);
    expect(getByTestId('bag-stat-opp').textContent).toContain('103');
    expect(getByTestId('bag-stat-vbo').textContent).toContain('2');
  });

  it('markeert gekozen VBO in de lijst', () => {
    const { getAllByTestId } = wrap(<BagOverzichtKaart signaal={fixt()} />);
    const items = getAllByTestId('bag-vbo-item');
    const gekozen = items.filter((el) => el.getAttribute('data-gekozen') === 'true');
    expect(gekozen).toHaveLength(1);
    expect(gekozen[0].textContent).toMatch(/330-1/);
  });
});
