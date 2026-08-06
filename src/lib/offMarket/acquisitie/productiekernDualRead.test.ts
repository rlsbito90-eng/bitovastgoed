import { describe, expect, it } from 'vitest';

import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';
import {
  leesProductiedossierDualRead,
} from './productiekernDualRead';
import {
  UitgeschakeldeAcquisitieProductiekernRepository,
} from './productiekernRepository';

const legacyDossier: LegacyProductiedossierReadmodel = {
  dossier: {
    selectieId: 'selectie-1',
    signaalId: 'signaal-1',
    objectId: null,
    verwerkingGestartOp: null,
    verwerkingGestartDoor: null,
    primaireWerkbak: 'nieuwe_selectie',
    volgendeActieOp: null,
    volgendeActieOmschrijving: null,
  },
  brieven: [],
  losgekoppeldeAudit: [],
  waarschuwingen: [],
  bron: 'legacy_productie_export',
};

describe('leesProductiedossierDualRead', () => {
  it('raadpleegt de productiekern niet wanneer lezen uitstaat', async () => {
    let aangeroepen = false;
    const resultaat = await leesProductiedossierDualRead({
      selectieId: 'selectie-1',
      legacyDossier,
      productiekernLezenActief: false,
      productiekernRepository: {
        async haalDossier() {
          aangeroepen = true;
          return null;
        },
      },
    });

    expect(aangeroepen).toBe(false);
    expect(resultaat.bron).toBe('legacy');
    expect(resultaat.dossier).toBe(legacyDossier);
  });

  it('valt gecontroleerd terug bij de standaard fail-closed repository', async () => {
    const resultaat = await leesProductiedossierDualRead({
      selectieId: 'selectie-1',
      legacyDossier,
      productiekernLezenActief: true,
      productiekernRepository:
        new UitgeschakeldeAcquisitieProductiekernRepository(),
    });

    expect(resultaat.bron).toBe('legacy');
    expect(resultaat.productiekernDossierBeschikbaar).toBe(false);
    expect(resultaat.waarschuwingen).toContain(
      'Productiekern-repository is fail-closed uitgeschakeld; legacy blijft leidend.',
    );
  });

  it('houdt legacy leidend wanneer nog geen productiekern-dossier bestaat', async () => {
    const resultaat = await leesProductiedossierDualRead({
      selectieId: 'selectie-1',
      legacyDossier,
      productiekernLezenActief: true,
      productiekernRepository: { async haalDossier() { return null; } },
    });

    expect(resultaat.bron).toBe('legacy');
    expect(resultaat.waarschuwingen[0]).toMatch(/nog geen productiekern-dossier/);
  });

  it('vervangt alleen het dossiercontract wanneer productiekern-data bestaat', async () => {
    const resultaat = await leesProductiedossierDualRead({
      selectieId: 'selectie-1',
      legacyDossier,
      productiekernLezenActief: true,
      productiekernRepository: {
        async haalDossier() {
          return {
            ...legacyDossier.dossier,
            verwerkingGestartOp: '2026-08-06T08:00:00.000Z',
            verwerkingGestartDoor: 'gebruiker-1',
            primaireWerkbak: 'eigenaar_achterhalen',
          };
        },
      },
    });

    expect(resultaat.bron).toBe('productiekern');
    expect(resultaat.dossier.dossier.primaireWerkbak).toBe('eigenaar_achterhalen');
    expect(resultaat.dossier.brieven).toBe(legacyDossier.brieven);
  });

  it('verbergt onverwachte repositoryfouten niet', async () => {
    await expect(leesProductiedossierDualRead({
      selectieId: 'selectie-1',
      legacyDossier,
      productiekernLezenActief: true,
      productiekernRepository: {
        async haalDossier() { throw new Error('netwerkfout'); },
      },
    })).rejects.toThrow('netwerkfout');
  });
});
