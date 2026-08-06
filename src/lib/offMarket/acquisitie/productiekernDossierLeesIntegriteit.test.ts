import { describe, expect, it } from 'vitest';

import type { AcquisitiedossierContract } from './productiekernContract';
import {
  bewaakDossierLeesIntegriteit,
  ProductiekernDossierLeesIntegriteitError,
} from './productiekernDossierLeesIntegriteit';

function dossier(
  overrides: Partial<AcquisitiedossierContract> = {},
): AcquisitiedossierContract {
  return {
    selectieId: 'selectie-1',
    signaalId: 'signaal-1',
    objectId: null,
    verwerkingGestartOp: null,
    verwerkingGestartDoor: null,
    primaireWerkbak: 'nieuwe_selectie',
    volgendeActieOp: null,
    volgendeActieOmschrijving: null,
    ...overrides,
  };
}

describe('bewaakDossierLeesIntegriteit', () => {
  it('accepteert nieuwe en gestarte dossiers met consistente procesvelden', () => {
    expect(bewaakDossierLeesIntegriteit(dossier()).selectieId).toBe('selectie-1');
    expect(bewaakDossierLeesIntegriteit(dossier({
      primaireWerkbak: 'brief_opstellen',
      verwerkingGestartOp: '2026-08-06T12:00:00Z',
      verwerkingGestartDoor: 'actor-1',
      volgendeActieOp: '2026-08-07T09:00:00Z',
      volgendeActieOmschrijving: 'Conceptbrief afronden',
    })).primaireWerkbak).toBe('brief_opstellen');
  });

  it('weigert strijd tussen werkbak en verwerking gestart', () => {
    expect(() => bewaakDossierLeesIntegriteit(dossier({
      verwerkingGestartOp: '2026-08-06T12:00:00Z',
    }))).toThrow(ProductiekernDossierLeesIntegriteitError);

    expect(() => bewaakDossierLeesIntegriteit(dossier({
      primaireWerkbak: 'eigenaar_achterhalen',
    }))).toThrow('actieve werkbak mist een verwerkingsdatum');
  });

  it('weigert verwerker zonder datum en onvolledige volgende actie', () => {
    expect(() => bewaakDossierLeesIntegriteit(dossier({
      verwerkingGestartDoor: 'actor-1',
    }))).toThrow('verwerker is vastgelegd zonder verwerkingsdatum');

    expect(() => bewaakDossierLeesIntegriteit(dossier({
      volgendeActieOp: '2026-08-07T09:00:00Z',
    }))).toThrow('volgende actie en actiedatum zijn niet samen vastgelegd');
  });

  it('weigert een volgende actie op een afgehandeld dossier', () => {
    expect(() => bewaakDossierLeesIntegriteit(dossier({
      primaireWerkbak: 'afgehandeld',
      verwerkingGestartOp: '2026-08-06T12:00:00Z',
      volgendeActieOp: '2026-08-07T09:00:00Z',
      volgendeActieOmschrijving: 'Toch opvolgen',
    }))).toThrow('afgehandeld dossier bevat nog een volgende actie');
  });
});
