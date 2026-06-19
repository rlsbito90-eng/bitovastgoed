// V2.4 — useBagVerrijken stuurt selected_pdok_id mee na selectie.
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

describe('BAG resolver — selectie levert pandcontext-trigger', () => {
  beforeEach(() => invokeMock.mockReset());

  it('stuurt selected_pdok_id mee zodat lookup met adr-id werkt', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, status: 'verrijkt', aantal_vbo: 2 }, error: null });
    const user = userEvent.setup();
    const { getByTestId } = wrap(
      <BagMatchResolver signaalId="s1" kandidaten={[
        { adres: 'Govert Flinckstraat 330-1', vbo_id: 'v1', nummeraanduiding_id: 'n1', pdok_id: 'adr-aaa' },
      ]} />,
    );
    await user.click(getByTestId('bag-match-kies-knop'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const [, args] = invokeMock.mock.calls[0];
    expect(args.body).toMatchObject({
      signaal_id: 's1',
      force: true,
      selected_vbo_id: 'v1',
      selected_nummeraanduiding_id: 'n1',
      selected_pdok_id: 'adr-aaa',
    });
  });
});
