// V2.4 — BagMatchResolver toont kandidaten als cards.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagMatchResolver from '@/components/offmarket/bag/BagMatchResolver';
import type { BagMatchKandidaat } from '@/lib/offMarket/bag/types';

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

const kandidaten: BagMatchKandidaat[] = [
  {
    adres: 'Govert Flinckstraat 330-1',
    vbo_id: 'v-330-1',
    nummeraanduiding_id: 'n-330-1',
    opp_m2: 56,
    gebruiksdoel: ['woonfunctie'],
    status: 'Verblijfsobject in gebruik',
    match_kwaliteit: 'onzeker',
    match_reden: 'Meerdere PDOK-treffers',
  },
  {
    adres: 'Govert Flinckstraat 330-2',
    vbo_id: 'v-330-2',
    nummeraanduiding_id: 'n-330-2',
    opp_m2: 47,
    gebruiksdoel: ['woonfunctie'],
    status: 'Verblijfsobject in gebruik',
    match_kwaliteit: 'onzeker',
  },
];

describe('BagMatchResolver', () => {
  it('toont twee kandidaten met adres, m² en gebruiksdoel', () => {
    const { getAllByTestId, getByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={kandidaten} />,
    );
    expect(getByTestId('bag-match-resolver')).toBeInTheDocument();
    const cards = getAllByTestId('bag-match-kandidaat');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toMatch(/330-1/);
    expect(cards[0].textContent).toMatch(/56 m²/);
    expect(cards[0].textContent?.toLowerCase()).toMatch(/woonfunctie/);
    expect(cards[1].textContent).toMatch(/47 m²/);
  });

  it('elke kandidaat heeft een BAG-Viewer-link', () => {
    const { getAllByTestId } = wrap(<BagMatchResolver signaalId="s1" kandidaten={kandidaten} />);
    const links = getAllByTestId('bag-match-viewer-link') as HTMLAnchorElement[];
    expect(links).toHaveLength(2);
    expect(links[0].href).toContain('bagviewer.kadaster.nl');
    expect(decodeURIComponent(links[0].href)).toContain('Govert Flinckstraat 330-1');
  });
});
