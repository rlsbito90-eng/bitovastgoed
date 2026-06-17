// Verifieert dat de mobiele actionbar nu een compacte horizontale pill-rij is
// (geen 3-koloms grid meer) en zonder afgekapte labels.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignaalMobileActionBar from '@/components/offmarket/mobile/SignaalMobileActionBar';
import { maakTestSignaal } from './_fixture';

describe('SignaalMobileActionBar — compacte variant', () => {
  it('rendert horizontale scrollrij in plaats van grid-cols-3', () => {
    const { container } = render(<SignaalMobileActionBar signaal={maakTestSignaal()} />);
    const sectie = screen.getByTestId('signaal-mobile-actionbar');
    expect(sectie.className).not.toContain('grid-cols-3');
    const scroller = container.querySelector('.tabs-scroll');
    expect(scroller).not.toBeNull();
  });

  it('toont labels volledig (geen afgekapte tekst)', () => {
    render(<SignaalMobileActionBar signaal={maakTestSignaal()} />);
    for (const label of ['Maps', 'Google', 'BAG', 'Kadaster', 'Bron', 'Kopieer']) {
      expect(screen.getByText(label).textContent).toBe(label);
    }
  });
});
