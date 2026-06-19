// V2.4 — Resolver rendert kandidaten ook als bag_vbos leeg is.
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

describe('BAG resolver — kandidaten zichtbaar zonder VBO-lijst', () => {
  it('toont beide kandidaatcards en geen lege-waarschuwing', () => {
    const s = {
      id: 's1', titel: 't',
      bag_status: 'meerdere_matches',
      bag_match_kwaliteit: 'onzeker',
      bag_match_kandidaten: [
        { adres: 'Govert Flinckstraat 330-1', vbo_id: 'v1', nummeraanduiding_id: 'n1', pdok_id: 'adr-a', opp_m2: 56, gebruiksdoel: ['woonfunctie'] },
        { adres: 'Govert Flinckstraat 330-2', vbo_id: 'v2', nummeraanduiding_id: 'n2', pdok_id: 'adr-b', opp_m2: 47, gebruiksdoel: ['woonfunctie'] },
      ],
      bag_vbos: [],
    } as unknown as OffMarketSignaal;
    const { getAllByTestId, queryByTestId } = wrap(<BagOverzichtKaart signaal={s} />);
    expect(queryByTestId('bag-resolver-leeg-waarschuwing')).toBeNull();
    const cards = getAllByTestId('bag-match-kandidaat');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toMatch(/330-1/);
    expect(cards[1].textContent).toMatch(/330-2/);
  });
});
