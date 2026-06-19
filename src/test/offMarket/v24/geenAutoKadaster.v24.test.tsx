// V2.4 — Matchselectie roept nooit een Kadaster-edge-function aan.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagMatchResolver from '@/components/offmarket/bag/BagMatchResolver';

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

describe('V2.4 — geen automatische Kadaster-aanvraag', () => {
  beforeEach(() => invokeMock.mockReset());

  it('matchselectie triggert geen kadaster-objectinformatie / kadaster-check', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    const user = userEvent.setup();
    const { getByTestId } = wrap(<BagMatchResolver signaalId="s1" kandidaten={[
      { adres: 'X 1', vbo_id: 'v', nummeraanduiding_id: 'n' },
    ]} />);
    await user.click(getByTestId('bag-match-kies-knop'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const called = invokeMock.mock.calls.map((c) => c[0] as string);
    expect(called).not.toContain('kadaster-objectinformatie');
    expect(called).not.toContain('off-market-kadaster-check');
    expect(called).toContain('off-market-bag-verrijk');
  });
});
