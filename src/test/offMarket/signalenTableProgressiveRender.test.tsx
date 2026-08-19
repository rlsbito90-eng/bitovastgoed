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

function renderLijst(signalen: OffMarketSignaal[], highlightedId?: string | null) {
  return render(
    <MemoryRouter>
      <SignalenTable signalen={signalen} laden={false} highlightedId={highlightedId} />
    </MemoryRouter>,
  );
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

  it('rendert een diep laatst bekeken signaal direct zodat terugnavigatie het kan herstellen', () => {
    renderLijst(Array.from({ length: 250 }, (_, i) => maakSignaal(i)), 's219');

    expect(screen.getByText('300 van 250 signalen weergegeven')).toBeFalsy();
    expect(screen.getByText('250 van 250 signalen weergegeven')).toBeTruthy();
    expect(document.querySelector('[data-row-id="s219"]')).toBeTruthy();
  });
});
