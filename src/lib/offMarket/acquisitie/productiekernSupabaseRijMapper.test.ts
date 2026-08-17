import { describe, expect, it } from 'vitest';

import {
  mapAcquisitiedossierRij,
  mapBatchdocumentRij,
  mapBriefRij,
  mapBriefversieRij,
  mapPrintbatchBriefRij,
  mapPrintbatchRij,
  ProductiekernRijOngeldigError,
} from './productiekernSupabaseRijMapper';

describe('productiekern Supabase rijmappers', () => {
  it('mapt een acquisitiedossier zonder heuristieken', () => {
    expect(mapAcquisitiedossierRij({
      selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
      verwerking_gestart_op: null, verwerking_gestart_door: null,
      primaire_werkbak: 'nieuwe_selectie', volgende_actie_op: null,
      volgende_actie_omschrijving: null,
    })).toEqual({
      selectieId: 'selectie-1', signaalId: 'signaal-1', objectId: null,
      verwerkingGestartOp: null, verwerkingGestartDoor: null,
      primaireWerkbak: 'nieuwe_selectie', volgendeActieOp: null,
      volgendeActieOmschrijving: null,
    });
  });

  it('mapt brief, versie en printbatch naar de domeincontracten', () => {
    expect(mapBriefRij({
      id: 'brief-1', briefnummer: 'BR2026000482', signaal_id: 'signaal-1',
      selectie_id: 'selectie-1', object_id: null, relatie_id: null,
      actieve_versie: 1, status: 'definitief', vervanging_van_brief_id: null,
      definitief_op: '2026-08-06T12:00:00Z', vergrendeld_op: '2026-08-06T12:00:00Z',
      annuleringsreden: null,
    }).briefnummer).toBe('BR2026000482');

    expect(mapBriefversieRij({
      id: 'versie-1', brief_id: 'brief-1', versienummer: 1, status: 'actief',
      inhoud_snapshot: { brieftekst: 'Tekst' },
      geadresseerde_snapshot: { naam: 'Eigenaar' }, bestand_referentie: null,
      created_at: '2026-08-06T12:00:00Z', vervallen_op: null, verzonden_op: null,
    }).versienummer).toBe(1);

    expect(mapPrintbatchRij({
      id: 'batch-1', batchnummer: 'BAT2026080601', status: 'concept',
      documentversie: 1, aanvulling_op_batch_id: null, printdatum: null,
      verzenddatum: null, geannuleerd_op: null, annuleringsreden: null,
    }).batchnummer).toBe('BAT2026080601');
  });

  it('normaliseert PostgREST timestamptz offsets en microseconden naar canoniek UTC', () => {
    expect(mapBriefversieRij({
      id: 'versie-1', brief_id: 'brief-1', versienummer: 1, status: 'actief',
      inhoud_snapshot: { brieftekst: 'Tekst' },
      geadresseerde_snapshot: { naam: 'Eigenaar' }, bestand_referentie: null,
      created_at: '2026-08-17T08:14:44.995+00:00', vervallen_op: null, verzonden_op: null,
    }).createdAt).toBe('2026-08-17T08:14:44.995Z');

    expect(mapAcquisitiedossierRij({
      selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
      verwerking_gestart_op: '2026-08-16T23:40:23.143+00:00', verwerking_gestart_door: 'actor-1',
      primaire_werkbak: 'brief_opstellen', volgende_actie_op: null,
      volgende_actie_omschrijving: null,
    }).verwerkingGestartOp).toBe('2026-08-16T23:40:23.143Z');

    expect(mapBriefRij({
      id: 'brief-1', briefnummer: 'BR2026000001', signaal_id: 'signaal-1', selectie_id: 'selectie-1',
      object_id: null, relatie_id: null, actieve_versie: 1, status: 'definitief', vervanging_van_brief_id: null,
      definitief_op: '2026-08-17T08:14:45.306074+00:00', vergrendeld_op: '2026-08-17T08:14:45.306074+00:00',
      annuleringsreden: null,
    }).definitiefOp).toBe('2026-08-17T08:14:45.306Z');

    expect(mapPrintbatchRij({
      id: 'batch-1', batchnummer: 'BAT2026081701', status: 'geprint', documentversie: 1,
      aanvulling_op_batch_id: null, printdatum: '2026-08-17T10:20:30.123456+02:00',
      verzenddatum: null, geannuleerd_op: null, annuleringsreden: null,
    }).printdatum).toBe('2026-08-17T08:20:30.123Z');

    expect(mapPrintbatchBriefRij({
      id: 'koppeling-1', batch_id: 'batch-1', brief_id: 'brief-1', brief_versie_id: 'versie-1',
      verwijderd_op: '2026-08-17T08:20:30.123456+00:00', afwijkingsstatus: null, afwijkingsreden: null,
    }).verwijderdOp).toBe('2026-08-17T08:20:30.123Z');

    expect(mapBatchdocumentRij({
      id: 'document-1', batch_id: 'batch-1', documentversie: 1, documenttype: 'brieven_pdf',
      bestand_referentie: 'actor/batch/v1/brieven.pdf', status: 'actief', metadata: {},
      created_at: '2026-08-17T08:20:30.123456+00:00', vervallen_op: null,
    }).createdAt).toBe('2026-08-17T08:20:30.123Z');
  });

  it('weigert timezone-loze of niet-parseerbare timestamps fail-closed', () => {
    expect(() => mapBriefversieRij({
      id: 'versie-1', brief_id: 'brief-1', versienummer: 1, status: 'actief',
      inhoud_snapshot: { brieftekst: 'Tekst' }, geadresseerde_snapshot: { naam: 'Eigenaar' },
      bestand_referentie: null, created_at: '2026-08-17T08:14:44.995', vervallen_op: null, verzonden_op: null,
    })).toThrow('created_at is geen geldig timestamptz');

    expect(() => mapBriefversieRij({
      id: 'versie-1', brief_id: 'brief-1', versienummer: 1, status: 'actief',
      inhoud_snapshot: { brieftekst: 'Tekst' }, geadresseerde_snapshot: { naam: 'Eigenaar' },
      bestand_referentie: null, created_at: '2026-99-99T08:14:44+00:00', vervallen_op: null, verzonden_op: null,
    })).toThrow('created_at is niet parseerbaar');
  });

  it('weigert onbekende enumwaarden en ontbrekende verplichte velden fail-closed', () => {
    expect(() => mapAcquisitiedossierRij({
      selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
      verwerking_gestart_op: null, verwerking_gestart_door: null,
      primaire_werkbak: 'onbekend', volgende_actie_op: null,
      volgende_actie_omschrijving: null,
    })).toThrow(ProductiekernRijOngeldigError);

    expect(() => mapBriefRij({ status: 'concept' })).toThrow(
      'Brief-rij is ongeldig: id ontbreekt',
    );
  });

  it('onderscheidt null van ongeldige typen', () => {
    expect(() => mapBriefRij({
      id: 'brief-1', briefnummer: null, signaal_id: 'signaal-1', selectie_id: null,
      object_id: 42, relatie_id: null, actieve_versie: null, status: 'concept',
      vervanging_van_brief_id: null, definitief_op: null, vergrendeld_op: null,
      annuleringsreden: null,
    })).toThrow('object_id is geen tekst');
  });
});
