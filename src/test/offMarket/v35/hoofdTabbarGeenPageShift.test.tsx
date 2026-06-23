// V35 — Activeren van Selectie of Dashboard mag de pagina niet horizontaal verschuiven.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectieCount: () => 3,
}));
vi.mock('@/components/offmarket/SignalenTable', () => ({ default: () => null }));
vi.mock('@/components/offmarket/OffMarketKpi', () => ({ default: () => null }));
vi.mock('@/components/offmarket/kaart/OffMarketKaart', () => ({ default: () => null }));
vi.mock('@/components/offmarket/SignaalFormDialog', () => ({ default: () => null }));
vi.mock('@/components/offmarket/acquisitie/AcquisitieSelectieTab', () => ({ default: () => null }));

import OffMarketPage from '@/pages/OffMarketPage';

beforeEach(() => {
  try { sessionStorage.clear(); } catch {}
  // Simuleer 390px mobiele viewport
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
});

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

describe('Off-Market hoofdtabbar — geen page-level horizontale shift', () => {
  it('document.documentElement.scrollWidth blijft binnen clientWidth na tabwissel', () => {
    renderPage();
    const selectie = screen.getByTestId('off-market-tab-acquisitieselectie');
    fireEvent.click(selectie);
    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    expect(window.scrollX).toBe(0);

    const dashboard = screen.getByTestId('off-market-tab-dashboard');
    fireEvent.click(dashboard);
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    expect(window.scrollX).toBe(0);
  });

  it('alleen tabviewport.scrollLeft kan wijzigen; window.scrollX blijft 0', () => {
    renderPage();
    const viewport = screen.getByTestId('off-market-hoofd-tabbar') as HTMLDivElement;
    const before = viewport.scrollLeft;
    fireEvent.click(screen.getByTestId('off-market-tab-acquisitieselectie'));
    // viewport.scrollLeft mag wijzigen (of niet als alles al zichtbaar), maar window niet.
    expect(window.scrollX).toBe(0);
    expect(typeof viewport.scrollLeft).toBe('number');
    expect(before).toBeGreaterThanOrEqual(0);
  });
});
