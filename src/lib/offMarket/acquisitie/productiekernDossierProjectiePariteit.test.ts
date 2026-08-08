import { describe, expect, it } from 'vitest';

import type { AcquisitiedossierContract } from './productiekernContract';
import {
  mapLegacyWerkbakNaarOperationeleWerkbak,
  meetProductiekernWorkflowPariteit,
} from './productiekernDossierProjectiePariteit';
import type { WerkbakContext } from './werkbak';

const ctx = (actieCategorie: WerkbakContext['actieCategorie']): WerkbakContext => ({
  werkbak: 'actie',
  actieCategorie,
  actieSubfilter: null,
  procesDatum: null,
});

const dossier = (
  selectieId: string,
  primaireWerkbak: AcquisitiedossierContract['primaireWerkbak'],
): AcquisitiedossierContract => ({
  selectieId,
  signaalId: `signaal-${selectieId}`,
  objectId: null,
  verwerkingGestartOp: primaireWerkbak === 'nieuwe_selectie' ? null : '2026-08-08T12:00:00Z',
  verwerkingGestartDoor: primaireWerkbak === 'nieuwe_selectie' ? null : 'actor-1',
  primaireWerkbak,
  volgendeActieOp: null,
  volgendeActieOmschrijving: null,
});

describe('productiekern dossierprojectie workflowpariteit', () => {
  it('mapt legacy actiecategorieën expliciet naar operationele werkbakken', () => {
    expect(mapLegacyWerkbakNaarOperationeleWerkbak(ctx('onderzoek'))).toBe('eigenaar_achterhalen');
    expect(mapLegacyWerkbakNaarOperationeleWerkbak(ctx('brief_voorbereiden'))).toBe('brief_opstellen');
    expect(mapLegacyWerkbakNaarOperationeleWerkbak(ctx('gereed_voor_print'))).toBe('printklaar');
    expect(mapLegacyWerkbakNaarOperationeleWerkbak(ctx('geprint_nog_posten'))).toBe('geprint_posten');
    expect(mapLegacyWerkbakNaarOperationeleWerkbak(ctx('opvolging_vandaag'))).toBe('opvolgen');
  });

  it('rapporteert gelijk, afwijkend en ontbrekende zijden zonder iets te muteren', () => {
    const legacy = new Map<string, WerkbakContext>([
      ['selectie-1', ctx('onderzoek')],
      ['selectie-2', ctx('gereed_voor_print')],
      ['selectie-3', { werkbak: 'wachten', actieCategorie: null, actieSubfilter: null, procesDatum: null }],
    ]);

    expect(meetProductiekernWorkflowPariteit({
      selectieIds: ['selectie-1', 'selectie-2', 'selectie-3', 'selectie-4'],
      productiekernDossiers: [
        dossier('selectie-1', 'eigenaar_achterhalen'),
        dossier('selectie-2', 'geprint_posten'),
        dossier('selectie-4', 'nieuwe_selectie'),
      ],
      legacyContextPerSelectieId: legacy,
    })).toEqual({
      totaalSelecties: 4,
      vergelijkbaar: 2,
      gelijk: 1,
      afwijkend: 1,
      legacyOntbreekt: 1,
      productiekernOntbreekt: 1,
    });
  });
});
