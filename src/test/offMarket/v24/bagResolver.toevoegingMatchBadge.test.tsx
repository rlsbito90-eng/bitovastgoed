// V2.4 — Doelobject-kandidaat krijgt MATCH-badge, anderen "Zelfde BAG-pand".
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
    adres: 'Govert Flinckstraat 330-1', huisnummer: '330', huisnummertoevoeging: '1',
    match_type: 'exact_doelobject', is_doelobject_match: true, opp_m2: 56, gebruiksdoel: ['woonfunctie'],
  },
  {
    adres: 'Govert Flinckstraat 330-2', huisnummer: '330', huisnummertoevoeging: '2',
    match_type: 'zelfde_huisnummer', is_doelobject_match: false, opp_m2: 47, gebruiksdoel: ['woonfunctie'],
  },
];

describe('BAG resolver — toevoeging MATCH-badge', () => {
  it('330-1 toont MATCH/Doelobject; 330-2 toont Zelfde BAG-pand of zelfde huisnummer', () => {
    const { getAllByTestId } = wrap(<BagMatchResolver signaalId="s1" kandidaten={kandidaten} />);
    const cards = getAllByTestId('bag-match-kandidaat');
    expect(cards).toHaveLength(2);

    // Doelobject staat bovenaan (sortering).
    expect(cards[0].getAttribute('data-doelobject')).toBe('true');
    expect(cards[0].textContent).toMatch(/330-1/);
    expect(cards[0].textContent).toMatch(/MATCH/i);

    expect(cards[1].getAttribute('data-doelobject')).toBe('false');
    expect(cards[1].textContent).toMatch(/330-2/);
    expect(cards[1].textContent?.toLowerCase()).toMatch(/zelfde/);
  });
});
