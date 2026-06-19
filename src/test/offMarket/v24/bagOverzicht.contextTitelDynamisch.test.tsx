// V2.4 — BagOverzichtKaart toont dynamische context-titel.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
}));
vi.mock('@/hooks/useEnrichSignaal', () => ({
  useEnrichSignaal: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseSignaal: any = {
  id: 's1',
  titel: 'Govert Flinckstraat 330-2',
  adres: 'Govert Flinckstraat 330-2',
  postcode: '1074CE',
  plaats: 'Amsterdam',
  bag_status: 'verrijkt',
  bag_match_kwaliteit: 'exact',
  bag_vbos: [],
  bag_geselecteerd_vbo_id: 'v2',
  bag_geselecteerd_adres: 'Govert Flinckstraat 330-2, 1074CE Amsterdam',
};

describe('BagOverzichtKaart — dynamische context-titel', () => {
  it('toont pand-tekst bij bron=pandid', () => {
    const { getByTestId } = wrap(
      <BagOverzichtKaart signaal={{ ...baseSignaal, bag_pandcontext_bron: 'pandid' }} />,
    );
    const titel = getByTestId('bag-vbo-lijst-titel');
    expect(titel.textContent?.toLowerCase()).toMatch(/zelfde bag-pand/);
  });
  it('toont adrescontext-tekst bij bron=huisnummer', () => {
    const { getByTestId } = wrap(
      <BagOverzichtKaart signaal={{ ...baseSignaal, bag_pandcontext_bron: 'huisnummer' }} />,
    );
    const titel = getByTestId('bag-vbo-lijst-titel');
    expect(titel.textContent?.toLowerCase()).toMatch(/bag-adrescontext/);
  });
});
