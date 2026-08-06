import { describe, expect, it } from 'vitest';

import type { BriefversieContract } from './productiekernContract';
import {
  bewaakBriefversieSnapshotLimiet,
  ProductiekernSnapshotTeGrootError,
} from './productiekernSnapshotLeesLimiet';

function versie(brieftekst: string): BriefversieContract {
  return {
    id: 'versie-1',
    briefId: 'brief-1',
    versienummer: 1,
    status: 'actief',
    inhoud: {
      onderwerp: null,
      brieftekst,
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

describe('bewaakBriefversieSnapshotLimiet', () => {
  it('accepteert een normale briefsnapshot', () => {
    const invoer = versie('Korte brieftekst');
    expect(bewaakBriefversieSnapshotLimiet(invoer)).toBe(invoer);
  });

  it('weigert een te grote snapshot zonder inhoud in de foutmelding op te nemen', () => {
    const geheim = 'vertrouwelijke-inhoud-'.repeat(100);
    let fout: unknown;
    try {
      bewaakBriefversieSnapshotLimiet(versie(geheim), 1024);
    } catch (error) {
      fout = error;
    }

    expect(fout).toBeInstanceOf(ProductiekernSnapshotTeGrootError);
    expect(String(fout)).not.toContain(geheim);
  });

  it('telt UTF-8-bytes in plaats van uitsluitend tekens', () => {
    expect(() => bewaakBriefversieSnapshotLimiet(
      versie('€'.repeat(400)),
      1024,
    )).toThrow(ProductiekernSnapshotTeGrootError);
  });

  it('weigert onveilige limietconfiguratie', () => {
    expect(() => bewaakBriefversieSnapshotLimiet(versie('tekst'), 1000))
      .toThrow('Snapshotlimiet moet tussen 1024 en 1048576 bytes liggen.');
    expect(() => bewaakBriefversieSnapshotLimiet(versie('tekst'), 2 * 1024 * 1024))
      .toThrow('Snapshotlimiet moet tussen 1024 en 1048576 bytes liggen.');
  });
});
