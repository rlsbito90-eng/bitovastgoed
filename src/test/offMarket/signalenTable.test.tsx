import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignalenTable, { STANDAARD_ZICHTBARE_KOLOMMEN, SIGNALEN_KOLOMMEN } from '@/components/offmarket/SignalenTable';
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
  eigenaarstatus: 'te_onderzoeken',
} as unknown as OffMarketSignaal;

function renderTable(signalen: OffMarketSignaal[], zichtbareKolommen?: string[]) {
  return render(
    <MemoryRouter>
      <SignalenTable signalen={signalen} laden={false} zichtbareKolommen={zichtbareKolommen} />
    </MemoryRouter>,
  );
}

describe('SignalenTable — kolomconfiguratie', () => {
  it('standaard zichtbare kolommen kloppen', () => {
    expect(STANDAARD_ZICHTBARE_KOLOMMEN).toEqual([
      'vergunningtype', 'adres', 'plaats', 'ai_score', 'status', 'eigenaar', 'brondatum',
    ]);
  });

  it('alle gedefinieerde kolommen hebben een unieke id en label', () => {
    const ids = SIGNALEN_KOLOMMEN.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    SIGNALEN_KOLOMMEN.forEach(k => expect(k.label.length).toBeGreaterThan(0));
  });
});

describe('SignalenTable — standaard acquisitie-grid', () => {
  it('rendert standaard alleen de gewenste kolommen', () => {
    renderTable([baseSignaal]);
    ['Vergunningtype', 'Adres', 'Plaats', 'AI-score', 'Status', 'Eigenaar', 'Brondatum'].forEach(label => {
      expect(screen.getByRole('columnheader', { name: new RegExp(`^${label}$`, 'i') })).toBeTruthy();
    });
  });

  it('verbergt standaard de optionele kolommen', () => {
    renderTable([baseSignaal]);
    ['Aanvraag/Besluit', 'Relatie', 'Prioriteit', 'AI-status', 'Bron', 'Postcode', 'Provincie', 'Assettype', 'Mogelijke fee', 'Volgende actie']
      .forEach(label => {
        expect(screen.queryByRole('columnheader', { name: new RegExp(`^${label}$`, 'i') })).toBeNull();
      });
  });

  it('toont adres zonder postcode in de standaard adres-cel', () => {
    renderTable([baseSignaal]);
    expect(screen.getAllByText('Hoofdweg 160').length).toBeGreaterThan(0);
    // Postcode mag niet in de desktop-grid verschijnen
    const desktop = document.querySelector('.hidden.sm\\:block');
    expect(desktop?.textContent ?? '').not.toContain('1057 DB');
  });

  it('rendert vergunningtype-label', () => {
    renderTable([baseSignaal]);
    expect(screen.getAllByText('Splitsing').length).toBeGreaterThan(0);
  });

  it('Eigenaar-kolom toont eigenaarstatus-label', () => {
    renderTable([baseSignaal]);
    // Desktop badge + mobile badge — beide tonen "Te onderzoeken"
    expect(screen.getAllByText('Te onderzoeken').length).toBeGreaterThan(0);
  });

  it('Eigenaar-kolom toont "Onbekend" bij ontbrekende eigenaarstatus', () => {
    const s = { ...baseSignaal, eigenaarstatus: undefined } as unknown as OffMarketSignaal;
    renderTable([s]);
    expect(screen.getAllByText('Onbekend').length).toBeGreaterThan(0);
  });

  it('toont verborgen kolom wel wanneer expliciet meegegeven', () => {
    renderTable([baseSignaal], ['adres', 'postcode', 'bron']);
    expect(screen.getByRole('columnheader', { name: /Postcode/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Bron/i })).toBeTruthy();
  });
});
