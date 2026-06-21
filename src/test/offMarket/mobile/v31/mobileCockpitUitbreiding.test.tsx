// V31 — Mobiele cockpit: BAG-status, Kadasteradviesbadge (alleen bij verrijkt),
// compacte StatusWijzigDropdown, "Taak aanmaken" en "Open taken".
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import { maakTestSignaal } from '../_fixture';

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

describe('SignaalMobileCockpit — BAG/Kadaster/Status/Taken', () => {
  it('toont BAG-statusbadge en verbergt Kadasteradviesbadge bij niet-verrijkt', () => {
    const signaal = maakTestSignaal({ bag_status: 'niet_verrijkt' } as any);
    render(wrap(<SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />));
    expect(screen.getByTestId('mobile-cockpit-bag-rij')).toBeInTheDocument();
    expect(screen.getByTestId('bag-kaart-badge')).toHaveAttribute('data-bag-status', 'niet_verrijkt');
    expect(screen.queryByTestId('kadasteradvies-badge')).toBeNull();
  });

  it('toont Kadasteradviesbadge uitsluitend wanneer bag_status=verrijkt', () => {
    const signaal = maakTestSignaal({ bag_status: 'verrijkt' } as any);
    render(wrap(<SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />));
    expect(screen.getByTestId('kadasteradvies-badge')).toBeInTheDocument();
  });

  it('toont compacte StatusWijzigDropdown', () => {
    const signaal = maakTestSignaal();
    render(wrap(<SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />));
    expect(screen.getByTestId('status-wijzig-compact')).toBeInTheDocument();
  });

  it('toont "Taak aanmaken" altijd en "Open taken" alleen bij openstaande taak', () => {
    const signaal = maakTestSignaal();
    const { rerender } = render(wrap(
      <SignaalMobileCockpit
        signaal={signaal}
        taken={[]}
        briefStatus="geen"
        onTaakAanmaken={() => {}}
        onOpenTaken={() => {}}
      />,
    ));
    expect(screen.getByTestId('mobile-cockpit-taak-aanmaken')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-cockpit-open-taken')).toBeNull();

    rerender(wrap(
      <SignaalMobileCockpit
        signaal={signaal}
        taken={[{
          id: 't1', titel: 'Bel eigenaar', status: 'open',
          offMarketSignaalId: signaal.id, deadline: '2026-07-01',
          softDeletedAt: null,
        } as any]}
        briefStatus="geen"
        onTaakAanmaken={() => {}}
        onOpenTaken={() => {}}
      />,
    ));
    expect(screen.getByTestId('mobile-cockpit-open-taken')).toBeInTheDocument();
  });
});
