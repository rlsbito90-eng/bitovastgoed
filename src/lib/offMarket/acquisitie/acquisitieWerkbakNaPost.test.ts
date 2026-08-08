import { describe, expect, it } from 'vitest';

import { bepaalAcquisitieWerkbakNaPost } from './acquisitieWerkbakNaPost';

describe('bepaalAcquisitieWerkbakNaPost', () => {
  it('houdt gedeeltelijk geposte batches in geprint/posten', () => {
    expect(bepaalAcquisitieWerkbakNaPost({
      totaalBriefversies: 3,
      succesvolGepost: 2,
      opvolgenOp: null,
      nu: '2026-08-06T12:00:00Z',
    })).toEqual({
      werkbak: 'geprint_posten',
      reden: 'Niet alle briefversies zijn aantoonbaar gepost.',
    });
  });

  it('plaatst volledig geposte dossiers in wachten zolang opvolging nog niet is bereikt', () => {
    expect(bepaalAcquisitieWerkbakNaPost({
      totaalBriefversies: 2,
      succesvolGepost: 2,
      opvolgenOp: '2026-08-20T12:00:00Z',
      nu: '2026-08-06T12:00:00Z',
    }).werkbak).toBe('wachten');
  });

  it('plaatst volledig geposte dossiers in opvolgen zodra de datum is bereikt', () => {
    expect(bepaalAcquisitieWerkbakNaPost({
      totaalBriefversies: 2,
      succesvolGepost: 2,
      opvolgenOp: '2026-08-06T12:00:00Z',
      nu: '2026-08-06T12:00:00Z',
    }).werkbak).toBe('opvolgen');
  });

  it('weigert ongeldige aantallen, ontbrekende opvolgdatum en ongeldige tijdstippen', () => {
    expect(() => bepaalAcquisitieWerkbakNaPost({
      totaalBriefversies: 0, succesvolGepost: 0, opvolgenOp: null, nu: '2026-08-06T12:00:00Z',
    })).toThrow('Totaal aantal briefversies moet minimaal 1 zijn');
    expect(() => bepaalAcquisitieWerkbakNaPost({
      totaalBriefversies: 1, succesvolGepost: 2, opvolgenOp: null, nu: '2026-08-06T12:00:00Z',
    })).toThrow('Aantal succesvol geposte briefversies is ongeldig');
    expect(() => bepaalAcquisitieWerkbakNaPost({
      totaalBriefversies: 1, succesvolGepost: 1, opvolgenOp: null, nu: '2026-08-06T12:00:00Z',
    })).toThrow('Volledig geposte selectie vereist een opvolgdatum');
  });
});
