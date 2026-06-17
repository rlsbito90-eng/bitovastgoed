import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OffMarketGeskiptRecordsSectie from '@/components/admin/OffMarketGeskiptRecordsSectie';

const records = Array.from({ length: 60 }, (_, i) => ({
  id: `r${i}`,
  bron_id: 'b1',
  extern_id: `e${i}`,
  binnengekomen_op: '2026-06-15T00:00:00Z',
  updated_at: '2026-06-15T00:00:00Z',
  signaal_id: null,
  titel: `Fictief record ${i}`,
  samenvatting: '',
  datum: '2026-06-15',
  link: null,
  subjects: [],
  score: 20,
  skip_reden: 'score=20 (drempel=40)',
  score_componenten: [],
  score_componenten_tekst: '+20 adres',
  handmatig_genegeerd: false,
  payload: {},
}));

vi.mock('@/hooks/useGeskipteRuwRecords', () => ({
  useGeskipteRuwRecords: () => ({ data: records, isLoading: false }),
  useNegeerGeskipt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePromoteGeskipt: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useOffMarketBronnen', () => ({
  useOffMarketBronnen: () => ({ data: [] }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: async () => ({ data: [], error: null }) }) },
}));

function ren() {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}><OffMarketGeskiptRecordsSectie /></QueryClientProvider>);
}

describe('Afgekeurde records — paginering', () => {
  it('toont eerst maximaal 25 records en laadt meer bij klik', () => {
    ren();
    expect(screen.getAllByTestId('geskipt-record')).toHaveLength(25);
    fireEvent.click(screen.getByTestId('laad-meer'));
    expect(screen.getAllByTestId('geskipt-record')).toHaveLength(50);
  });
});
