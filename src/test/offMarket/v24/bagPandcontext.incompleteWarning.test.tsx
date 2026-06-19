// V2.4 — UI waarschuwt wanneer pandcontext incompleet is.
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

describe('BAG-pandcontext — incomplete warning', () => {
  it('toont waarschuwing wanneer bag_pandcontext_incompleet=true', () => {
    const s = {
      id: 's1', titel: 't',
      bag_status: 'verrijkt',
      bag_match_kwaliteit: 'exact',
      bag_geselecteerd_vbo_id: 'v1',
      bag_geselecteerd_adres: 'X 1',
      bag_pandcontext_aantal_vbo: 1,
      bag_pandcontext_totaal_opp_m2: 56,
      bag_pandcontext_incompleet: true,
      bag_vbos: [{
        nummeraanduiding_id: 'n1', vbo_id: 'v1', adres: 'X 1',
        opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: null,
        is_doelobject: true,
      }],
    } as unknown as OffMarketSignaal;
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={s} />);
    const warn = getByTestId('bag-pandcontext-incompleet-waarschuwing');
    expect(warn).toBeInTheDocument();
    expect(warn.textContent?.toLowerCase()).toMatch(/incompleet/);
  });

  it('toont géén waarschuwing wanneer vlag false', () => {
    const s = {
      id: 's1', titel: 't',
      bag_status: 'verrijkt', bag_match_kwaliteit: 'exact',
      bag_geselecteerd_vbo_id: 'v1', bag_geselecteerd_adres: 'X 1',
      bag_pandcontext_aantal_vbo: 2, bag_pandcontext_totaal_opp_m2: 103,
      bag_pandcontext_incompleet: false,
      bag_vbos: [
        { nummeraanduiding_id: 'n1', vbo_id: 'v1', adres: '330-1', opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: null, is_doelobject: true },
        { nummeraanduiding_id: 'n2', vbo_id: 'v2', adres: '330-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: null },
      ],
    } as unknown as OffMarketSignaal;
    const { queryByTestId } = wrap(<BagOverzichtKaart signaal={s} />);
    expect(queryByTestId('bag-pandcontext-incompleet-waarschuwing')).toBeNull();
  });
});
