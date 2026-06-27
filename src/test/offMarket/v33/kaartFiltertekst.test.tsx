// V33 — Bevestigt dat de kaarttabtekst "X signalen binnen filters" toont,
// en nergens meer suggereert dat dit Acquisitieselectie is.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useAcquisitieSelectie: () => ({ data: [], isLoading: false }),
  useAcquisitieSelectieCount: () => 0,
  useActieveSelectieIds: () => new Set<string>(),
  useIsInAcquisitieSelectie: () => false,
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/components/offmarket/kaart/OffMarketKaart', () => ({
  default: () => <div data-testid="off-market-kaart-mock" />,
}));
vi.mock('@/components/offmarket/OffMarketKpi', () => ({
  default: () => <div />,
}));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ taken: [] }),
}));

import OffMarketPage from '@/pages/OffMarketPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try { sessionStorage.setItem('off-market-filter:tab', 'kaart'); } catch {}
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OffMarketPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OffMarket kaart-tab: filtertekst', () => {
  it('toont "signalen binnen filters" en niet "signalen in selectie"', () => {
    renderPage();
    const node = screen.getByTestId('kaart-filtertotaal');
    expect(node.textContent).toMatch(/signalen binnen filters/i);
    expect(node.textContent).not.toMatch(/in selectie/i);
  });

  it('hoofdtabbar bevat zowel mobiel "Selectie" als desktop "Acquisitieselectie" label', () => {
    renderPage();
    const tab = screen.getByTestId('off-market-tab-acquisitieselectie');
    // Beide spans zijn in de DOM (CSS verbergt één), dus beide teksten staan in textContent.
    expect(tab.textContent).toMatch(/Selectie \(0\)/);
    expect(tab.textContent).toMatch(/Acquisitieselectie \(0\)/);
  });

  it('klik op selectie-tab toont AcquisitieSelectieTab', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('off-market-tab-acquisitieselectie'));
    expect(screen.getByText(/Nog geen signalen in selectie/i)).toBeInTheDocument();
  });
});
