// V33 — Mobiele cockpit bevat selectie-actie met zichtbaar tekstlabel,
// in dezelfde actie-zone als de bestaande taakacties.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useIsInAcquisitieSelectie: () => false,
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/offmarket/overzicht/StatusWijzigDropdown', () => ({
  default: () => <div data-testid="status-dropdown-mock">Status</div>,
}));

import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';

const sig: any = {
  id: 'sig-cockpit',
  type_signaal: 'vergunning',
  assettype: 'woning',
  status: 'nieuw',
  prioriteit: 'laag',
  ai_score: 80,
  ai_verkoopkans: 0.7,
  potentiele_strategie: 'Aanschrijven',
  bag_status: 'niet_verrijkt',
  eigenaarstatus: 'onbekend',
  geo_status: 'niet_verrijkt',
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignaalMobileCockpit — acquisitie-selectie actie', () => {
  it('toont selectieknop met tekst in mobile-cockpit-acties', () => {
    render(wrap(<SignaalMobileCockpit signaal={sig} taken={[]} briefStatus="geen" />));
    const acties = screen.getByTestId('mobile-cockpit-acties');
    const knop = screen.getByTestId('acquisitie-selectie-toggle');
    expect(acties.contains(knop)).toBe(true);
    expect(knop.textContent).toMatch(/Toevoegen/i);
    expect(knop.getAttribute('data-variant')).toBe('compact');
  });

  it('verstoort de statusdropdown niet (apart container)', () => {
    render(wrap(<SignaalMobileCockpit signaal={sig} taken={[]} briefStatus="geen" />));
    expect(screen.getByTestId('status-dropdown-mock')).toBeInTheDocument();
    expect(screen.getByTestId('acquisitie-selectie-toggle')).toBeInTheDocument();
  });
});
