import { describe, expect, it } from 'vitest';

import type { BriefversieContract } from './productiekernContract';
import {
  bewaakBriefversieLeesIntegriteit,
  ProductiekernLeesIntegriteitError,
} from './productiekernBriefversieLeesIntegriteit';

function versie(id: string, versienummer: number, briefId = 'brief-1'): BriefversieContract {
  return {
    id,
    briefId,
    versienummer,
    status: 'actief',
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
    createdAt: '2026-08-06T12:00:00Z',
    vervallenOp: null,
    verzondenOp: null,
  };
}

describe('bewaakBriefversieLeesIntegriteit', () => {
  it('accepteert een begrensde, unieke en oplopende lijst', () => {
    const invoer = [versie('v1', 1), versie('v2', 2)];
    expect(bewaakBriefversieLeesIntegriteit(invoer)).toEqual(invoer);
  });

  it('weigert dubbele IDs, dubbele nummers en gemengde brieven', () => {
    expect(() => bewaakBriefversieLeesIntegriteit([
      versie('v1', 1), versie('v1', 2),
    ])).toThrow(ProductiekernLeesIntegriteitError);
    expect(() => bewaakBriefversieLeesIntegriteit([
      versie('v1', 1), versie('v2', 1),
    ])).toThrow('dubbel versienummer');
    expect(() => bewaakBriefversieLeesIntegriteit([
      versie('v1', 1), versie('v2', 2, 'brief-2'),
    ])).toThrow('verschillende brieven');
  });

  it('weigert niet-oplopende en onbegrenste resultaten', () => {
    expect(() => bewaakBriefversieLeesIntegriteit([
      versie('v2', 2), versie('v1', 1),
    ])).toThrow('niet strikt oplopend');
    expect(() => bewaakBriefversieLeesIntegriteit(
      [versie('v1', 1), versie('v2', 2)],
      1,
    )).toThrow('te veel briefversies');
  });

  it('weigert ongeldige limieten', () => {
    expect(() => bewaakBriefversieLeesIntegriteit([], 0))
      .toThrow('Maximaal aantal briefversies moet tussen 1 en 100 liggen.');
    expect(() => bewaakBriefversieLeesIntegriteit([], 101))
      .toThrow('Maximaal aantal briefversies moet tussen 1 en 100 liggen.');
  });
});
