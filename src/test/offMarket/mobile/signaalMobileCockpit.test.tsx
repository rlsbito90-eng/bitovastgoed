import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import { maakTestSignaal } from './_fixture';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignaalMobileCockpit', () => {
  it('rendert AI-score, verkoopkans en gebied-regel', () => {
    const signaal = maakTestSignaal({
      ai_score: 76,
      ai_verkoopkans: 0.6,
      potentiele_strategie: 'Splitsingspotentie',
    } as any);
    render(
      wrap(
        <SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />
      ),
    );
    expect(screen.getByTestId('signaal-mobile-cockpit')).toBeInTheDocument();
    expect(screen.getByText('76')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Splitsingspotentie')).toBeInTheDocument();
    expect(screen.getByText('Geen open taak gepland.')).toBeInTheDocument();
  });

  it('toont een ingevulde volgende actie als die er is', () => {
    const signaal = maakTestSignaal({
      volgende_actie_omschrijving: 'Eigenaar nabellen',
      volgende_actie_datum: '2026-07-01',
    } as any);
    render(
      wrap(
        <SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />
      ),
    );
    expect(screen.getByText('Eigenaar nabellen')).toBeInTheDocument();
  });
});
