// V2.4 — Nearby kandidaten kunnen niet als doelobject worden gekozen (knop disabled).
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    adres: 'Prinsengracht 202-H',
    vbo_id: 'v-202h',
    nummeraanduiding_id: 'n-202h',
    huisnummer: '202',
    huisletter: 'H',
    match_type: 'exact_doelobject',
    is_doelobject_match: true,
  },
  {
    adres: 'Prinsengracht 237H-A',
    vbo_id: 'v-237',
    nummeraanduiding_id: 'n-237',
    huisnummer: '237',
    huisletter: 'H',
    huisnummertoevoeging: 'A',
    match_type: 'nabijgelegen_adres',
  },
];

describe('BagMatchResolver — nearby kan geen doelobject zijn', () => {
  it('nearby kandidaat is niet in primaire lijst', () => {
    const { getByTestId, getAllByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={kandidaten} />,
    );
    const lijst = getByTestId('bag-match-kandidaten');
    const primair = getAllByTestId('bag-match-kandidaat').filter((el) => lijst.contains(el));
    expect(primair).toHaveLength(1);
    expect(primair[0].textContent).toMatch(/202-H/);
    expect(primair[0].textContent).not.toMatch(/237/);
  });

  it('nearby toggle openen → kies-knop is disabled', async () => {
    const user = userEvent.setup();
    const { getByTestId, getAllByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={kandidaten} />,
    );
    await user.click(getByTestId('bag-match-nearby-toggle'));
    const nearbyList = getByTestId('bag-match-nearby-lijst');
    const knoppen = getAllByTestId('bag-match-kies-knop').filter((b) => nearbyList.contains(b));
    expect(knoppen).toHaveLength(1);
    expect(knoppen[0]).toBeDisabled();
  });
});
