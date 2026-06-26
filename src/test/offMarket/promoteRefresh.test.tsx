import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import SignaalKoppelingenSectie from '@/components/offmarket/SignaalKoppelingenSectie';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const mocks = vi.hoisted(() => ({
  promoteMutateAsync: vi.fn(),
  linkMutateAsync: vi.fn(),
  navigate: vi.fn(),
  refreshDataStore: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...p }: any) => <a {...p}>{children}</a>,
  useNavigate: () => mocks.navigate,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    relaties: [],
    contactpersonen: [],
    getObjectById: () => null,
    refresh: mocks.refreshDataStore,
  }),
}));

vi.mock('@/hooks/useKadasterDataRecords', () => ({
  useKadasterDataRecordsForSignaal: () => ({ data: [] }),
}));

vi.mock('@/hooks/useOffMarketLinks', () => ({
  useLinkRelatieToSignaal: () => ({ isPending: false, mutateAsync: mocks.linkMutateAsync }),
  usePromoteSignaalToObject: () => ({ isPending: false, mutateAsync: mocks.promoteMutateAsync }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const baseSignaal = {
  id: 'sig-1',
  status: 'nieuw_signaal',
} as unknown as OffMarketSignaal;

beforeEach(() => {
  mocks.promoteMutateAsync.mockReset();
  mocks.navigate.mockReset();
  mocks.refreshDataStore.mockReset();
  mocks.linkMutateAsync.mockReset();
});

describe('SignaalKoppelingenSectie — promotie-refresh vóór navigatie', () => {
  it('wacht op store.refresh() vóór het navigeren naar het nieuwe object', async () => {
    let refreshResolved = false;
    mocks.refreshDataStore.mockImplementation(() =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          refreshResolved = true;
          resolve();
        }, 50);
      }),
    );

    mocks.promoteMutateAsync.mockResolvedValue({
      objectId: 'obj-new-1',
      kadasterMigrated: 0,
      kadasterMigrationError: null,
      kadasterDocumentenMigrated: 0,
      kadasterDocumentenMigrationError: null,
    });

    render(<SignaalKoppelingenSectie signaal={baseSignaal} />, { wrapper });

    // Open promote-dialog en bevestig
    fireEvent.click(screen.getByRole('button', { name: /Omzetten naar object/i }));
    fireEvent.click(screen.getByRole('button', { name: /Omzetten naar object/i }));

    // refresh mag op dat moment nog niet resolved zijn
    expect(refreshResolved).toBe(false);

    // navigatie mag nog niet zijn aangeroepen
    expect(mocks.navigate).not.toHaveBeenCalled();

    // wacht tot async afgehandeld is
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/objecten/obj-new-1'));

    // pas ná refresh is de navigatie uitgevoerd
    expect(refreshResolved).toBe(true);
  });

  it('navigeert niet bij een mislukte promotie, zelfs niet na refresh', async () => {
    mocks.refreshDataStore.mockResolvedValue(undefined);
    mocks.promoteMutateAsync.mockRejectedValue(new Error('RPC-fout'));

    render(<SignaalKoppelingenSectie signaal={baseSignaal} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /Omzetten naar object/i }));
    fireEvent.click(screen.getByRole('button', { name: /Omzetten naar object/i }));

    await waitFor(() => expect(mocks.promoteMutateAsync).toHaveBeenCalled());

    expect(mocks.refreshDataStore).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
