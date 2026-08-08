import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { productiekernStandaardUitgeschakeld } from '@/lib/offMarket/acquisitie/productieActivatiePoort';

import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';

describe('ProductiekernProductiepakketZone', () => {
  it('rendert niets wanneer de centrale productiekernpoort standaard gesloten is', () => {
    const { container } = render(
      <ProductiekernProductiepakketZone
        activatie={productiekernStandaardUitgeschakeld}
        pakket={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('productiekern-productiepakket-zone')).not.toBeInTheDocument();
  });

  it('rendert ook zonder pakket niets, zelfs wanneer een activatiebesluit open is', () => {
    const { container } = render(
      <ProductiekernProductiepakketZone
        activatie={{ lezenActief: true, schrijvenActief: true, ontbrekendBewijs: [] }}
        pakket={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
