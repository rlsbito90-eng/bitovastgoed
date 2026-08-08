import { describe, expect, it } from 'vitest';

import {
  mapAcquisitiedossierRij,
  mapBriefRij,
  mapBriefversieRij,
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
