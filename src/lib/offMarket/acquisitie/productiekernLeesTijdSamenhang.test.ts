import { describe, expect, it } from 'vitest';

import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import {
  bewaakBriefLeesTijd,
  bewaakBriefversieLeesTijd,
  bewaakDossierLeesTijd,
  bewaakPrintbatchLeesTijd,
} from './productiekernLeesTijdSamenhang';

const nu = Date.parse('2026-08-06T16:00:00Z');

const dossier: AcquisitiedossierContract = {
  selectieId: 'selectie-1',
  signaalId: 'signaal-1',
  objectId: null,
  verwerkingGestartOp: '2026-08-06T12:00:00Z',
  verwerkingGestartDoor: 'actor-1',
  primaireWerkbak: 'opvolgen',
  volgendeActieOp: '2026-08-10T09:00:00Z',
  volgendeActieOmschrijving: 'Nabellen',
};

const brief: BriefContract = {
  id: 'brief-1',
  briefnummer: 'BR2026000482',
  signaalId: 'signaal-1',
  selectieId: 'selectie-1',
  objectId: null,
  relatieId: null,
  actieveVersie: 1,
  status: 'definitief',
  vervangingVanBriefId: null,
  definitiefOp: '2026-08-06T12:00:00Z',
  vergrendeldOp: '2026-08-06T12:01:00Z',
  annuleringsreden: null,
};

const versie: BriefversieContract = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'verzonden',
  inhoud: {
    onderwerp: null,
    brieftekst: 'Tekst',
    objectadres: null,
    objectomschrijving: null,
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'Eigenaar',
    bedrijfsnaam: null,
    aanhef: null,
    straatHuisnummer: 'Straat 1',
    postcode: '1000AA',
    plaats: 'Plaats',
    land: 'Nederland',
    bron: null,
    verificatiestatus: 'handmatig_gecontroleerd',
    relatieId: null,
  },
  bestandReferentie: null,
  createdAt: '2026-08-06T11:00:00Z',
  vervallenOp: null,
  verzondenOp: '2026-08-06T13:00:00Z',
};

const batch: PrintbatchContract = {
  id: 'batch-1',
  batchnummer: 'BAT2026080601',
  status: 'gepost',
  documentversie: 1,
  aanvullingOpBatchId: null,
  printdatum: '2026-08-06T13:00:00Z',
  verzenddatum: '2026-08-06T14:00:00Z',
  geannuleerdOp: null,
  annuleringsreden: null,
};

describe('productiekern leestijdsamenhang', () => {
  it('accepteert geldige tijdvelden en toekomstige volgende acties', () => {
    expect(bewaakDossierLeesTijd(dossier, nu)).toBe(dossier);
    expect(bewaakBriefLeesTijd(brief, nu)).toBe(brief);
    expect(bewaakBriefversieLeesTijd(versie, nu)).toBe(versie);
    expect(bewaakPrintbatchLeesTijd(batch, nu)).toBe(batch);
  });

  it('weigert niet-canonieke volgende actiedatums', () => {
    expect(() => bewaakDossierLeesTijd({
      ...dossier,
      volgendeActieOp: '2026-08-10 09:00:00',
    }, nu)).toThrow('geen canoniek UTC-tijdstip');
  });

  it('weigert vergrendeling vóór definitiefmaking', () => {
    expect(() => bewaakBriefLeesTijd({
      ...brief,
      vergrendeldOp: '2026-08-06T11:59:00Z',
    }, nu)).toThrow('ligt vóór definitiefOp');
  });

  it('weigert verzending vóór versieaanmaak', () => {
    expect(() => bewaakBriefversieLeesTijd({
      ...versie,
      verzondenOp: '2026-08-06T10:59:00Z',
    }, nu)).toThrow('ligt vóór createdAt');
  });

  it('weigert verzending vóór printen en productiegebeurtenissen in de toekomst', () => {
    expect(() => bewaakPrintbatchLeesTijd({
      ...batch,
      verzenddatum: '2026-08-06T12:59:00Z',
    }, nu)).toThrow('ligt vóór printdatum');

    expect(() => bewaakPrintbatchLeesTijd({
      ...batch,
      printdatum: '2026-08-06T16:02:00Z',
      verzenddatum: '2026-08-06T16:03:00Z',
    }, nu)).toThrow('ligt te ver in de toekomst');
  });
});
