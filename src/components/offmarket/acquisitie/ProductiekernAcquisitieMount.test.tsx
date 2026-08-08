import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProductiekernAcquisitieMount from './ProductiekernAcquisitieMount';

describe('ProductiekernAcquisitieMount', () => {
  it('verandert de acquisitie-UX standaard niet zolang releasebewijs ontbreekt', () => {
    const { container } = render(<ProductiekernAcquisitieMount />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('productiekern-productiepakket-zone')).not.toBeInTheDocument();
  });
});
