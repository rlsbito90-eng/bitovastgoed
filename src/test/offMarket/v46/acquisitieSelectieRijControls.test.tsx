// V46 — Acquisitieselectie-rij: inline dropdowns voor status/prioriteit/
// eigenaarstatus + read-only briefstatus met verzendtelling.
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

let mockBrieven: any[] = [];
let mockTaken: any[] = [];
const updateMock = vi.fn(async (_args: any) => ({ id: 'sig-1' }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (_tbl: string) => ({
      select: () => ({
        in: () => ({ is: () => Promise.resolve({ data: mockBrieven, error: null }) }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      update: (patch: any) => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              await updateMock({ patch });
              return { data: { id: 'sig-1', ...patch }, error: null };
            },
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
  },
}));

const mockSignalen = [
  maakTestSignaal({
    id: 'sig-1',
    adres: 'Fictiefstraat 1',
    plaats: 'Testdorp',
    prioriteit: 'midden',
    eigenaarstatus: 'gevonden',
  } as any),
];

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectie: () => ({
    data: [{ id: 'r1', signaal_id: 'sig-1', archived_at: null, toegevoegd_op: '2026-06-20T10:00:00Z', toegevoegd_door: null, notitie: null }],
    isLoading: false,
  }),
  useIsInAcquisitieSelectie: () => true,
  useActieveSelectieIds: () => new Set(['sig-1']),
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
    addTaak: vi.fn(),
    taken: mockTaken,
    relaties: [],
    getRelatieById: () => null,
  }),
}));

import AcquisitieSelectieTab from '@/components/offmarket/acquisitie/AcquisitieSelectieTab';

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

function brief(overrides: any) {
  return {
    id: overrides.id ?? `b-${Math.random().toString(36).slice(2, 8)}`,
    signaal_id: 'sig-1',
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: null,
    verzendadres: null,
    objectadres: null,
    objectomschrijving: null,
    aanhef: null,
    onderwerp: null,
    brieftekst: 't',
    status: 'concept',
    verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: 'brief_1',
    geadresseerde_key: 'g-1',
    ...overrides,
  };
}

beforeEach(() => {
  updateMock.mockClear();
  mockTaken = [];
  mockBrieven = [];
});

describe('V46 AcquisitieSelectieTab — rij-controls', () => {
  it('rendert inline status/prioriteit/eigenaarstatus dropdowns', async () => {
    render(wrap(<AcquisitieSelectieTab />));
    const rij = await screen.findByTestId('acquisitie-selectie-rij');
    expect(within(rij).getByTestId('status-wijzig-compact')).toBeInTheDocument();
    expect(within(rij).getByTestId('prioriteit-wijzig-dropdown')).toBeInTheDocument();
    expect(within(rij).getByTestId('eigenaarstatus-wijzig-dropdown')).toBeInTheDocument();
  });

  it('prioriteit wijzigen roept update aan met { prioriteit }', async () => {
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const trigger = await screen.findByTestId('prioriteit-wijzig-dropdown');
    await user.click(trigger);
    await user.click(await screen.findByTestId('prioriteit-optie-urgent'));
    await waitFor(() => {
      expect(updateMock.mock.calls.some((c) => c[0]?.patch?.prioriteit === 'urgent')).toBe(true);
    });
  });

  it('eigenaarstatus wijzigen roept update aan met { eigenaarstatus }', async () => {
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const trigger = await screen.findByTestId('eigenaarstatus-wijzig-dropdown');
    await user.click(trigger);
    await user.click(await screen.findByTestId('eigenaarstatus-optie-benaderd'));
    await waitFor(() => {
      expect(updateMock.mock.calls.some((c) => c[0]?.patch?.eigenaarstatus === 'benaderd')).toBe(true);
    });
  });

  it('status wijzigen roept update aan met { status }', async () => {
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const trigger = await screen.findByTestId('status-wijzig-compact');
    await user.click(trigger);
    // Kies een willekeurige niet-huidige optie
    const opt = await screen.findByTestId('status-optie-actief_in_onderzoek');
    await user.click(opt);
    await waitFor(() => {
      expect(updateMock.mock.calls.some((c) => typeof c[0]?.patch?.status === 'string')).toBe(true);
    });
  });

  it('toont "Geen brief" zonder telling bij 0 brieven', async () => {
    mockBrieven = [];
    render(wrap(<AcquisitieSelectieTab />));
    const cel = await screen.findByTestId('acquisitie-rij-briefstatus');
    expect(within(cel).getByText('Geen brief')).toBeInTheDocument();
    expect(within(cel).queryByText(/0\//)).toBeNull();
  });

  it('toont "Verstuurd 1/4" bij 1 verzonden brief en 4 geadresseerden', async () => {
    mockBrieven = [
      brief({ id: 'b1', status: 'verstuurd', verzonden_op: '2026-06-21T10:00:00Z', geadresseerde_key: 'g-1' }),
      brief({ id: 'b2', status: 'concept', geadresseerde_key: 'g-2' }),
      brief({ id: 'b3', status: 'concept', geadresseerde_key: 'g-3' }),
      brief({ id: 'b4', status: 'concept', geadresseerde_key: 'g-4' }),
    ];
    render(wrap(<AcquisitieSelectieTab />));
    const cel = await screen.findByTestId('acquisitie-rij-briefstatus');
    await waitFor(() => {
      expect(within(cel).getByText('1/4')).toBeInTheDocument();
    });
    expect(within(cel).getByText(/Brief 1 verstuurd/i)).toBeInTheDocument();
  });

  it('toont "Opvolging nodig" bij brief2_gepland', async () => {
    mockBrieven = [
      brief({ id: 'b1', status: 'verstuurd', verzonden_op: '2026-06-21T10:00:00Z', geadresseerde_key: 'g-1' }),
    ];
    mockTaken = [{
      id: 't1', titel: 'Brief 2 opvolgen', status: 'open',
      offMarketSignaalId: 'sig-1', softDeletedAt: null, deadline: '2026-07-15',
    }];
    render(wrap(<AcquisitieSelectieTab />));
    const cel = await screen.findByTestId('acquisitie-rij-briefstatus');
    await waitFor(() => {
      expect(within(cel).getByText('Opvolging nodig')).toBeInTheDocument();
    });
  });

  it('klik op briefstatus-badge doet GEEN update-call', async () => {
    mockBrieven = [];
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const cel = await screen.findByTestId('acquisitie-rij-briefstatus');
    await user.click(cel);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
