// V34 — Mobiele hoofdtabbar mag uitsluitend horizontaal scrollen binnen de tabviewport.
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
  it('buitenste viewport: w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden, geen min-w-max, geen pan-x', () => {
    renderPage();
    const viewport = screen.getByTestId('off-market-hoofd-tabbar');
    expect(viewport.className).toMatch(/w-full/);
    expect(viewport.className).toMatch(/min-w-0/);
    expect(viewport.className).toMatch(/max-w-full/);
    expect(viewport.className).toMatch(/overflow-x-auto/);
    expect(viewport.className).toMatch(/overflow-y-hidden/);
    expect(viewport.className).not.toMatch(/min-w-max/);
    expect((viewport as HTMLElement).style.touchAction || '').toBe('');
  });

  it('binnenste tabtrack: inline-flex flex-nowrap min-w-max', () => {
    renderPage();
    const track = screen.getByTestId('off-market-hoofd-tabbar-track');
    expect(track.className).toMatch(/inline-flex/);
    expect(track.className).toMatch(/flex-nowrap/);
    expect(track.className).toMatch(/min-w-max/);
  });

  it('rendert alle vier hoofdtabs', () => {
    renderPage();
    expect(screen.getByTestId('off-market-tab-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('off-market-tab-signalen')).toBeInTheDocument();
    expect(screen.getByTestId('off-market-tab-kaart')).toBeInTheDocument();
    expect(screen.getByTestId('off-market-tab-acquisitieselectie')).toBeInTheDocument();
  });
});
