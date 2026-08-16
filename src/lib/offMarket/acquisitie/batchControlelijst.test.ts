import { describe, expect, it } from 'vitest';

import { bouwBatchControlelijst } from './batchControlelijst';
import type { BriefversieContract, PrintbatchContract } from './productiekernContract';

const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026080601', status: 'concept', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};

function versie(id: string, verificatiestatus: 'onbekend' | 'handmatig_gecontroleerd' | 'geverifieerd', bestandReferentie: string | null): BriefversieContract {
  return {
    id, briefId: `brief-${id}`, versienummer: 1, status: 'actief',
    inhoud: {
      onderwerp: null, brieftekst: 'Tekst', objectadres: null,
      objectomschrijving: null, templateId: null, templateVersie: null,
    },
    geadresseerde: {
      naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null,
      straatHuisnummer: 'Straat 1', postcode: '1234AB', plaats: 'Amsterdam',
      land: 'Nederland', bron: null, verificatiestatus, relatieId: null,
    },
    bestandReferentie, createdAt: '2026-08-06T12:00:00Z',
    vervallenOp: null, verzondenOp: null,
  };
}

describe('bouwBatchControlelijst', () => {
  it('sorteert en telt adresafwijkingen zonder een renderbare immutable snapshot als ontbrekende PDF te zien', () => {
    const lijst = bouwBatchControlelijst({
      batch,
      brieven: [
        { briefnummer: 'BR2026000002', versie: versie('v2', 'onbekend', null) },
        { briefnummer: 'BR2026000001', versie: versie('v1', 'geverifieerd', 'storage/v1.pdf') },
      ],
    });

    expect(lijst.rijen.map((rij) => rij.briefnummer)).toEqual(['BR2026000001', 'BR2026000002']);
    expect(lijst).toMatchObject({ totaal: 2, nietGeverifieerd: 1, pdfOntbreekt: 0 });
    expect(lijst.rijen.map((rij) => [rij.briefnummer, rij.pdfBron])).toEqual([
      ['BR2026000001', 'opgeslagen_bestand'],
      ['BR2026000002', 'immutable_snapshot'],
    ]);
    expect(lijst.rijen.every((rij) => rij.pdfBeschikbaar)).toBe(true);
  });

  it('weigert dubbele briefnummers en niet-actieve versies vóór renderbaarheid wordt aangenomen', () => {
    expect(() => bouwBatchControlelijst({
      batch,
      brieven: [
        { briefnummer: 'BR2026000001', versie: versie('v1', 'geverifieerd', null) },
        { briefnummer: 'BR2026000001', versie: versie('v2', 'geverifieerd', null) },
      ],
    })).toThrow('Briefnummer dubbel');

    expect(() => bouwBatchControlelijst({
      batch,
      brieven: [{
        briefnummer: 'BR2026000001',
        versie: { ...versie('v1', 'geverifieerd', null), status: 'vervallen', vervallenOp: '2026-08-06T13:00:00Z' },
      }],
    })).toThrow('is niet actief');
  });
});
