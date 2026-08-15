import { describe, expect, it } from 'vitest';
import {
  projecteerDefinitieveBriefNaarAcquisitieEvent,
  projecteerPrintbatchNaarAcquisitieEvents,
  projecteerVerzondenBriefversieNaarAcquisitieEvent,
} from './productieIdentityContract';
import type {
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from '@/lib/offMarket/acquisitie/productiekernContract';

const context = { bron: 'off_market_radar' as const, signaalId: 'signaal-1' };

function brief(overrides: Partial<BriefContract> = {}): BriefContract {
  return {
    id: 'brief-1', briefnummer: 'BR2026000482', signaalId: 'signaal-1', selectieId: 'sel-1',
    objectId: 'object-1', relatieId: 'rel-1', actieveVersie: 1, status: 'definitief',
    vervangingVanBriefId: null, definitiefOp: '2026-08-15T09:00:00Z', vergrendeldOp: '2026-08-15T09:00:00Z',
    annuleringsreden: null, ...overrides,
  };
}

function versie(overrides: Partial<BriefversieContract> = {}): BriefversieContract {
  return {
    id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'verzonden',
    inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: 'Adres 1', objectomschrijving: null, templateId: null, templateVersie: null },
    geadresseerde: { naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1', postcode: '1000AA', plaats: 'Amsterdam', land: 'Nederland', bron: 'kadaster', verificatiestatus: 'geverifieerd', relatieId: null },
    bestandReferentie: 'brief.pdf', createdAt: '2026-08-15T08:00:00Z', vervallenOp: null,
    verzondenOp: '2026-08-15T10:00:00Z', ...overrides,
  };
}

function batch(overrides: Partial<PrintbatchContract> = {}): PrintbatchContract {
  return {
    id: 'batch-1', batchnummer: 'BAT2026080601', status: 'gepost', documentversie: 1,
    aanvullingOpBatchId: null, printdatum: '2026-08-15T09:30:00Z', verzenddatum: '2026-08-15T10:00:00Z',
    geannuleerdOp: null, annuleringsreden: null, ...overrides,
  };
}

describe('TRACK-1C productie-identiteit', () => {
  it('projecteert alleen een definitieve brief met geldige BR-identiteit', () => {
    expect(projecteerDefinitieveBriefNaarAcquisitieEvent(brief(), context)).toMatchObject({
      type: 'brief_definitief_gemaakt', externalReference: 'BR2026000482',
      idempotencyKey: 'brief:BR2026000482:definitief',
    });
    expect(projecteerDefinitieveBriefNaarAcquisitieEvent(brief({ status: 'concept', definitiefOp: null, briefnummer: null }), context)).toBeNull();
  });

  it('telt uitsluitend een werkelijk verzonden briefversie als communicatie', () => {
    expect(projecteerVerzondenBriefversieNaarAcquisitieEvent(versie(), brief(), context, 'batch-1')).toMatchObject({
      type: 'communicatie_verzonden', refs: { briefId: 'brief-1', briefVersieId: 'versie-1', batchId: 'batch-1' },
      idempotencyKey: 'briefversie:versie-1:verzonden',
    });
    expect(projecteerVerzondenBriefversieNaarAcquisitieEvent(versie({ status: 'actief', verzondenOp: null }), brief(), context)).toBeNull();
  });

  it('maakt documenten genereren niet gelijk aan print of verzending', () => {
    expect(projecteerPrintbatchNaarAcquisitieEvents(batch({
      status: 'documenten_gegenereerd', printdatum: null, verzenddatum: null,
    }), context)).toEqual([]);
  });

  it('projecteert print en verzending als twee afzonderlijke feiten', () => {
    expect(projecteerPrintbatchNaarAcquisitieEvents(batch(), context)).toMatchObject([
      { type: 'batch_geprint', externalReference: 'BAT2026080601' },
      { type: 'communicatie_verzonden', externalReference: 'BAT2026080601' },
    ]);
  });

  it('weigert ongeldige of dubbele dossiercontext', () => {
    expect(projecteerPrintbatchNaarAcquisitieEvents(batch(), {
      bron: 'off_market_radar', signaalId: 's-1', vastgoedkansId: 'k-1',
    })).toEqual([]);
  });
});
