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
  it('bouwt exact de SQL-aanroep voor definitief maken', () => {
    const aanroep = bouwProductieRpcAanroep({
      actie: 'brief_definitief_maken',
      ...context,
      brief,
      actieveVersie: versie,
      jaar: 2026,
    });

    expect(aanroep).toEqual({
      rpc: 'off_market_brief_definitief_maken',
      parameters: {
        p_brief_id: 'brief-1',
        p_brief_versie_id: 'versie-1',
        p_actor_id: 'actor-1',
        p_operation_key: context.operationKey,
        p_verwacht_versienummer: 1,
        p_uitgevoerd_op: context.uitgevoerdOp,
        p_jaar: 2026,
      },
    });
  });

  it('weigert ongeldige transacties voordat een RPC wordt gebouwd', () => {
    expect(() => bouwProductieRpcAanroep({
      actie: 'brief_definitief_maken',
      ...context,
      brief: { ...brief, status: 'definitief' },
      actieveVersie: versie,
      jaar: 2026,
    })).toThrow('Alleen een conceptbrief kan definitief worden gemaakt.');
  });

  it('gebruikt documentversie-parameter conform SQL bij printen', () => {
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

    expect(print).toEqual({
      rpc: 'off_market_batch_geprint_markeren',
      parameters: {
        p_batch_id: 'batch-1',
        p_actor_id: 'actor-1',
        p_operation_key: context.operationKey,
        p_verwacht_documentversie: 1,
        p_printdatum: '2026-08-06T09:00:00.000Z',
      },
    });
    expect(print.parameters).not.toHaveProperty('p_verzenddatum');
    expect(print.parameters).not.toHaveProperty('p_uitgevoerd_op');
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

    expect(aanroep.rpc).toBe('off_market_brief_gepost_markeren');
    expect(aanroep.parameters).toEqual({
      p_brief_id: 'brief-1',
      p_brief_versie_id: 'versie-1',
      p_batch_id: 'batch-1',
      p_geadresseerde_key: 'geadresseerde-1',
      p_actor_id: 'actor-1',
      p_operation_key: context.operationKey,
      p_verwacht_versienummer: 1,
      p_verzenddatum: '2026-08-06T10:00:00.000Z',
    });
  });

  it('bouwt een afzonderlijke atomische RPC voor documentversie-upgrade', () => {
    const batch = {
      id: 'batch-1', batchnummer: 'BAT2026080601', status: 'documenten_gegenereerd' as const,
      documentversie: 1, aanvullingOpBatchId: null, printdatum: null, verzenddatum: null,
      geannuleerdOp: null, annuleringsreden: null,
    };
    const documenttypen = ['batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels'] as const;
    const opgeslagenDocumenten = documenttypen.map((documenttype, index) => ({
      id: `doc-${index}`, batchId: batch.id, documentversie: 2, documenttype,
      bestandReferentie: `off-market-productie/actor-1/batch-1/v2/poging/${documenttype}`,
      status: 'actief' as const, metadata: { bestandsnaam: `${documenttype}.pdf` },
      createdAt: context.uitgevoerdOp, vervallenOp: null,
    }));
    const plan = {
      batchId: batch.id,
      batchnummer: batch.batchnummer,
      documentversie: 2,
      briefAantal: 1,
      geadresseerdeAantal: 1,
      documenten: documenttypen.map((documenttype) => ({
        documenttype, bestandsnaam: `${documenttype}.pdf`, documentversie: 2,
        briefVersieIds: ['versie-1'],
      })),
      waarschuwingen: [],
    };

    const aanroep = bouwProductieRpcAanroep({
      actie: 'batch_documentversie_vernieuwen',
      ...context,
      operationKey: 'batch-documentversie:batch-1:v2',
      batch,
      plan,
      opgeslagenDocumenten,
      nieuweDocumentversie: 2,
      reden: 'Huisstijlherstel',
    });

    expect(aanroep).toEqual({
      rpc: 'off_market_batch_documentversie_vernieuwen',
      parameters: {
        p_batch_id: 'batch-1',
        p_actor_id: 'actor-1',
        p_operation_key: 'batch-documentversie:batch-1:v2',
        p_verwacht_documentversie: 1,
        p_nieuwe_documentversie: 2,
        p_uitgevoerd_op: context.uitgevoerdOp,
        p_reden: 'Huisstijlherstel',
        p_documenten: opgeslagenDocumenten.map((document) => ({
          documenttype: document.documenttype,
          bestand_referentie: document.bestandReferentie,
          metadata: document.metadata,
        })),
      },
    });
  });
});
