// V34 — Mobiele hoofdtabbar mag uitsluitend horizontaal scrollen.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectieCount: () => 0,
}));
vi.mock('@/components/offmarket/SignalenTable', () => ({ default: () => null }));
vi.mock('@/components/offmarket/OffMarketKpi', () => ({ default: () => null }));
vi.mock('@/components/offmarket/kaart/OffMarketKaart', () => ({ default: () => null }));
vi.mock('@/components/offmarket/SignaalFormDialog', () => ({ default: () => null }));
vi.mock('@/components/offmarket/acquisitie/AcquisitieSelectieTab', () => ({ default: () => null }));

import OffMarketPage from '@/pages/OffMarketPage';

function renderPage() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OffMarketPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OffMarketHoofdTabbar', () => {
  it('heeft horizontale en geen verticale overflow', () => {
    renderPage();
    const bar = screen.getByTestId('off-market-hoofd-tabbar');
    expect(bar.className).toMatch(/overflow-x-auto/);
    expect(bar.className).toMatch(/overflow-y-hidden/);
    expect(bar.className).toMatch(/flex-nowrap/);
    expect(bar.className).toMatch(/min-w-max/);
    // touch-action en overscroll-behavior gezet via inline style.
    expect((bar as HTMLElement).style.touchAction).toBe('pan-x');
    expect((bar as HTMLElement).style.overscrollBehaviorX).toBe('contain');
  });

  it('rendert alle vier hoofdtabs', () => {
    renderPage();
    expect(screen.getByTestId('off-market-tab-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('off-market-tab-signalen')).toBeInTheDocument();
    expect(screen.getByTestId('off-market-tab-kaart')).toBeInTheDocument();
    expect(screen.getByTestId('off-market-tab-acquisitieselectie')).toBeInTheDocument();
  });
});
