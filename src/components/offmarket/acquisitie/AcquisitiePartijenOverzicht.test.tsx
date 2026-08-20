import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PartijOverzicht } from '@/lib/offMarket/acquisitie/partijOverzicht';
import AcquisitiePartijenOverzicht from './AcquisitiePartijenOverzicht';

function partij(naam: string, objectAantal: number): PartijOverzicht {
  return {
    key: `bedrijf:${naam.toLowerCase()}`,
    naam,
    soort: 'bedrijf',
    verzendadres: null,
    objecten: Array.from({ length: objectAantal }, (_, index) => ({
      signaalId: `${naam}-${index + 1}`,
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

describe('AcquisitiePartijenOverzicht', () => {
  it('toont in de portefeuillelijst alleen partijen met twee of meer objecten', () => {
    render(
      <AcquisitiePartijenOverzicht
        partijen={[
          partij('Eenmalige Eigenaar B.V.', 1),
          partij('Portefeuille B.V.', 3),
        ]}
      />,
    );

    expect(screen.getByText(/1 portefeuillehouder met 2\+ objecten/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Eigenaren & portefeuilles/i }));

    expect(screen.getByText('Portefeuille B.V.')).toBeVisible();
    expect(screen.queryByText('Eenmalige Eigenaar B.V.')).not.toBeInTheDocument();
  });
});
