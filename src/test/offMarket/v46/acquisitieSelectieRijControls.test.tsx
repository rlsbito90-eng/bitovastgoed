import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AcquisitieSelectieTab from '@/components/offmarket/acquisitie/AcquisitieSelectieTab';

const updateMock = vi.fn(async (_args: any) => ({ id: 'sig-1' }));
let mockTaken: any[] = [];
let mockBrieven: any[] = [];

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({
    data: [{
      id: 'sig-1', titel: 'Test', adres: 'Teststraat 1', plaats: 'Amsterdam',
      status: 'nieuw_signaal', prioriteit: 'midden', eigenaarstatus: 'onbekend',
      acquisitie_geselecteerd: true,
    }],
    isLoading: false,
  }),
  useUpdateOffMarketSignaal: () => ({ mutateAsync: updateMock, isPending: false }),
}));

vi.mock('@/hooks/useOffMarketBrieven', () => ({
  useOffMarketBrieven: () => ({ data: mockBrieven, isLoading: false }),
  useOffMarketBrievenForSignaal: () => ({ data: mockBrieven, isLoading: false }),
}));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ taken: mockTaken }),
}));

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectie: () => ({
    data: [{ signaal_id: 'sig-1', status: 'actief' }],
    isLoading: false,
  }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
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

  it('eigenaarstatus is identificatiegericht en wijzigt naar gevonden', async () => {
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const trigger = await screen.findByTestId('eigenaarstatus-wijzig-dropdown');
    await user.click(trigger);
    expect(screen.queryByTestId('eigenaarstatus-optie-benaderd')).not.toBeInTheDocument();
    await user.click(await screen.findByTestId('eigenaarstatus-optie-gevonden'));
    await waitFor(() => {
      expect(updateMock.mock.calls.some((c) => c[0]?.patch?.eigenaarstatus === 'gevonden')).toBe(true);
    });
  });

  it('status wijzigen roept update aan met { status }', async () => {
    const user = userEvent.setup();
    render(wrap(<AcquisitieSelectieTab />));
    const trigger = await screen.findByTestId('status-wijzig-compact');
    await user.click(trigger);
    const opt = await screen.findByTestId('status-optie-te_onderzoeken');
    await user.click(opt);
    await waitFor(() => {
      expect(updateMock.mock.calls.some((c) => typeof c[0]?.patch?.status === 'string')).toBe(true);
    });
  });
});
