import { describe, expect, it } from 'vitest';

import type { AcquisitieNaPostActiestatus } from './acquisitieNaPostActiestatus';
import { projecteerAcquisitieNaPostActiebediening } from './acquisitieNaPostActiebediening';

function status(
  overrides: Partial<AcquisitieNaPostActiestatus> = {},
): AcquisitieNaPostActiestatus {
  return {
    actie: 'postregistratie_herstellen',
    titel: 'Postregistratie afronden',
    toelichting: 'Test',
    werkbak: 'geprint_posten',
    bedrijfsverwerkingGereed: false,
    volledigAfgerond: false,
    blokkeertVervolg: true,
    aantalMislukt: 1,
    operationKey: null,
    ...overrides,
  };
}

describe('projecteerAcquisitieNaPostActiebediening', () => {
  it('maakt bedrijfsherstel primair en bevestigingsplichtig', () => {
    const bediening = projecteerAcquisitieNaPostActiebediening(status());

    expect(bediening).toMatchObject({
      actie: 'postregistratie_herstellen',
      label: 'Postregistratie herstellen',
      variant: 'primair',
      zichtbaar: true,
      uitgeschakeld: false,
      bevestigingNodig: true,
      operationKey: null,
      blokkeertVervolg: true,
    });
    expect(Object.isFrozen(bediening)).toBe(true);
  });

  it('maakt een auditretry secundair en niet-blokkerend', () => {
    const bediening = projecteerAcquisitieNaPostActiebediening(status({
      actie: 'audit_herstellen',
      titel: 'Auditregistratie herstellen',
      bedrijfsverwerkingGereed: true,
      blokkeertVervolg: false,
      operationKey: 'audit:na-post:1',
    }));

    expect(bediening).toMatchObject({
      label: 'Auditregistratie herstellen',
      variant: 'secundair',
      bevestigingNodig: false,
      operationKey: 'audit:na-post:1',
      blokkeertVervolg: false,
    });
  });

  it('verbergt de bediening wanneer geen herstelactie nodig is', () => {
    const bediening = projecteerAcquisitieNaPostActiebediening(status({
      actie: 'geen',
      volledigAfgerond: true,
      bedrijfsverwerkingGereed: true,
      blokkeertVervolg: false,
      aantalMislukt: 0,
    }));

    expect(bediening).toEqual({
      actie: 'geen',
      label: '',
      variant: 'verborgen',
      zichtbaar: false,
      uitgeschakeld: true,
      bevestigingNodig: false,
      operationKey: null,
      blokkeertVervolg: false,
    });
  });

  it('weigert dossier- en auditbediening zonder operation key', () => {
    expect(() => projecteerAcquisitieNaPostActiebediening(status({
      actie: 'dossierbijwerking_herstellen',
      operationKey: null,
    }))).toThrow('operation key');

    expect(() => projecteerAcquisitieNaPostActiebediening(status({
      actie: 'audit_herstellen',
      operationKey: '   ',
    }))).toThrow('operation key');
  });

  it('weigert onverwachte operation keys bij post- en opvolgherstel', () => {
    expect(() => projecteerAcquisitieNaPostActiebediening(status({
      actie: 'opvolging_herstellen',
      operationKey: 'opvolg:1',
    }))).toThrow('onverwachte operation key');
  });
});
