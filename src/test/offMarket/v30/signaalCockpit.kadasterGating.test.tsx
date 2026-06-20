// V2.5 — SignaalCockpit: Quick Action "Kadaster ophalen" disabled
// zolang bag_status !== 'verrijkt'; handler wordt niet aangeroepen.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalCockpit from '@/components/offmarket/SignaalCockpit';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useOffMarketBrieven', () => ({
  useOffMarketBrievenForSignaal: () => ({ data: [] }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function fixt(bag_status: string): OffMarketSignaal {
  return {
    id: 's1',
    titel: 'Testpand',
    adres: 'Teststraat 44',
    postcode: null,
    status: 'nieuw_signaal',
    prioriteit: 'midden',

    assettype: 'wonen',
    ai_status: 'klaar',
    ai_score: 70,
    bag_status,
  } as unknown as OffMarketSignaal;
}

describe('V2.5 SignaalCockpit — Kadaster Quick Action gating', () => {
  it('disabled bij meerdere_matches; klik triggert handler niet', async () => {
    const handler = vi.fn();
    wrap(
      <SignaalCockpit
        signaal={fixt('meerdere_matches')}
        taken={[]}
        briefStatus="geen"
        onKadasterOphalen={handler}
      />,
    );
    const knop = screen.getByRole('button', { name: /Kadaster ophalen/i });
    expect(knop).toBeDisabled();
    expect(knop.getAttribute('title') ?? '').toMatch(/BAG-match/i);
    const user = userEvent.setup();
    await user.click(knop).catch(() => {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('enabled bij verrijkt; klik triggert handler', async () => {
    const handler = vi.fn();
    wrap(
      <SignaalCockpit
        signaal={fixt('verrijkt')}
        taken={[]}
        briefStatus="geen"
        onKadasterOphalen={handler}
      />,
    );
    const knop = screen.getByRole('button', { name: /Kadaster ophalen/i });
    expect(knop).not.toBeDisabled();
    const user = userEvent.setup();
    await user.click(knop);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
