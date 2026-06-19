// V2.4 fix — Kandidaat zonder pdok_id/vbo_id/nummeraanduiding_id:
// component crasht niet, "Gebruik deze match" is disabled.
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

describe('BagMatchResolver — kandidaat zonder bruikbare ID', () => {
  it('crasht niet en disabled "Gebruik deze match"', () => {
    const k: BagMatchKandidaat[] = [
      { adres: 'Frans Halsstraat 100', pdok_id: null, vbo_id: null, nummeraanduiding_id: null },
    ];
    const { getByTestId } = wrap(<BagMatchResolver signaalId="sig-x" kandidaten={k} />);
    const knop = getByTestId('bag-match-kies-knop') as HTMLButtonElement;
    expect(knop.disabled).toBe(true);
    expect(getByTestId('bag-match-onbruikbaar-melding').textContent)
      .toMatch(/mist een technisch ID/i);
    // BAG Viewer-link blijft beschikbaar wanneer er een adres is.
    expect(getByTestId('bag-match-viewer-link')).toBeInTheDocument();
  });
});
