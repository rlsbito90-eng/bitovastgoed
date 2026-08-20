import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AcquisitieDossierRij from './AcquisitieDossierRij';

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: [] }),
}));

vi.mock('@/hooks/useAcquisitiePartijOverzicht', () => ({
  useAcquisitiePartijOverzicht: () => ({ perKey: new Map() }),
}));

describe('AcquisitieDossierRij', () => {
  it('combineert kaartselectie, hoofdinhoud en zichtbare geadresseerden', () => {
    const onToggle = vi.fn();

    render(
      <AcquisitieDossierRij
        geselecteerd={false}
        onToggle={onToggle}
        signaalId="signaal-1"
        fase="brief_maken"
        werkbak="actie"
        actieCategorie="brief_voorbereiden"
        geadresseerden={[{
          key: 'eigenaar-1',
          naam: 'Mevrouw Voorbeeld',
          verzendadres: 'Dorpsstraat 1  5061 AA Oisterwijk',
          volledigPostadres: true,
        }]}
        hoofdinhoud={<p>Voorbeeldstraat 10</p>}
        acties={<button type="button">Open signaal</button>}
      />,
    );

    expect(screen.getByText('Voorbeeldstraat 10')).toBeInTheDocument();
    expect(screen.getByText('M. Voorbeeld')).toBeInTheDocument();
    expect(screen.getByText(/Dorpsstraat 1 5061 AA Oisterwijk/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Voorbeeldstraat 10'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('laat klikken in de actiezone de dossierselectie niet wijzigen', () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();

    render(
      <AcquisitieDossierRij
        geselecteerd
        onToggle={onToggle}
        signaalId="signaal-2"
        fase="printklaar"
        werkbak="actie"
        actieCategorie="te_printen"
        geadresseerden={[]}
        hoofdinhoud={<p>Tweede dossier</p>}
        acties={<button type="button" onClick={onOpen}>Open signaal</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open signaal' }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });
});
