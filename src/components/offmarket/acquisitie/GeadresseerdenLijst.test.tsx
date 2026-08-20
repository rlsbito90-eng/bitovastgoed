import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartijOverzicht } from '@/lib/offMarket/acquisitie/partijOverzicht';
import GeadresseerdenLijst from './GeadresseerdenLijst';

const useOffMarketSignalenMock = vi.fn();
const useAcquisitiePartijOverzichtMock = vi.fn();

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => useOffMarketSignalenMock(),
}));

vi.mock('@/hooks/useAcquisitiePartijOverzicht', () => ({
  useAcquisitiePartijOverzicht: (...args: unknown[]) => useAcquisitiePartijOverzichtMock(...args),
}));

function partij(objectAantal: number): PartijOverzicht {
  return {
    key: 'bedrijf:voorbeeld bv',
    naam: 'Voorbeeld B.V.',
    soort: 'bedrijf',
    verzendadres: 'Straat 1 1234 AB Plaats',
    objecten: Array.from({ length: objectAantal }, (_, index) => ({
      signaalId: `s${index + 1}`,
      adres: `Object ${index + 1}`,
      typeSignaal: 'splitsing',
      status: 'interessant',
    })),
    briefAantal: 0,
    verstuurdAantal: 0,
    laatsteContactOp: null,
    laatsteRespons: null,
    laatsteResponsOp: null,
    advies: objectAantal >= 2 ? 'portefeuille' : 'normaal',
  };
}

describe('GeadresseerdenLijst', () => {
  beforeEach(() => {
    useOffMarketSignalenMock.mockReturnValue({ data: [] });
    useAcquisitiePartijOverzichtMock.mockReturnValue({ perKey: new Map() });
  });

  it('toont alle geadresseerden direct zonder inklapbediening', () => {
    render(
      <GeadresseerdenLijst
        geadresseerden={[
          {
            key: 'persoon-1',
            naam: 'Mevrouw Jansen',
            bedrijfsnaam: null,
            verzendadres: 'Straat 1\n1234 AB Plaats',
            volledigPostadres: true,
          },
          {
            key: 'bedrijf-1',
            naam: null,
            bedrijfsnaam: 'Voorbeeld B.V.',
            verzendadres: null,
            volledigPostadres: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('M. Jansen')).toBeVisible();
    expect(screen.getByText('Voorbeeld B.V.')).toBeVisible();
    expect(screen.getByText(/Straat 1 1234 AB Plaats/)).toBeVisible();
    expect(screen.getByText('Postadres ontbreekt')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('markeert een partij duidelijk wanneer die aan twee of meer objecten is gekoppeld', () => {
    useAcquisitiePartijOverzichtMock.mockReturnValue({
      perKey: new Map([['bedrijf:voorbeeld bv', partij(4)]]),
    });

    render(
      <GeadresseerdenLijst
        geadresseerden={[{
          key: 'bedrijf-1',
          naam: null,
          bedrijfsnaam: 'Voorbeeld B.V.',
          verzendadres: 'Straat 1 1234 AB Plaats',
          volledigPostadres: true,
        }]}
      />,
    );

    expect(screen.getByTestId('acquisitie-rij-bekende-partij')).toHaveTextContent('Bekende partij · 4 objecten');
  });

  it('toont geen bekende-partijmarkering bij slechts één object', () => {
    useAcquisitiePartijOverzichtMock.mockReturnValue({
      perKey: new Map([['bedrijf:voorbeeld bv', partij(1)]]),
    });

    render(
      <GeadresseerdenLijst
        geadresseerden={[{
          key: 'bedrijf-1',
          naam: null,
          bedrijfsnaam: 'Voorbeeld B.V.',
          verzendadres: 'Straat 1 1234 AB Plaats',
          volledigPostadres: true,
        }]}
      />,
    );

    expect(screen.queryByTestId('acquisitie-rij-bekende-partij')).not.toBeInTheDocument();
  });

  it('rendert niets zonder geadresseerden', () => {
    const { container } = render(<GeadresseerdenLijst geadresseerden={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
