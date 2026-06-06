import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignalenTable from '@/components/offmarket/SignalenTable';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ relaties: [] }),
}));

const baseSignaal = {
  id: 's1',
  titel: 'Aanvraag splitsingsvergunning Hoofdweg 160-H 1057 DB Amsterdam',
  adres: 'Hoofdweg 160',
  postcode: '1057 DB',
  plaats: 'Amsterdam',
  provincie: 'Noord-Holland',
  assettype: 'woon_winkelpand',
  bron_type: 'bekendmaking',
  type_signaal: 'vergunning_bekendmaking',
  status: 'nieuw_signaal',
  prioriteit: 'laag',
  ai_status: 'niet_verrijkt',
  ai_score: 72,
  vergunningtype: 'splitsing',
  aanvraag_of_besluit: 'aanvraag',
  bron_datum: '2026-06-01',
  created_at: '2026-06-01T00:00:00Z',
  mogelijke_fee: 50000,
  eigenaar_bekend: false,
  eigenaar_relatie_id: null,
} as unknown as OffMarketSignaal;

function renderTable(signalen: OffMarketSignaal[]) {
  return render(
    <MemoryRouter>
      <SignalenTable signalen={signalen} laden={false} />
    </MemoryRouter>,
  );
}

describe('SignalenTable — acquisitie-grid', () => {
  it('rendert geen Mogelijke fee-kolom in de header', () => {
    renderTable([baseSignaal]);
    expect(screen.queryByText(/Mogelijke fee/i)).toBeNull();
  });

  it('rendert geen Prioriteit / AI-status / Volgende actie als hoofdkolom', () => {
    renderTable([baseSignaal]);
    expect(screen.queryByRole('columnheader', { name: /Prioriteit/i })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /AI-status/i })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Volgende actie/i })).toBeNull();
  });

  it('toont de nieuwe acquisitiekolommen', () => {
    renderTable([baseSignaal]);
    expect(screen.getByRole('columnheader', { name: /Vergunningtype/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Aanvraag\/Besluit/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Adres/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Plaats/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Eigenaar/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Relatie/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Brondatum/i })).toBeTruthy();
  });

  it('toont vergunningtype-label en adres in de cel', () => {
    renderTable([baseSignaal]);
    expect(screen.getAllByText('Splitsing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hoofdweg 160').length).toBeGreaterThan(0);
  });
});
