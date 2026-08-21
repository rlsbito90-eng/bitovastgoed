import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@/components/offmarket/acquisitie/GeadresseerdenLijst', () => ({
  default: ({ geadresseerden }: { geadresseerden: Array<{ bedrijfsnaam?: string | null; naam?: string | null }> }) => (
    <div data-testid="mock-geadresseerden">
      {geadresseerden.map((g, i) => <span key={i}>{g.bedrijfsnaam ?? g.naam ?? '—'}</span>)}
    </div>
  ),
}));

vi.mock('@/components/offmarket/acquisitie/SelecteerbareDossierRij', () => ({
  default: ({ children, actieCategorie, werkbak }: any) => (
    <li data-testid="mock-rij" data-actie-categorie={actieCategorie} data-werkbak={werkbak}>
      {children}
    </li>
  ),
}));

import AcquisitieDossierRij from '@/components/offmarket/acquisitie/AcquisitieDossierRij';
import { standaardSortering } from '@/lib/offMarket/acquisitie/sortering';

const geadresseerden = [{
  key: 'g-1',
  bedrijfsnaam: 'REB Projects B.V.',
  naam: null,
  verzendadres: 'Keizersgracht 165, Amsterdam',
  volledigPostadres: true,
}];

function hoofdinhoudMetProductie(meerdere = false) {
  return (
    <div>
      <div>
        <span data-testid="acquisitie-rij-briefstatus">Geen brief</span>
        <span data-testid="acquisitie-rij-eigenaarproces">Eigenaar gevonden</span>
        <span data-testid="acquisitie-rij-briefnummer">BR2026070101</span>
        {meerdere && <span data-testid="acquisitie-rij-briefnummer">BR2026070102</span>}
        <span data-testid="acquisitie-rij-batchnummer">BAT2026070101</span>
      </div>
      <p>Opvolgen sinds 1 jul.</p>
    </div>
  );
}

function renderRij({
  actieCategorie = 'opvolging_verlopen',
  werkbak = 'actie',
  meerdere = false,
}: {
  actieCategorie?: string;
  werkbak?: string;
  meerdere?: boolean;
} = {}) {
  return render(
    <AcquisitieDossierRij
      geselecteerd={false}
      onToggle={vi.fn()}
      signaalId="sig-1"
      fase="opvolging_open"
      werkbak={werkbak}
      actieCategorie={actieCategorie}
      geadresseerden={geadresseerden}
      hoofdinhoud={hoofdinhoudMetProductie(meerdere)}
      acties={<button type="button">Verwerk</button>}
    />,
  );
}

describe('AcquisitieDossierRij — compacte Opvolgen-presentatie', () => {
  it('toont BR- en BAT-nummers niet meer als losse badges in de hoofdlaag', () => {
    renderRij();
    expect(screen.queryByTestId('acquisitie-rij-briefnummer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('acquisitie-rij-batchnummer')).not.toBeInTheDocument();
    expect(screen.queryByText('Geen brief')).not.toBeInTheDocument();
    expect(screen.queryByText('Eigenaar gevonden')).not.toBeInTheDocument();
  });

  it('houdt BR/BAT vindbaar onder Brief & verzending', () => {
    renderRij();
    const details = screen.getByTestId('acquisitie-opvolgen-brief-verzending');
    fireEvent.click(within(details).getByText(/Brief & verzending/));
    expect(within(details).getByText('BR2026070101')).toBeInTheDocument();
    expect(within(details).getByText('BAT2026070101')).toBeInTheDocument();
  });

  it('vat meerdere brieven compact samen zonder batchgroepering', () => {
    renderRij({ meerdere: true });
    const samenvatting = screen.getByTestId('acquisitie-opvolgen-samenvatting');
    expect(samenvatting).toHaveTextContent('2 brieven verzonden');
    expect(samenvatting).toHaveTextContent('2 BR');
    expect(samenvatting).toHaveTextContent('1 batch');
    expect(screen.getByTestId('acquisitie-opvolgen-brief-verzending')).toHaveTextContent(
      'Batch is alleen herkomstinformatie; de opvolglijst blijft op werkvolgorde staan.',
    );
  });

  it('behoudt voor niet-Opvolgen de bestaande losse productie-identiteit', () => {
    renderRij({ actieCategorie: 'gereed_voor_print' });
    expect(screen.getByTestId('acquisitie-rij-briefnummer')).toHaveTextContent('BR2026070101');
    expect(screen.getByTestId('acquisitie-rij-batchnummer')).toHaveTextContent('BAT2026070101');
    expect(screen.queryByTestId('acquisitie-opvolgen-compact')).not.toBeInTheDocument();
  });

  it('houdt Opvolgen standaard op aanbevolen werkvolgorde en niet op batch', () => {
    expect(standaardSortering('actie', 'opvolgen', 'alles')).toBe('aanbevolen');
  });
});
