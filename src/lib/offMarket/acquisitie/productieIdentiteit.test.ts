import { describe, expect, it } from 'vitest';
import {
  formatteerBatchdocumentVersie,
  formatteerBriefversie,
  maakBatchnummer,
  maakBriefnummer,
  matchtProductieNummer,
  normaliseerProductieZoekterm,
  parseProductieNummer,
} from './productieIdentiteit';

describe('productie-identiteit voor brieven en batches', () => {
  it('maakt canonieke briefnummers met alleen letters en cijfers', () => {
    expect(maakBriefnummer(2026, 482)).toBe('BR2026000482');
  });

  it('maakt canonieke batchnummers op datum en dagvolgnummer', () => {
    expect(maakBatchnummer(new Date(2026, 7, 6), 1)).toBe('BAT2026080601');
    expect(maakBatchnummer(new Date(2026, 7, 6), 12)).toBe('BAT2026080612');
  });

  it('normaliseert geplakte nummers voor zoeken zonder de canonieke opslag te wijzigen', () => {
    expect(normaliseerProductieZoekterm(' br-2026 000482 ')).toBe('BR2026000482');
    expect(normaliseerProductieZoekterm('bat-2026-08-06-01')).toBe('BAT2026080601');
  });

  it('parseert brief- en batchnummers en weigert ongeldige datums', () => {
    expect(parseProductieNummer('BR2026000482')).toEqual({
      type: 'brief', jaar: 2026, volgnummer: 482, nummer: 'BR2026000482',
    });
    expect(parseProductieNummer('BAT2026080601')).toEqual({
      type: 'batch', jaar: 2026, maand: 8, dag: 6, dagvolgnummer: 1, nummer: 'BAT2026080601',
    });
    expect(parseProductieNummer('BAT2026023001')).toBeNull();
  });

  it('geeft brief- en batchdocumentversies eenduidig weer', () => {
    expect(formatteerBriefversie('BR2026000482', 2)).toBe('BR2026000482 · v2');
    expect(formatteerBatchdocumentVersie('BAT2026080601', 3)).toBe('BAT2026080601_v3');
  });

  it('ondersteunt volledige en gedeeltelijke zoekopdrachten zonder leestekens', () => {
    expect(matchtProductieNummer('BR2026000482', '000482')).toBe(true);
    expect(matchtProductieNummer('BAT2026080601', 'bat-20260806')).toBe(true);
    expect(matchtProductieNummer('BAT2026080601', 'BR2026')).toBe(false);
  });

  it('weigert ongeldige reeksen en versies', () => {
    expect(() => maakBriefnummer(2026, 0)).toThrow(/Briefvolgnummer/);
    expect(() => maakBatchnummer(new Date(2026, 7, 6), 100)).toThrow(/Batchvolgnummer/);
    expect(() => formatteerBriefversie('BR2026000482', 0)).toThrow(/Briefversie/);
  });
});
