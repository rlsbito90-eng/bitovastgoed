import { describe, expect, it } from 'vitest';

import { bouwProductieRpcAanroep } from './productieRpcContract';

const brief = {
  id: 'brief-1',
  briefnummer: null,
  signaalId: 'signaal-1',
  selectieId: 'selectie-1',
  objectId: null,
  relatieId: null,
  actieveVersie: 1,
  status: 'concept' as const,
  vervangingVanBriefId: null,
  definitiefOp: null,
  vergrendeldOp: null,
  annuleringsreden: null,
};

const versie = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'actief' as const,
  inhoud: {
    onderwerp: 'Onderwerp',
    brieftekst: 'Brieftekst',
    objectadres: null,
    objectomschrijving: null,
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'Eigenaar',
    bedrijfsnaam: null,
    aanhef: 'Geachte heer/mevrouw',
    straatHuisnummer: 'Straat 1',
    postcode: '1234 AB',
    plaats: 'Plaats',
    land: 'Nederland',
    bron: 'test',
    verificatiestatus: 'handmatig_gecontroleerd' as const,
    relatieId: null,
  },
  bestandReferentie: null,
  createdAt: '2026-08-06T08:00:00.000Z',
  vervallenOp: null,
  verzondenOp: null,
};

const context = {
  actorId: 'actor-1',
  operationKey: 'acq-productie:v1:brief_definitief_maken:brief:brief-1:request-1',
  verwachtVersienummer: 1,
  uitgevoerdOp: '2026-08-06T08:30:00.000Z',
};

describe('bouwProductieRpcAanroep', () => {
  it('bouwt een expliciete RPC-aanroep voor definitief maken', () => {
    const aanroep = bouwProductieRpcAanroep({
      actie: 'brief_definitief_maken',
      ...context,
      brief,
      actieveVersie: versie,
      gereserveerdBriefnummer: 'BR2026000001',
    });

    expect(aanroep).toEqual({
      rpc: 'maak_off_market_brief_definitief',
      parameters: {
        p_actor_id: 'actor-1',
        p_operation_key: context.operationKey,
        p_verwacht_versienummer: 1,
        p_uitgevoerd_op: context.uitgevoerdOp,
        p_brief_id: 'brief-1',
        p_brief_versie_id: 'versie-1',
        p_gereserveerd_briefnummer: 'BR2026000001',
      },
    });
  });

  it('weigert ongeldige transacties voordat een RPC wordt gebouwd', () => {
    expect(() => bouwProductieRpcAanroep({
      actie: 'brief_definitief_maken',
      ...context,
      brief: { ...brief, status: 'definitief' },
      actieveVersie: versie,
      gereserveerdBriefnummer: 'BR2026000001',
    })).toThrow('Alleen een conceptbrief kan definitief worden gemaakt.');
  });

  it('houdt printdatum en verzenddatum in verschillende RPC-contracten', () => {
    const batch = {
      id: 'batch-1',
      batchnummer: 'BAT2026080601',
      status: 'documenten_gegenereerd' as const,
      documentversie: 1,
      aanvullingOpBatchId: null,
      printdatum: null,
      verzenddatum: null,
      geannuleerdOp: null,
      annuleringsreden: null,
    };

    const print = bouwProductieRpcAanroep({
      actie: 'batch_geprint_markeren',
      ...context,
      batch,
      printdatum: '2026-08-06T09:00:00.000Z',
    });

    expect(print.parameters).toHaveProperty('p_printdatum');
    expect(print.parameters).not.toHaveProperty('p_verzenddatum');
  });

  it('neemt geadresseerde-identiteit expliciet op bij posten', () => {
    const aanroep = bouwProductieRpcAanroep({
      actie: 'brief_gepost_markeren',
      ...context,
      brief: { ...brief, status: 'definitief', briefnummer: 'BR2026000001' },
      actieveVersie: versie,
      batch: {
        id: 'batch-1',
        batchnummer: 'BAT2026080601',
        status: 'geprint',
        documentversie: 1,
        aanvullingOpBatchId: null,
        printdatum: '2026-08-06T09:00:00.000Z',
        verzenddatum: null,
        geannuleerdOp: null,
        annuleringsreden: null,
      },
      verzenddatum: '2026-08-06T10:00:00.000Z',
      geadresseerdeKey: 'geadresseerde-1',
    });

    expect(aanroep.rpc).toBe('markeer_off_market_brief_gepost');
    expect(aanroep.parameters).toMatchObject({
      p_brief_id: 'brief-1',
      p_brief_versie_id: 'versie-1',
      p_batch_id: 'batch-1',
      p_geadresseerde_key: 'geadresseerde-1',
      p_verzenddatum: '2026-08-06T10:00:00.000Z',
    });
  });
});
