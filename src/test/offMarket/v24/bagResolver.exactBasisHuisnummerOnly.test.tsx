// V2.4 — Primaire UI toont alleen kandidaten met exact dezelfde postcode + basis-huisnummer.
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
  { adres: 'Govert Flinckstraat 330-1, 1074CE Amsterdam', huisnummer: '330', match_type: 'zelfde_huisnummer' },
  { adres: 'Govert Flinckstraat 330-2, 1074CE Amsterdam', huisnummer: '330', match_type: 'zelfde_huisnummer' },
  { adres: 'Govert Flinckstraat 328-H', huisnummer: '328', match_type: 'nabijgelegen_adres' },
  { adres: 'Govert Flinckstraat 332A', huisnummer: '332', match_type: 'nabijgelegen_adres' },
  { adres: 'Govert Flinckstraat 334A', huisnummer: '334', match_type: 'nabijgelegen_adres' },
];

describe('BAG resolver — exact basis-huisnummer only (primair)', () => {
  it('toont primair alleen 330-1 en 330-2; nearby niet in hoofdkeuzelijst', () => {
    const { getAllByTestId, queryByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={kandidaten} />,
    );
    const lijst = queryByTestId('bag-match-kandidaten');
    expect(lijst).not.toBeNull();
    const primaire = getAllByTestId('bag-match-kandidaat').filter((el) =>
      lijst!.contains(el),
    );
    expect(primaire).toHaveLength(2);
    const text = primaire.map((c) => c.textContent ?? '').join(' | ');
    expect(text).toMatch(/330-1/);
    expect(text).toMatch(/330-2/);
    expect(text).not.toMatch(/328-H/);
    expect(text).not.toMatch(/332A/);
    expect(text).not.toMatch(/334A/);
  });

  it('biedt nearby alleen achter een toggle (niet open by default)', () => {
    const { queryByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={kandidaten} />,
    );
    expect(queryByTestId('bag-match-nearby-toggle')).not.toBeNull();
    expect(queryByTestId('bag-match-nearby-lijst')).toBeNull();
  });
});
