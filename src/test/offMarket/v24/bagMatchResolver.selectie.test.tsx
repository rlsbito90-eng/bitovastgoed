// V2.4 — Klik op "Gebruik deze match" roept edge function aan met selected_vbo_id.
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

const k: BagMatchKandidaat[] = [{
  adres: 'Demostraat 12-A',
  vbo_id: 'vbo-aaa',
  nummeraanduiding_id: 'na-aaa',
  opp_m2: 56,
  gebruiksdoel: ['woonfunctie'],
}];

describe('BagMatchResolver — selectie', () => {
  beforeEach(() => invokeMock.mockReset());

  it('roept edge function aan met selected_vbo_id', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, status: 'verrijkt' }, error: null });
    const user = userEvent.setup();
    const { getByTestId } = wrap(<BagMatchResolver signaalId="sig-1" kandidaten={k} />);

    await user.click(getByTestId('bag-match-kies-knop'));

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const [fn, args] = invokeMock.mock.calls[0];
    expect(fn).toBe('off-market-bag-verrijk');
    expect(args.body).toMatchObject({
      signaal_id: 'sig-1',
      force: true,
      selected_vbo_id: 'vbo-aaa',
      selected_nummeraanduiding_id: 'na-aaa',
    });
  });
});
