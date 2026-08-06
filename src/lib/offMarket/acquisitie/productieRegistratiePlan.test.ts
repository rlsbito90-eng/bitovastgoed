import { describe, expect, it } from 'vitest';

import {
  bouwPostregistratiePlan,
  bouwPrintregistratiePlan,
} from './productieRegistratiePlan';
import type { BriefversieContract, PrintbatchContract } from './productiekernContract';

const conceptBatch: PrintbatchContract = {
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

const actieveVersie: BriefversieContract = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'actief',
  inhoud: {
    onderwerp: null,
    brieftekst: 'Brieftekst',
    objectadres: null,
    objectomschrijving: null,
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'Ontvanger',
    bedrijfsnaam: null,
    aanhef: null,
    straatHuisnummer: 'Teststraat 1',
    postcode: '1234 AB',
    plaats: 'Oisterwijk',
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

describe('bouwPrintregistratiePlan', () => {
  it('registreert printen zonder een verzenddatum te creëren', () => {
    const plan = bouwPrintregistratiePlan({
      batch: conceptBatch,
      printdatum: '2026-08-06T09:00:00.000Z',
    });

    expect(plan).toMatchObject({
      naarStatus: 'geprint',
      verzenddatumBlijft: null,
      eventType: 'printed',
    });
  });

  it('weigert printregistratie vanuit een terminale status', () => {
    expect(() => bouwPrintregistratiePlan({
      batch: { ...conceptBatch, status: 'gepost', printdatum: '2026-08-06', verzenddatum: '2026-08-06' },
      printdatum: '2026-08-06T09:00:00.000Z',
    })).toThrow('Batchstatus gepost mag niet naar geprint.');
  });
});

describe('bouwPostregistratiePlan', () => {
  const geprinteBatch: PrintbatchContract = {
    ...conceptBatch,
    status: 'geprint',
    printdatum: '2026-08-06T09:00:00.000Z',
  };

  it('start opvolging uitsluitend na expliciete postregistratie', () => {
    const plan = bouwPostregistratiePlan({
      batch: geprinteBatch,
      briefversie: actieveVersie,
      verzenddatum: '2026-08-06T10:00:00.000Z',
      alleActieveBatchbrievenGepost: false,
    });

    expect(plan).toMatchObject({
      naarBatchstatus: 'gedeeltelijk_gepost',
      eventType: 'posted',
      opvolgingMagStarten: true,
      printdatum: '2026-08-06T09:00:00.000Z',
      verzenddatum: '2026-08-06T10:00:00.000Z',
    });
  });

  it('sluit de batch wanneer alle actieve brieven zijn gepost', () => {
    const plan = bouwPostregistratiePlan({
      batch: geprinteBatch,
      briefversie: actieveVersie,
      verzenddatum: '2026-08-06T10:00:00.000Z',
      alleActieveBatchbrievenGepost: true,
    });

    expect(plan.naarBatchstatus).toBe('gepost');
  });

  it('weigert posten zonder bewezen printregistratie', () => {
    expect(() => bouwPostregistratiePlan({
      batch: conceptBatch,
      briefversie: actieveVersie,
      verzenddatum: '2026-08-06T10:00:00.000Z',
      alleActieveBatchbrievenGepost: true,
    })).toThrow('Een brief mag pas als gepost worden geregistreerd nadat de batch expliciet is geprint.');
  });

  it('weigert een niet-actieve briefversie', () => {
    expect(() => bouwPostregistratiePlan({
      batch: geprinteBatch,
      briefversie: { ...actieveVersie, status: 'vervallen', vervallenOp: '2026-08-06T09:30:00.000Z' },
      verzenddatum: '2026-08-06T10:00:00.000Z',
      alleActieveBatchbrievenGepost: true,
    })).toThrow('Alleen de actieve briefversie mag als gepost worden geregistreerd.');
  });
});
