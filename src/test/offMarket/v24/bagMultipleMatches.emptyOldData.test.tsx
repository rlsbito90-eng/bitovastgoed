// V2.4 — Signaal met meerdere_matches + bag_match_kandidaten=null toont uitleg over oude data.
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

describe('BAG resolver — lege oude data', () => {
  it('toont oude-data uitleg wanneer bag_match_kandidaten null is', () => {
    const s = {
      id: 's1', titel: 't',
      bag_status: 'meerdere_matches',
      bag_match_kwaliteit: 'onzeker',
      bag_match_kandidaten: null,
    } as unknown as OffMarketSignaal;
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={s} />);
    const w = getByTestId('bag-resolver-leeg-waarschuwing');
    expect(w.getAttribute('data-variant')).toBe('oude_data');
    expect(w.textContent?.toLowerCase()).toMatch(/oude bag-matchdata|bag verrijken/);
  });

  it('toont geen-kandidaten uitleg wanneer bag_match_kandidaten een lege array is', () => {
    const s = {
      id: 's1', titel: 't',
      bag_status: 'meerdere_matches',
      bag_match_kwaliteit: 'onzeker',
      bag_match_kandidaten: [],
    } as unknown as OffMarketSignaal;
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={s} />);
    const w = getByTestId('bag-resolver-leeg-waarschuwing');
    expect(w.getAttribute('data-variant')).toBe('geen_kandidaten');
    expect(w.textContent?.toLowerCase()).toMatch(/postcode \+ huisnummer|controleer/);
  });
});
