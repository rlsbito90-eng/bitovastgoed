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

  it('toont tijdens laden geen afgeleide werkbaktellingen', () => {
    render(
      <ProductiekernDossierProjectie
        totaalSelecties={2}
        dossiers={[dossier('selectie-1', 'opvolgen')]}
        laden
      />,
    );

    expect(screen.getByText('Laden…')).toBeInTheDocument();
    expect(screen.queryByText('Opvolgen: 1')).not.toBeInTheDocument();
  });
});
