// V2.4 — Matchselectie veroorzaakt geen Kadaster-edge-function aanroep (exact-match pad).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagMatchResolver from '@/components/offmarket/bag/BagMatchResolver';
import type { BagMatchKandidaat } from '@/lib/offMarket/bag/types';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
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

describe('V2.4 — exact-match selectie roept geen Kadaster aan', () => {
  beforeEach(() => invokeMock.mockReset());
  it('alleen off-market-bag-verrijk wordt aangeroepen', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    const kandidaten: BagMatchKandidaat[] = [
      { adres: 'X 330-1', vbo_id: 'v1', pdok_id: 'adr-a', is_doelobject_match: true, match_type: 'exact_doelobject' },
    ];
    const user = userEvent.setup();
    const { getByTestId } = wrap(<BagMatchResolver signaalId="s1" kandidaten={kandidaten} />);
    await user.click(getByTestId('bag-match-kies-knop'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const fnNames = invokeMock.mock.calls.map((c) => c[0] as string);
    expect(fnNames).not.toContain('kadaster-objectinformatie');
    expect(fnNames).not.toContain('off-market-kadaster-check');
    expect(fnNames).toContain('off-market-bag-verrijk');
  });
});
