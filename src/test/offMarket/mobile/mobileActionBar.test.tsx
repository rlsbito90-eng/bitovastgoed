import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignaalMobileActionBar from '@/components/offmarket/mobile/SignaalMobileActionBar';
import { maakTestSignaal } from './_fixture';

describe('SignaalMobileActionBar', () => {
  it('rendert de zes primaire mobiele acties', () => {
    render(<SignaalMobileActionBar signaal={maakTestSignaal()} />);
    expect(screen.getByTestId('signaal-mobile-actionbar')).toBeInTheDocument();
    for (const kort of ['Maps', 'Google', 'BAG', 'Kadaster', 'Bron', 'Kopieer']) {
      expect(screen.getByText(kort)).toBeInTheDocument();
    }
  });

  it('disabled "Bron" als er geen bron_url is', () => {
    render(<SignaalMobileActionBar signaal={maakTestSignaal({ bron_url: null } as any)} />);
    const bronKnop = screen.getByLabelText('Open bekendmaking');
    expect(bronKnop).toHaveAttribute('disabled');
  });
});
