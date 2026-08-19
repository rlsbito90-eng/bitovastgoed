import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignalenTable from '@/components/offmarket/SignalenTable';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ relaties: [] }),
}));

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useActieveSelectieIds: () => new Set<string>(),
}));

vi.mock('@/components/offmarket/acquisitie/ToevoegenAanAcquisitieSelectieKnop', () => ({
  default: ({ signaalId }: { signaalId: string }) => <button type="button">Selectie {signaalId}</button>,
}));

function maakSignaal(index: number): OffMarketSignaal {
  return {
    id: `s${index}`,
    titel: `Signaal ${index}`,
    adres: `Teststraat ${index}`,
    postcode: '5000 AA',
    plaats: 'Tilburg',
    provincie: 'Noord-Brabant',
    bron_type: 'bekendmaking',
    type_signaal: 'vergunning_bekendmaking',
    status: 'nieuw_signaal',
    prioriteit: 'laag',
    ai_status: 'niet_verrijkt',
    ai_score: 50,
    vergunningtype: 'splitsing',
    aanvraag_of_besluit: 'aanvraag',
    bron_datum: '2026-08-19',
    created_at: '2026-08-19T00:00:00Z',
    eigenaar_relatie_id: null,
    eigenaarstatus: 'onbekend',
  } as unknown as OffMarketSignaal;
}

function lijstElement(signalen: OffMarketSignaal[], highlightedId?: string | null) {
  return (
    <MemoryRouter>
      <SignalenTable signalen={signalen} laden={false} highlightedId={highlightedId} />
    </MemoryRouter>
  );
}

function renderLijst(signalen: OffMarketSignaal[], highlightedId?: string | null) {
  return render(lijstElement(signalen, highlightedId));
}

describe('SignalenTable — progressieve render', () => {
  it('rendert grote lijsten eerst in een begrensde tranche en kan daarna uitbreiden', () => {
    renderLijst(Array.from({ length: 120 }, (_, i) => maakSignaal(i)));

    expect(screen.getByText('100 van 120 signalen weergegeven')).toBeTruthy();
    expect(document.querySelector('[data-row-id="s99"]')).toBeTruthy();
    expect(document.querySelector('[data-row-id="s100"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Meer signalen laden' }));

    expect(screen.getByText('120 van 120 signalen weergegeven')).toBeTruthy();
    expect(document.querySelector('[data-row-id="s119"]')).toBeTruthy();
  });

  it('houdt een diep laatst bekeken signaal gerenderd nadat de tijdelijke highlight verdwijnt', () => {
    const signalen = Array.from({ length: 250 }, (_, i) => maakSignaal(i));
    const { rerender } = renderLijst(signalen, 's219');

    expect(screen.queryByText('300 van 250 signalen weergegeven')).toBeNull();
    expect(screen.getByText('250 van 250 signalen weergegeven')).toBeTruthy();
    expect(document.querySelector('[data-row-id="s219"]')).toBeTruthy();

    rerender(lijstElement(signalen, null));

    expect(screen.getByText('250 van 250 signalen weergegeven')).toBeTruthy();
    expect(document.querySelector('[data-row-id="s219"]')).toBeTruthy();
  });

  it('mount per breakpoint maar één rijboom', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 640px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      renderLijst([maakSignaal(0)]);
      expect(document.querySelectorAll('[data-row-id="s0"]')).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Selectie s0' })).toHaveLength(1);
      expect(screen.getByRole('columnheader', { name: 'Sel.' })).toBeTruthy();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
