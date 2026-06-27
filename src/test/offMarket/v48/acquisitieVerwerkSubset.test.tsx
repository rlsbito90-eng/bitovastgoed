// V48 — "Verwerk selectie" gebruikt geselecteerde rijen.
// Wanneer er rijen via de bulkcheckbox zijn aangevinkt, verandert de
// knop-tekst naar "Verwerk geselecteerde (n)" en verwerkt FocusModus
// alléén die subset.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { maakTestSignaal } from '../mobile/_fixture';

beforeAll(() => {
  if (!(HTMLElement.prototype as any).hasPointerCapture) {
    (HTMLElement.prototype as any).hasPointerCapture = () => false;
    (HTMLElement.prototype as any).releasePointerCapture = () => {};
    (HTMLElement.prototype as any).setPointerCapture = () => {};
  }
  if (!(HTMLElement.prototype as any).scrollIntoView) {
    (HTMLElement.prototype as any).scrollIntoView = () => {};
  }
});

const updateMock = vi.fn(async (_args: any) => ({ id: 'sig-1' }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      select: () => ({
        in: () => ({ is: () => Promise.resolve({ data: [], error: null }) }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'sig-1' }, error: null }),
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
  },
}));

const mockSignalen = [
  maakTestSignaal({ id: 'sig-1', adres: 'Fictiefstraat 1', plaats: 'Testdorp' } as any),
  maakTestSignaal({ id: 'sig-2', adres: 'Fictiefstraat 2', plaats: 'Testdorp' } as any),
  maakTestSignaal({ id: 'sig-3', adres: 'Fictiefstraat 3', plaats: 'Testdorp' } as any),
];

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectie: () => ({
    data: mockSignalen.map((s, i) => ({
      id: `r${i}`, signaal_id: s.id, archived_at: null,
      toegevoegd_op: `2026-06-2${i}T10:00:00Z`,
      toegevoegd_door: null, notitie: null,
    })),
    isLoading: false,
  }),
  useIsInAcquisitieSelectie: () => true,
  useActieveSelectieIds: () => new Set(mockSignalen.map((s) => s.id)),
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: mockSignalen }),
  useUpdateOffMarketSignaal: () => ({ mutateAsync: updateMock, isPending: false }),
  useArchiveOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    addTaak: vi.fn(), taken: [], relaties: [], getRelatieById: () => null,
  }),
}));

import AcquisitieSelectieTab
  from '@/components/offmarket/acquisitie/AcquisitieSelectieTab';

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => { updateMock.mockClear(); sessionStorage.clear(); });

describe('V48 Verwerk selectie — subset bij bulkselectie', () => {
  it('zonder selectie toont knop "Verwerk selectie"', async () => {
    render(wrap(<AcquisitieSelectieTab />));
    const knop = await screen.findByTestId('acquisitie-verwerk-selectie');
    expect(knop).toHaveTextContent('Verwerk selectie');
    expect(knop).not.toHaveTextContent(/geselecteerde/i);
  });

  it('met 2 geselecteerde rijen toont knop "Verwerk geselecteerde (2)" en focusmodus krijgt subset', async () => {
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const rijen = await screen.findAllByTestId('acquisitie-selectie-rij');
    expect(rijen.length).toBe(3);

    // Vink de eerste twee rijen aan.
    await user.click(within(rijen[0]).getByTestId('acquisitie-rij-bulkcheck'));
    await user.click(within(rijen[1]).getByTestId('acquisitie-rij-bulkcheck'));

    const knop = screen.getByTestId('acquisitie-verwerk-selectie');
    await waitFor(() => {
      expect(knop).toHaveTextContent('Verwerk geselecteerde (2)');
    });

    // Klik op de knop → focusmodus opent met teller "1 van 2".
    await user.click(knop);
    const focus = await screen.findByTestId('focus-modus');
    expect(within(focus).getByText(/Focus · 1 van 2/i)).toBeInTheDocument();
  });
});
