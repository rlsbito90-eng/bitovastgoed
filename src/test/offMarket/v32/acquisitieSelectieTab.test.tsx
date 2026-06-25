// V32 — AcquisitieSelectieTab: empty state en lijstweergave met actieve items.
// Mockt hooks; geen netwerk.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { maakTestSignaal } from '../mobile/_fixture';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({ is: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  },
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

let mockItems: Array<{ id: string; signaal_id: string; archived_at: null | string; toegevoegd_op: string; toegevoegd_door: null; notitie: null }> = [];
const mockSignalen = [
  maakTestSignaal({ id: 'sig-1', adres: 'Voorbeeldstraat 1', plaats: 'Testdorp', ai_score: 72 }),
  maakTestSignaal({ id: 'sig-2', adres: 'Voorbeeldstraat 2', plaats: 'Testdorp', ai_score: 30 }),
];

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectie: () => ({ data: mockItems, isLoading: false }),
  useIsInAcquisitieSelectie: () => true,
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: mockSignalen }),
}));
vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ addTaak: vi.fn(), taken: [], getRelatieById: () => null }),
}));

import AcquisitieSelectieTab from '@/components/offmarket/acquisitie/AcquisitieSelectieTab';

describe('AcquisitieSelectieTab', () => {
  it('toont een duidelijke empty state', () => {
    mockItems = [];
    render(wrap(<AcquisitieSelectieTab />));
    expect(screen.getByText(/Nog geen signalen in selectie/i)).toBeInTheDocument();
  });

  it('toont uitsluitend actieve selectie-items', () => {
    mockItems = [
      { id: 'r1', signaal_id: 'sig-1', archived_at: null, toegevoegd_op: '2026-06-20T10:00:00Z', toegevoegd_door: null, notitie: null },
    ];
    render(wrap(<AcquisitieSelectieTab />));
    const rijen = screen.getAllByTestId('acquisitie-selectie-rij');
    expect(rijen).toHaveLength(1);
    expect(rijen[0]).toHaveAttribute('data-signaal-id', 'sig-1');
  });

  it('rendert mobielvriendelijke rij zonder horizontale overflow-utilities', () => {
    mockItems = [
      { id: 'r1', signaal_id: 'sig-1', archived_at: null, toegevoegd_op: '2026-06-20T10:00:00Z', toegevoegd_door: null, notitie: null },
    ];
    const { container } = render(wrap(<AcquisitieSelectieTab />));
    const rij = screen.getByTestId('acquisitie-selectie-rij');
    expect(rij.querySelector('.flex-col')).not.toBeNull();
    expect(container.querySelector('.overflow-x-auto')).toBeNull();
  });
});
