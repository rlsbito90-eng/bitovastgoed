import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('toont de formele 8-bakkenbediening met aantallen uit dossiers', () => {
    const onWerkbakChange = vi.fn();
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={4}
        dossiers={[
          dossier('selectie-1', 'eigenaar_achterhalen'),
          dossier('selectie-2', 'eigenaar_achterhalen'),
          dossier('selectie-3', 'brief_opstellen'),
        ]}
        actieveWerkbak="eigenaar_achterhalen"
        onWerkbakChange={onWerkbakChange}
      />,
    );

    expect(screen.getByText('Acquisitieproductiekern')).toBeInTheDocument();
    expect(screen.getByText('3/4 formele dossiers')).toBeInTheDocument();
    expect(screen.getByTestId('productiekern-werkbak-eigenaar_achterhalen')).toHaveTextContent(
      'Eigenaar achterhalen2',
    );
    expect(screen.getByTestId('productiekern-werkbak-brief_opstellen')).toHaveTextContent(
      'Brief opstellen1',
    );
    expect(screen.getByTestId('productiekern-werkbak-nieuwe_selectie')).toHaveTextContent(
      'Nieuwe selectie0',
    );
    expect(screen.getByTestId('productiekern-actieve-werkbak-telling')).toHaveTextContent(
      '2 dossiers in deze weergave',
    );

    fireEvent.click(screen.getByTestId('productiekern-werkbak-brief_opstellen'));
    expect(onWerkbakChange).toHaveBeenCalledWith('brief_opstellen');
  });

  it('toont workflowpariteit als observatie naast de formele bediening', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={5}
        dossiers={[dossier('selectie-1', 'opvolgen'), dossier('selectie-2', 'wachten')]}
        actieveWerkbak="alles"
        onWerkbakChange={() => undefined}
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
      'Pariteit: 1/2 · 1 afwijkend · 2 kern ontbreekt',
    );
    expect(screen.getByTestId('productiekern-actieve-werkbak-telling')).toHaveTextContent(
      '2 dossiers in deze weergave',
    );
  });

  it('toont tijdens laden uitsluitend de uniforme laadstatus en geen partiële werkbakdata', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={2}
        dossiers={[dossier('selectie-1', 'opvolgen')]}
        actieveWerkbak="opvolgen"
        onWerkbakChange={() => undefined}
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
    expect(screen.getByTestId('productiekern-dossier-projectie')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('productiekern-workflowpariteit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('productiekern-actieve-werkbak-telling')).not.toBeInTheDocument();
    expect(screen.queryByTestId('productiekern-werkbakken')).not.toBeInTheDocument();
    expect(screen.queryByText('1/2 formele dossiers')).not.toBeInTheDocument();
  });

  it('presenteert een readfout fail-closed en toont geen werkbakbediening', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={2}
        dossiers={[]}
        actieveWerkbak="nieuwe_selectie"
        onWerkbakChange={() => undefined}
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
    expect(screen.queryByTestId('productiekern-workflowpariteit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('productiekern-werkbakken')).not.toBeInTheDocument();
  });
});
