import { describe, expect, it } from 'vitest';

import type { BriefContract, BriefversieContract } from './productiekernContract';
import { beoordeelProductiekernBriefLeesSamenhang } from './productiekernBriefLeesSamenhang';

function brief(overrides: Partial<BriefContract> = {}): BriefContract {
  return {
    id: 'brief-1', briefnummer: 'BR2026000482', signaalId: 'signaal-1',
    selectieId: 'selectie-1', objectId: null, relatieId: null, actieveVersie: 1,
    status: 'definitief', vervangingVanBriefId: null,
    definitiefOp: '2026-08-06T12:00:00Z', vergrendeldOp: '2026-08-06T12:00:00Z',
    annuleringsreden: null, ...overrides,
  };
}

function versie(overrides: Partial<BriefversieContract> = {}): BriefversieContract {
  return {
    id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'actief',
    inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: null,
      objectomschrijving: null, templateId: null, templateVersie: null },
    geadresseerde: { naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null,
      straatHuisnummer: 'Straat 1', postcode: '1000AA', plaats: 'Plaats',
      land: 'Nederland', bron: null, verificatiestatus: 'handmatig_gecontroleerd',
      relatieId: null },
    bestandReferentie: null, createdAt: '2026-08-06T12:00:00Z',
    vervallenOp: null, verzondenOp: null, ...overrides,
  };
}

describe('beoordeelProductiekernBriefLeesSamenhang', () => {
  it('accepteert een briefkern met exact bijpassende actieve versie', () => {
    const actief = versie();
    expect(beoordeelProductiekernBriefLeesSamenhang(brief(), [actief])).toEqual({
      geldig: true,
      blokkades: [],
      actieveVersie: actief,
    });
  });

  it('blokkeert ontbrekende, niet-actieve en dubbele actieve versies', () => {
    expect(beoordeelProductiekernBriefLeesSamenhang(brief(), []).blokkades)
      .toContain('De actieve versie uit de briefkern ontbreekt in de versielijst.');
    expect(beoordeelProductiekernBriefLeesSamenhang(
      brief(), [versie({ status: 'vervallen' })],
    ).blokkades).toContain('De actieve versie uit de briefkern heeft geen actieve status.');
    expect(beoordeelProductiekernBriefLeesSamenhang(
      brief(), [versie(), versie({ id: 'versie-2', versienummer: 2 })],
    ).blokkades).toContain('Meer dan één briefversie heeft status actief.');
  });

  it('blokkeert gemengde briefidentiteit en ongeldige briefstatusvelden', () => {
    const resultaat = beoordeelProductiekernBriefLeesSamenhang(
      brief({ briefnummer: null }),
      [versie({ briefId: 'brief-2' })],
    );
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.blokkades).toContain('Briefversielijst bevat een versie van een andere brief.');
    expect(resultaat.blokkades).toContain('Definitieve brief heeft geen briefnummer.');

    expect(beoordeelProductiekernBriefLeesSamenhang(
      brief({ status: 'concept', briefnummer: null, actieveVersie: null,
        definitiefOp: '2026-08-06T12:00:00Z', vergrendeldOp: null }),
      [],
    ).blokkades).toContain('Conceptbrief bevat een definitiefdatum.');
  });
});
