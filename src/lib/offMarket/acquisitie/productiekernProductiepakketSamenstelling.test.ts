import { describe, expect, it } from 'vitest';
import { bouwProductiekernProductiepakketPayload } from './productiekernProductiepakketSamenstelling';

const basis = () => ({
  manifest: {
    batchId: 'batch-1', batchnummer: 'BAT2026080801', documentversie: 1,
    briefAantal: 1, briefVersieIds: ['versie-1'],
    documentBestanden: ['voorblad.pdf', 'controlelijst.pdf', 'brieven.pdf', 'labels.csv'],
    gereedVoorRender: true, blokkades: [],
  },
  voorblad: {
    batchnummer: 'BAT2026080801', documentversie: 1, status: 'concept' as const,
    briefAantal: 1, nietGeverifieerdeAdressen: 0, ontbrekendePdfs: 0,
    gereedVoorPrint: true, waarschuwingen: [],
  },
  controlelijst: {
    batchId: 'batch-1', batchnummer: 'BAT2026080801', documentversie: 1,
    totaal: 1, nietGeverifieerd: 0, pdfOntbreekt: 0,
    rijen: [{ volgnummer: 1, briefnummer: 'BR2026000001', briefVersieId: 'versie-1', geadresseerde: 'Eigenaar', plaats: 'Amsterdam', adresGeverifieerd: true, pdfBeschikbaar: true }],
  },
  labels: [{ volgnummer: 1, briefnummer: 'BR2026000001', briefVersieId: 'versie-1', naamregel: 'Eigenaar', adresregel: 'Straat 1', postcode: '1011AA', plaats: 'Amsterdam', landregel: null }],
  brieven: [{
    briefId: 'brief-1', briefnummer: 'BR2026000001', briefVersieId: 'versie-1', versienummer: 1,
    onderwerp: null, brieftekst: 'Tekst', objectadres: null, objectomschrijving: null,
    aanhef: 'Geachte heer/mevrouw', naam: 'Eigenaar', bedrijfsnaam: null,
    straatHuisnummer: 'Straat 1', postcode: '1011 AA', plaats: 'Amsterdam', land: 'Nederland',
  }],
});

describe('bouwProductiekernProductiepakketPayload', () => {
  it('laat een volledig consistent pakket door en bevriest de collecties', () => {
    const resultaat = bouwProductiekernProductiepakketPayload(basis());
    expect(resultaat.manifest.batchId).toBe('batch-1');
    expect(Object.isFrozen(resultaat)).toBe(true);
    expect(Object.isFrozen(resultaat.labels)).toBe(true);
    expect(Object.isFrozen(resultaat.brieven)).toBe(true);
  });

  it('weigert een niet-rendergereed manifest', () => {
    const input = basis();
    input.manifest.gereedVoorRender = false;
    input.manifest.blokkades = ['Adres ontbreekt.'];
    expect(() => bouwProductiekernProductiepakketPayload(input)).toThrow('niet rendergereed');
  });

  it('weigert afwijkende briefversies of volgorde', () => {
    const input = basis();
    input.brieven[0].briefVersieId = 'andere-versie';
    expect(() => bouwProductiekernProductiepakketPayload(input)).toThrow('Briefversies of volgorde');
  });
});
