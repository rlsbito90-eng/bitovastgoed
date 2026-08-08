import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProductiekernDossierProjectie from './ProductiekernDossierProjectie';
import type { AcquisitiedossierContract } from '@/lib/offMarket/acquisitie/productiekernContract';

function dossier(
  selectieId: string,
  primaireWerkbak: AcquisitiedossierContract['primaireWerkbak'],
): AcquisitiedossierContract {
  return {
    selectieId,
    signaalId: `signaal-${selectieId}`,
    objectId: null,
    verwerkingGestartOp: primaireWerkbak === 'nieuwe_selectie' ? null : '2026-08-08T12:00:00Z',
    verwerkingGestartDoor: primaireWerkbak === 'nieuwe_selectie' ? null : 'actor-1',
    primaireWerkbak,
    volgendeActieOp: null,
    volgendeActieOmschrijving: null,
  };
}

describe('ProductiekernDossierProjectie', () => {
  it('toont uitsluitend observerende formele dossierstatus', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={4}
        dossiers={[
          dossier('selectie-1', 'eigenaar_achterhalen'),
          dossier('selectie-2', 'eigenaar_achterhalen'),
          dossier('selectie-3', 'brief_opstellen'),
        ]}
      />,
    );

    expect(screen.getByText('Productiekern — read-only')).toBeInTheDocument();
    expect(screen.getByText('3/4 formele dossiers')).toBeInTheDocument();
    expect(screen.getByText('Eigenaar achterhalen: 2')).toBeInTheDocument();
    expect(screen.getByText('Brief opstellen: 1')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toont workflowpariteit compact zonder bedieningsmogelijkheid', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={5}
        dossiers={[dossier('selectie-1', 'opvolgen'), dossier('selectie-2', 'wachten')]}
        pariteit={{
          totaalSelecties: 5,
          vergelijkbaar: 2,
          gelijk: 1,
          afwijkend: 1,
          legacyOntbreekt: 1,
          productiekernOntbreekt: 2,
        }}
      />,
    );

    expect(screen.getByTestId('productiekern-workflowpariteit')).toHaveTextContent(
      'Workflowpariteit: 1/2 gelijk · 1 afwijkend · 2 kern ontbreekt · 1 legacy ontbreekt',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toont tijdens laden geen afgeleide werkbaktellingen of pariteit', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={2}
        dossiers={[dossier('selectie-1', 'opvolgen')]}
        pariteit={{
          totaalSelecties: 2,
          vergelijkbaar: 1,
          gelijk: 1,
          afwijkend: 0,
          legacyOntbreekt: 0,
          productiekernOntbreekt: 1,
        }}
        laden
      />,
    );

    expect(screen.getByText('Laden…')).toBeInTheDocument();
    expect(screen.queryByText('Opvolgen: 1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('productiekern-workflowpariteit')).not.toBeInTheDocument();
  });

  it('presenteert een readfout fail-closed en toont geen lege of afgeleide pariteit', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={2}
        dossiers={[]}
        pariteit={{
          totaalSelecties: 2,
          vergelijkbaar: 0,
          gelijk: 0,
          afwijkend: 0,
          legacyOntbreekt: 0,
          productiekernOntbreekt: 2,
        }}
        fout
      />,
    );

    expect(screen.getByText('Readmodel niet beschikbaar')).toBeInTheDocument();
    expect(screen.queryByText('0/2 formele dossiers')).not.toBeInTheDocument();
    expect(screen.queryByText(/kern ontbreekt/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('productiekern-workflowpariteit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
