// V2.4 — Kandidaat zonder oppervlakte blijft zichtbaar met label "Oppervlakte onbekend".
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagMatchResolver from '@/components/offmarket/bag/BagMatchResolver';

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

describe('BAG resolver — kandidaat zonder oppervlakte', () => {
  it('toont card met "Oppervlakte onbekend"', () => {
    const { getByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={[
        { adres: 'Govert Flinckstraat 330', vbo_id: null, nummeraanduiding_id: 'n1', pdok_id: 'adr-x', opp_m2: null },
      ]} />,
    );
    const card = getByTestId('bag-match-kandidaat');
    expect(card.textContent).toMatch(/Govert Flinckstraat 330/);
    expect(card.textContent).toMatch(/Oppervlakte onbekend/i);
  });
});
