// Verifieert dat de cockpit lange strategieteksten netjes toont met een
// "Meer tonen"-toggle in plaats van hard af te kappen met "…".
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import { maakTestSignaal } from './_fixture';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const LANG =
  'Focus op advisering bij exit-strategie: uitpond-scenario (verkoop per appartementsrecht) versus integrale verkoop aan een belegger met behoud van zittend huurderbestand.';

describe('SignaalMobileCockpit — strategie zonder harde afkapping', () => {
  it('toont volledige strategietekst (geen "…"-truncation) en biedt Meer/Minder toggle', () => {
    render(
      <MemoryRouter>
        <SignaalMobileCockpit
          signaal={maakTestSignaal({ ai_strategie_suggestie: LANG, potentiele_strategie: null } as any)}
          taken={[]}
          briefStatus="geen"
        />
      </MemoryRouter>,
    );
    // Volledige tekst staat in DOM
    expect(screen.getByText(LANG)).toBeInTheDocument();
    // Meer-tonen knop is aanwezig
    const knop = screen.getByRole('button', { name: /meer tonen/i });
    fireEvent.click(knop);
    expect(screen.getByRole('button', { name: /minder tonen/i })).toBeInTheDocument();
  });

  it('toont "Nog te bepalen" wanneer er geen strategie is', () => {
    render(
      <MemoryRouter>
        <SignaalMobileCockpit
          signaal={maakTestSignaal({ potentiele_strategie: null, ai_strategie_suggestie: null } as any)}
          taken={[]}
          briefStatus="geen"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nog te bepalen')).toBeInTheDocument();
  });
});
