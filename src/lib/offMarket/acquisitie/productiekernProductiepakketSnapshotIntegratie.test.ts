import { describe, expect, it } from 'vitest';

import type { BriefContract, BriefversieContract, PrintbatchContract } from './productiekernContract';
import { bouwProductiekernBatchProductiepakket } from './productiekernBatchProductiepakket';

const batch: PrintbatchContract = {
  id: 'batch-1',
  batchnummer: 'BAT2026081601',
  status: 'concept',
  documentversie: 1,
  aanvullingOpBatchId: null,
  printdatum: null,
  verzenddatum: null,
  geannuleerdOp: null,
  annuleringsreden: null,
};

const brief: BriefContract = {
  id: 'brief-1',
  briefnummer: 'BR2026000001',
  signaalId: 'signaal-1',
  selectieId: 'selectie-1',
  objectId: null,
  relatieId: null,
  actieveVersie: 1,
  status: 'definitief',
  vervangingVanBriefId: null,
  definitiefOp: '2026-08-16T20:00:00.000Z',
  vergrendeldOp: '2026-08-16T20:00:00.000Z',
  annuleringsreden: null,
};

const versie: BriefversieContract = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'actief',
  inhoud: {
    onderwerp: 'Interesse in uw pand',
    brieftekst: 'Geachte heer/mevrouw,\n\nDit is een definitieve immutable brief.',
    objectadres: 'Objectstraat 1, 1011 AA Amsterdam',
    objectomschrijving: 'Objectstraat 1 te Amsterdam',
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'E.S. Blok',
    bedrijfsnaam: null,
    aanhef: 'Geachte heer/mevrouw,',
    straatHuisnummer: 'Voorbeeldstraat 12 H',
    postcode: '1012 AB',
    plaats: 'Amsterdam',
    land: 'Nederland',
    bron: 'legacy_concept',
    verificatiestatus: 'handmatig_gecontroleerd',
    relatieId: null,
  },
  // Bewust null: de batchrenderer moet de immutable snapshot zelf kunnen renderen.
  bestandReferentie: null,
  createdAt: '2026-08-16T20:00:00.000Z',
  vervallenOp: null,
  verzondenOp: null,
};

describe('Productiekern productiepakket uit immutable snapshots', () => {
  it('bouwt centraal een volledig rendergereed vierbestandenpakket zonder individuele opgeslagen brief-PDF', () => {
    const payload = bouwProductiekernBatchProductiepakket({
      batch,
      brieven: [{ brief, versie, geadresseerdeKey: 'signaal-1|es-blok' }],
    });

    expect(payload.controlelijst.pdfOntbreekt).toBe(0);
    expect(payload.controlelijst.rijen[0]).toMatchObject({
      pdfBeschikbaar: true,
      pdfBron: 'immutable_snapshot',
    });
    expect(payload.voorblad.gereedVoorPrint).toBe(true);
    expect(payload.manifest.gereedVoorRender).toBe(true);
    expect(payload.manifest.documentBestanden).toEqual([
      'BAT2026081601-v1-voorblad.pdf',
      'BAT2026081601-v1-controlelijst.pdf',
      'BAT2026081601-v1-brieven.pdf',
      'BAT2026081601-v1-adreslabels.csv',
    ]);
    expect(payload.brieven[0]).toMatchObject({
      briefnummer: 'BR2026000001',
      briefVersieId: 'versie-1',
      brieftekst: versie.inhoud.brieftekst,
    });
  });

  it('blokkeert versie-drift vóór een pakket wordt samengesteld', () => {
    expect(() => bouwProductiekernBatchProductiepakket({
      batch,
      brieven: [{
        brief: { ...brief, actieveVersie: 2 },
        versie,
        geadresseerdeKey: 'signaal-1|es-blok',
      }],
    })).toThrow('Actieve versie');
  });
});
