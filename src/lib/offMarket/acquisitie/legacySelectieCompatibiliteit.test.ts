import { describe, expect, it } from 'vitest';

import { legacySelectieNaarProductiekern } from './legacySelectieCompatibiliteit';

const basis = {
  id: 'selectie-1',
  signaal_id: 'signaal-1',
  notitie: 'Handmatige notitie',
  toegevoegd_door: 'gebruiker-1',
  toegevoegd_op: '2026-08-01T10:00:00.000Z',
  archived_at: null,
};

describe('legacySelectieNaarProductiekern', () => {
  it('houdt een bestaand actief record standaard in Nieuwe selectie', () => {
    const resultaat = legacySelectieNaarProductiekern(basis);

    expect(resultaat.dossier).toMatchObject({
      selectieId: 'selectie-1',
      signaalId: 'signaal-1',
      verwerkingGestartOp: null,
      verwerkingGestartDoor: null,
      primaireWerkbak: 'nieuwe_selectie',
    });
    expect(resultaat.legacy.notitie).toBe('Handmatige notitie');
  });

  it('gebruikt toegevoegd_op niet als impliciete processtart', () => {
    const resultaat = legacySelectieNaarProductiekern({
      ...basis,
      toegevoegd_op: '2025-01-01T00:00:00.000Z',
    });

    expect(resultaat.dossier.verwerkingGestartOp).toBeNull();
    expect(resultaat.dossier.primaireWerkbak).toBe('nieuwe_selectie');
  });

  it('neemt alleen een expliciet bewezen processtarttijdstip over', () => {
    const resultaat = legacySelectieNaarProductiekern(basis, {
      verwerkingGestartOp: '2026-08-06T03:00:00.000Z',
      verwerkingGestartDoor: 'gebruiker-2',
    });

    expect(resultaat.dossier.verwerkingGestartOp).toBe('2026-08-06T03:00:00.000Z');
    expect(resultaat.dossier.verwerkingGestartDoor).toBe('gebruiker-2');
  });

  it('markeert een legacy-archiefrecord niet als actief productiedossier', () => {
    const resultaat = legacySelectieNaarProductiekern({
      ...basis,
      archived_at: '2026-08-05T09:00:00.000Z',
    });

    expect(resultaat.dossier.primaireWerkbak).toBe('afgehandeld');
    expect(resultaat.waarschuwingen).toContain(
      'Selectierecord is gearchiveerd; het mag niet als actief productiedossier worden aangeboden.',
    );
  });

  it('weigert een losse verwerker als bewijs van processtart', () => {
    const resultaat = legacySelectieNaarProductiekern(basis, {
      verwerkingGestartDoor: 'gebruiker-2',
    });

    expect(resultaat.dossier.verwerkingGestartDoor).toBeNull();
    expect(resultaat.waarschuwingen).toContain(
      'Verwerker is opgegeven zonder expliciet verwerkingstijdstip; processtart blijft onbewezen.',
    );
  });
});
