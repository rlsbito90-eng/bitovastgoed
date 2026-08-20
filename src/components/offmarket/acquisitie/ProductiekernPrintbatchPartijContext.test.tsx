import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockPartij = {
  key: 'bedrijf:voorbeeld bv',
  naam: 'Voorbeeld B.V.',
  soort: 'bedrijf',
  verzendadres: 'Herengracht 1',
  objecten: [{ signaalId: 's1' }, { signaalId: 's2' }],
  briefAantal: 2,
  verstuurdAantal: 1,
  laatsteContactOp: '2026-06-29',
  laatsteContactSignaalId: 's1',
  laatsteContactObjectAdres: 'Van Baerlestraat 16 · Amsterdam',
  laatsteRespons: 'later_opnieuw_benaderen',
  laatsteResponsOp: '2026-07-02',
  laatsteResponsSignaalId: 's1',
  laatsteResponsObjectAdres: 'Van Baerlestraat 16 · Amsterdam',
  advies: 'recent_benaderd',
};

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: [] }),
}));
vi.mock('@/hooks/useAcquisitiePartijOverzicht', () => ({
  useAcquisitiePartijOverzicht: () => ({
    alleBrieven: [{ briefnummer: 'BR2026000010', eigenaar_naam: null, eigenaar_bedrijfsnaam: 'Voorbeeld B.V.', verzendadres: 'Herengracht 1' }],
    perKey: new Map([['bedrijf:voorbeeld bv', mockPartij]]),
  }),
}));

import ProductiekernPrintbatchPartijContext from './ProductiekernPrintbatchPartijContext';

describe('ProductiekernPrintbatchPartijContext', () => {
  it('toont partij, eerdere benadering, laatste contact en reactie bij bestaande batch', () => {
    render(<ProductiekernPrintbatchPartijContext briefnummer="BR2026000010" />);

    const context = screen.getByTestId('printbatch-partijcontext-BR2026000010');
    expect(context).toHaveTextContent('Bekende partij · 2 objecten');
    expect(context).toHaveTextContent('Eerder benaderd');
    expect(context).toHaveTextContent('Laatste partijcontact');
    expect(context).toHaveTextContent('Van Baerlestraat 16');
    expect(context).toHaveTextContent('Laatste reactie: Later opnieuw benaderen');
  });

  it('rendert niets wanneer het BR-nummer niet aan een bekende bronbrief gekoppeld kan worden', () => {
    const { container } = render(<ProductiekernPrintbatchPartijContext briefnummer="BR-ONBEKEND" />);
    expect(container).toBeEmptyDOMElement();
  });
});
