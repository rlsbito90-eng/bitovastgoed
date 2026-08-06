import { describe, expect, it } from 'vitest';

import { beoordeelBatchPrintAkkoord } from './batchPrintAkkoord';

const manifest = {
  batchId: 'batch-1', batchnummer: 'BAT2026080601', documentversie: 1,
  briefAantal: 2, briefVersieIds: ['v1', 'v2'],
  documentBestanden: ['voorblad.pdf', 'controle.pdf', 'brieven.pdf', 'labels.csv'],
  gereedVoorRender: true, blokkades: [],
};

describe('beoordeelBatchPrintAkkoord', () => {
  it('geeft uitsluitend akkoord bij een volledig pakket en expliciete bevestiging', () => {
    expect(beoordeelBatchPrintAkkoord({
      manifest,
      gecontroleerdDoor: 'actor-1',
      gecontroleerdOp: '2026-08-06T16:30:00Z',
      explicietAkkoord: true,
    })).toEqual({
      batchId: 'batch-1', batchnummer: 'BAT2026080601', documentversie: 1,
      akkoordVoorPrint: true, gecontroleerdDoor: 'actor-1',
      gecontroleerdOp: '2026-08-06T16:30:00Z', blokkades: [],
    });
  });

  it('blokkeert ontbrekend menselijk akkoord en ongeldige controlemetadata', () => {
    const resultaat = beoordeelBatchPrintAkkoord({
      manifest,
      gecontroleerdDoor: ' ',
      gecontroleerdOp: '06-08-2026',
      explicietAkkoord: false,
    });
    expect(resultaat.akkoordVoorPrint).toBe(false);
    expect(resultaat.blokkades).toEqual([
      'Controleur ontbreekt.',
      'Controletijdstip is geen geldig canoniek UTC-tijdstip.',
      'Expliciet printakkoord ontbreekt.',
    ]);
  });

  it('neemt bestaande manifestblokkades over', () => {
    const resultaat = beoordeelBatchPrintAkkoord({
      manifest: { ...manifest, gereedVoorRender: false, blokkades: ['Adreslabels wijken af.'] },
      gecontroleerdDoor: 'actor-1',
      gecontroleerdOp: '2026-08-06T16:30:00Z',
      explicietAkkoord: true,
    });
    expect(resultaat.akkoordVoorPrint).toBe(false);
    expect(resultaat.blokkades).toContain('Adreslabels wijken af.');
    expect(resultaat.blokkades).toContain('Productiepakket is niet gereed voor rendering.');
  });
});
