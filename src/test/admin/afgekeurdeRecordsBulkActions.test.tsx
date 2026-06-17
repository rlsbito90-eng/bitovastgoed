import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OffMarketGeskiptRecordsSectie from '@/components/admin/OffMarketGeskiptRecordsSectie';

const records = Array.from({ length: 5 }, (_, i) => ({
  id: `r${i}`, bron_id: 'b1', extern_id: `e${i}`,
  binnengekomen_op: '2026-06-15T00:00:00Z', updated_at: '2026-06-15T00:00:00Z',
  signaal_id: null, titel: `Fictief record ${i}`, samenvatting: '',
  datum: '2026-06-15', link: null, subjects: [],
  score: 20, skip_reden: 'score=20', score_componenten: [],
  score_componenten_tekst: '+20 adres', handmatig_genegeerd: false, payload: {},
}));

const negeerMock = vi.fn(async () => undefined);
const toastWarning = vi.fn();
const toastSuccess = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: (...a: any[]) => toastSuccess(...a), error: vi.fn(), warning: (...a: any[]) => toastWarning(...a) },
}));
vi.mock('@/hooks/useGeskipteRuwRecords', () => ({
  useGeskipteRuwRecords: () => ({ data: records, isLoading: false }),
  useNegeerGeskipt: () => ({ mutateAsync: negeerMock, isPending: false }),
  usePromoteGeskipt: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useOffMarketBronnen', () => ({ useOffMarketBronnen: () => ({ data: [] }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: async () => ({ data: [], error: null }) }) },
}));

describe('Afgekeurde records — bulk verbergen', () => {
  it('verbergt geselecteerde records via confirm-dialog', async () => {
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><OffMarketGeskiptRecordsSectie /></QueryClientProvider>);

    fireEvent.click(screen.getByTestId('select-r0'));
    fireEvent.click(screen.getByTestId('select-r1'));
    fireEvent.click(screen.getByTestId('select-r2'));

    expect(screen.getByTestId('bulk-toolbar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Verbergen$/i }));
    fireEvent.click(screen.getByTestId('bulk-bevestig'));

    await waitFor(() => expect(negeerMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    // Selectie leeg → toolbar weg
    await waitFor(() => expect(screen.queryByTestId('bulk-toolbar')).toBeNull());
  });
});
