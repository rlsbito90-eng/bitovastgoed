import { describe, expect, it } from 'vitest';

import type { AcquisitiedossierContract } from './productiekernContract';
import { vergelijkProductiekernDossier } from './productiekernDossierVergelijking';

const basis: AcquisitiedossierContract = {
  selectieId: 'selectie-1',
  signaalId: 'signaal-1',
  objectId: null,
  verwerkingGestartOp: null,
  verwerkingGestartDoor: null,
  primaireWerkbak: 'nieuwe_selectie',
  volgendeActieOp: null,
  volgendeActieOmschrijving: null,
};

describe('vergelijkProductiekernDossier', () => {
  it('rapporteert volledige pariteit zonder afwijkingen', () => {
    expect(vergelijkProductiekernDossier(basis, { ...basis })).toEqual({
      gelijk: true,
      kritiekeAfwijking: false,
      afwijkingen: [],
    });
  });

  it('rapporteert procesverschillen zonder die automatisch kritisch te maken', () => {
    const resultaat = vergelijkProductiekernDossier(basis, {
      ...basis,
      primaireWerkbak: 'eigenaar_achterhalen',
      volgendeActieOmschrijving: 'Eigenaar controleren',
    });

    expect(resultaat.gelijk).toBe(false);
    expect(resultaat.kritiekeAfwijking).toBe(false);
    expect(resultaat.afwijkingen.map(({ veld }) => veld)).toEqual([
      'primaireWerkbak',
      'volgendeActieOmschrijving',
    ]);
  });

  it('markeert selectie-, signaal- en objectafwijkingen als kritisch', () => {
    const resultaat = vergelijkProductiekernDossier(basis, {
      ...basis,
      selectieId: 'selectie-2',
      signaalId: 'signaal-2',
      objectId: 'object-2',
    });

    expect(resultaat.kritiekeAfwijking).toBe(true);
    expect(resultaat.afwijkingen.map(({ veld }) => veld)).toEqual([
      'selectieId',
      'signaalId',
      'objectId',
    ]);
  });

  it('behoudt null en lege tekst als verschillende waarden', () => {
    const resultaat = vergelijkProductiekernDossier(basis, {
      ...basis,
      volgendeActieOmschrijving: '',
    });

    expect(resultaat.afwijkingen).toEqual([{
      veld: 'volgendeActieOmschrijving',
      legacyWaarde: null,
      productiekernWaarde: '',
    }]);
  });
});
