// V32 — ToevoegenAanAcquisitieSelectieKnop: rendert in beide states, voorkomt
// dubbelklik en verandert visueel bij toggle. Mockt hook-laag.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const addMock = vi.fn(() => Promise.resolve());
const removeMock = vi.fn(() => Promise.resolve());
let isIn = false;

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useIsInAcquisitieSelectie: () => isIn,
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: addMock, isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: removeMock, isPending: false }),
}));

import ToevoegenAanAcquisitieSelectieKnop from '@/components/offmarket/acquisitie/ToevoegenAanAcquisitieSelectieKnop';

describe('ToevoegenAanAcquisitieSelectieKnop', () => {
  it('toont "Toevoegen aan acquisitieselectie" wanneer niet geselecteerd (long)', () => {
    isIn = false;
    render(<ToevoegenAanAcquisitieSelectieKnop signaalId="sig-1" />);
    const btn = screen.getByTestId('acquisitie-selectie-toggle');
    expect(btn).toHaveAttribute('data-in-selectie', 'false');
    expect(btn.textContent).toMatch(/Toevoegen aan acquisitieselectie/i);
  });

  it('toont "Uit acquisitieselectie" wanneer wel geselecteerd (long)', () => {
    isIn = true;
    render(<ToevoegenAanAcquisitieSelectieKnop signaalId="sig-2" />);
    const btn = screen.getByTestId('acquisitie-selectie-toggle');
    expect(btn).toHaveAttribute('data-in-selectie', 'true');
    expect(btn.textContent).toMatch(/Uit acquisitieselectie/i);
  });

  it('compact-variant gebruikt korte labels', () => {
    isIn = false;
    const { rerender } = render(<ToevoegenAanAcquisitieSelectieKnop signaalId="c-1" variant="compact" />);
    expect(screen.getByTestId('acquisitie-selectie-toggle').textContent).toMatch(/^.*Aan selectie/i);
    isIn = true;
    rerender(<ToevoegenAanAcquisitieSelectieKnop signaalId="c-1" variant="compact" />);
    expect(screen.getByTestId('acquisitie-selectie-toggle').textContent).toMatch(/Uit selectie/i);
  });

  it('labelMode="remove" toont "Verwijderen" met juist aria-label', () => {
    isIn = true;
    render(<ToevoegenAanAcquisitieSelectieKnop signaalId="r-1" variant="compact" labelMode="remove" />);
    const btn = screen.getByTestId('acquisitie-selectie-toggle');
    expect(btn.textContent).toMatch(/Verwijderen/);
    expect(btn.getAttribute('aria-label')).toMatch(/Verwijder dit signaal uit de acquisitieselectie/i);
  });

  it('roept toevoegen aan bij klik', async () => {
    isIn = false;
    addMock.mockClear();
    render(<ToevoegenAanAcquisitieSelectieKnop signaalId="sig-3" />);
    fireEvent.click(screen.getByTestId('acquisitie-selectie-toggle'));
    expect(addMock).toHaveBeenCalledWith('sig-3');
  });

  it('roept verwijderen aan bij klik wanneer in selectie', async () => {
    isIn = true;
    removeMock.mockClear();
    render(<ToevoegenAanAcquisitieSelectieKnop signaalId="sig-4" />);
    fireEvent.click(screen.getByTestId('acquisitie-selectie-toggle'));
    expect(removeMock).toHaveBeenCalledWith('sig-4');
  });

  it('icon-variant heeft minimaal 44px touch-target op mobiel', () => {
    isIn = false;
    render(<ToevoegenAanAcquisitieSelectieKnop signaalId="sig-5" variant="icon" />);
    const btn = screen.getByTestId('acquisitie-selectie-toggle');
    expect(btn.className).toMatch(/min-h-\[44px\]/);
    expect(btn.className).toMatch(/min-w-\[44px\]/);
  });
});
