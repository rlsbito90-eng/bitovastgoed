// V2.5 — Resolver: ongeldige kandidaat (afwijkend huisnummer/postcode) is niet selecteerbaar
// en toont een korte reden.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagMatchResolver from '@/components/offmarket/bag/BagMatchResolver';
import type { BagMatchKandidaat } from '@/lib/offMarket/bag/types';

const invokeMock = vi.fn(async () => ({ data: { ok: true }, error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const kandidaten: BagMatchKandidaat[] = [
  {
    adres: 'Teststraat 44-H',
    vbo_id: 'v44h',
    nummeraanduiding_id: 'n44h',
    huisnummer: '44',
    huisnummertoevoeging: 'H',
    match_type: 'zelfde_huisnummer',
  },
  {
    adres: 'Teststraat 1-H',
    vbo_id: 'v1h',
    nummeraanduiding_id: 'n1h',
    huisnummer: '1',
    huisnummertoevoeging: 'H',
    match_type: 'zelfde_huisnummer',
  },
];

describe('V2.5 resolver — ongeldige kandidaat blokkeert selectie', () => {
  it('kandidaat met afwijkend huisnummer is disabled + toont reden', async () => {
    const { getAllByTestId, getAllByText } = wrap(
      <BagMatchResolver
        signaalId="s1"
        kandidaten={kandidaten}
        signaal={{ adres: 'Teststraat 44-H', titel: 'Teststraat 44-H', postcode: null }}
      />,
    );
    const knoppen = getAllByTestId('bag-match-kies-knop') as HTMLButtonElement[];
    expect(knoppen).toHaveLength(2);
    expect(knoppen[0]).not.toBeDisabled();
    expect(knoppen[1]).toBeDisabled();
    const reden = getAllByText(/Niet selecteerbaar/i);
    expect(reden.length).toBeGreaterThan(0);
  });

  it('klik op disabled-knop voert geen invoke uit', async () => {
    const user = userEvent.setup();
    invokeMock.mockClear();
    const { getAllByTestId } = wrap(
      <BagMatchResolver
        signaalId="s1"
        kandidaten={kandidaten}
        signaal={{ adres: 'Teststraat 44-H', titel: 'Teststraat 44-H', postcode: null }}
      />,
    );
    const knop = (getAllByTestId('bag-match-kies-knop') as HTMLButtonElement[])[1];
    await user.click(knop).catch(() => {});
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
