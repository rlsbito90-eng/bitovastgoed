import { describe, expect, it } from 'vitest';

import { valideerProductieTransactie } from './productieTransactieContract';
import type {
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';

const brief: BriefContract = {
  id: 'brief-1',
  briefnummer: null,
  signaalId: 'signaal-1',
  selectieId: 'selectie-1',
  objectId: null,
  relatieId: null,
  actieveVersie: 1,
  status: 'concept',
  vervangingVanBriefId: null,
  definitiefOp: null,
  vergrendeldOp: null,
  annuleringsreden: null,
};

const versie: BriefversieContract = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'actief',
  inhoud: {
    onderwerp: null,
    brieftekst: 'Geachte heer/mevrouw,',
    objectadres: null,
    objectomschrijving: null,
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'Testpersoon',
    bedrijfsnaam: null,
    aanhef: 'Geachte heer/mevrouw',
    straatHuisnummer: 'Teststraat 1',
    postcode: '1234 AB',
    plaats: 'Teststad',
    land: 'Nederland',
    bron: 'test',
    verificatiestatus: 'handmatig_gecontroleerd',
    relatieId: null,
  },
  bestandReferentie: null,
  createdAt: '2026-08-06T08:00:00.000Z',
  vervallenOp: null,
  verzondenOp: null,
};

const batch: PrintbatchContract = {
  id: 'batch-1',
  batchnummer: 'BAT2026080601',
  status: 'documenten_gegenereerd',
  documentversie: 1,
  aanvullingOpBatchId: null,
  printdatum: null,
  verzenddatum: null,
  geannuleerdOp: null,
  annuleringsreden: null,
};

const context = {
  actorId: 'actor-1',
  operationKey: 'acq-productie:v1:brief_reserveren:selectie:selectie-1:request-1',
  verwachtVersienummer: 1,
  uitgevoerdOp: '2026-08-06T08:30:00.000Z',
};

describe('valideerProductieTransactie', () => {
  it('accepteert het definitief maken van een geldige conceptbrief', () => {
    const resultaat = valideerProductieTransactie({
      ...context,
      actie: 'brief_definitief_maken',
      brief,
      actieveVersie: versie,
      gereserveerdBriefnummer: 'BR2026000482',
    });

    expect(resultaat).toEqual({ geldig: true, fouten: [] });
  });

  it('blokkeert definitief maken wanneer al een nummer bestaat', () => {
    const resultaat = valideerProductieTransactie({
      ...context,
      actie: 'brief_definitief_maken',
      brief: { ...brief, briefnummer: 'BR2026000001' },
      actieveVersie: versie,
      gereserveerdBriefnummer: 'BR2026000482',
    });

    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain('Brief heeft al een briefnummer.');
  });

  it('accepteert printregistratie uitsluitend vanaf gegenereerde documenten', () => {
    const resultaat = valideerProductieTransactie({
      ...context,
      actie: 'batch_geprint_markeren',
      batch,
      printdatum: '2026-08-06T09:00:00.000Z',
    });

    expect(resultaat.geldig).toBe(true);
  });

  it('blokkeert printregistratie wanneer de batch al geprint is', () => {
    const resultaat = valideerProductieTransactie({
      ...context,
      actie: 'batch_geprint_markeren',
      batch: { ...batch, status: 'geprint', printdatum: '2026-08-06T09:00:00.000Z' },
      printdatum: '2026-08-06T09:05:00.000Z',
    });

    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain(
      'Alleen een batch met gegenereerde documenten kan geprint worden.',
    );
    expect(resultaat.fouten).toContain('Batch heeft al een printdatum.');
  });

  it('vereist een geprinte batch en geadresseerde voor posten', () => {
    const resultaat = valideerProductieTransactie({
      ...context,
      actie: 'brief_gepost_markeren',
      brief: { ...brief, status: 'definitief', briefnummer: 'BR2026000482' },
      actieveVersie: versie,
      batch: { ...batch, status: 'geprint', printdatum: '2026-08-06T09:00:00.000Z' },
      verzenddatum: '2026-08-06T09:30:00.000Z',
      geadresseerdeKey: 'geadresseerde-1',
    });

    expect(resultaat.geldig).toBe(true);
  });

  it('blokkeert posten vanuit een ongeprinte batch', () => {
    const resultaat = valideerProductieTransactie({
      ...context,
      actie: 'brief_gepost_markeren',
      brief: { ...brief, status: 'definitief', briefnummer: 'BR2026000482' },
      actieveVersie: versie,
      batch,
      verzenddatum: '2026-08-06T09:30:00.000Z',
      geadresseerdeKey: '',
    });

    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain('Brief kan alleen vanuit een geprinte batch worden gepost.');
    expect(resultaat.fouten).toContain('Batch mist een expliciete printdatum.');
    expect(resultaat.fouten).toContain('Geadresseerde key is verplicht.');
  });
});
