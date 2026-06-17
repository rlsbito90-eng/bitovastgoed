import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OffMarketBronnenSectie from '@/components/admin/OffMarketBronnenSectie';

const fakeBronnen = [
  {
    id: 'b1', naam: 'Fictieve bron alfa', type: 'bekendmaking', actief: true,
    frequentie: 'dagelijks', auto_import: true, auto_verwerken: true,
    laatste_run_op: '2026-06-17T10:00:00Z', laatste_sync_op: '2026-06-17T10:00:00Z',
    volgende_run_op: '2026-06-18T10:00:00Z', laatste_run_status: null, laatste_fout: null,
  },
  {
    id: 'b2', naam: 'Fictieve bron beta', type: 'bekendmaking', actief: false,
    frequentie: 'handmatig', auto_import: false, auto_verwerken: false,
    laatste_run_op: null, laatste_sync_op: null, volgende_run_op: null,
    laatste_run_status: null, laatste_fout: null,
  },
];

vi.mock('@/hooks/useOffMarketBronnen', () => ({
  useOffMarketBronnen: () => ({ data: fakeBronnen, isLoading: false }),
  useOnverwerkteRuwCount: () => ({ data: 0 }),
  useOffMarketBronStats: () => ({ data: {} }),
  useRunBron: () => ({ mutateAsync: vi.fn(), isPending: false, variables: undefined }),
  useToggleBron: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNormalizeWachtrij: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNormalizeWachtrijVolledig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/admin/BronInstellingenPanel', () => ({ default: () => null }));
vi.mock('@/components/admin/BronBackfillPanel', () => ({ default: () => null }));

function ren() {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}><OffMarketBronnenSectie /></QueryClientProvider>);
}

describe('OffMarketBronnenSectie — losse kaarten', () => {
  it('rendert elke bron als eigen kaart met statusbadge', () => {
    ren();
    const kaarten = screen.getAllByTestId('off-market-bron-kaart');
    expect(kaarten).toHaveLength(2);
    expect(screen.getByText('Fictieve bron alfa')).toBeInTheDocument();
    expect(screen.getByText('Fictieve bron beta')).toBeInTheDocument();
    // statusbadges: 'succes' voor alfa (heeft run), 'nooit gedraaid' voor beta
    expect(screen.getByText(/succes/i)).toBeInTheDocument();
    expect(screen.getByText(/nooit gedraaid/i)).toBeInTheDocument();
  });
});
