import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import GeadresseerdenLijst from './GeadresseerdenLijst';

describe('GeadresseerdenLijst', () => {
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

  it('rendert niets zonder geadresseerden', () => {
    const { container } = render(<GeadresseerdenLijst geadresseerden={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
