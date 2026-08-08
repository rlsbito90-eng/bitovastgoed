import { describe, expect, it } from 'vitest';

import { bouwLegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';

const selectie = {
  id: 'selectie-1',
  signaal_id: 'signaal-1',
  notitie: null,
  toegevoegd_door: 'gebruiker-1',
  toegevoegd_op: '2026-08-01T10:00:00.000Z',
  archived_at: null,
};

const brief = {
  id: 'brief-1',
  signaal_id: 'signaal-1',
  eigenaar_naam: 'Mevrouw Voorbeeld',
  eigenaar_bedrijfsnaam: null,
  verzendadres: 'Markt 1, 1012 JS Amsterdam',
  objectadres: 'Markt 1',
  aanhef: 'Geachte mevrouw Voorbeeld,',
  onderwerp: 'Uw vastgoed',
  brieftekst: 'Brieftekst',
  status: 'verstuurd',
  verzonden_op: '2026-08-03T09:00:00.000Z',
  created_at: '2026-08-02T09:00:00.000Z',
  objectomschrijving: null,
  archived_at: null,
  archived_reason: null,
  geadresseerde_key: 'geadresseerde-1',
  printdatum: '2026-08-02T12:00:00.000Z',
  postdatum: '2026-08-03T09:00:00.000Z',
  verzendstatus: 'verstuurd',
};

const adres = {
  straatHuisnummer: 'Markt 1',
  postcode: '1012 JS',
  plaats: 'Amsterdam',
  land: 'Nederland',
};

const event = {
  id: 'event-1',
  signaal_id: 'signaal-1',
  brief_id: 'brief-1',
  geadresseerde_key: 'geadresseerde-1',
  campagne_stap: 'brief_1',
  kanaal: 'post',
  event_type: 'posted',
  event_date: '2026-08-03T09:00:00.000Z',
  status: 'verstuurd',
  metadata: {},
  created_at: '2026-08-03T09:01:00.000Z',
  created_by: 'gebruiker-1',
};

describe('bouwLegacyProductiedossierReadmodel', () => {
  it('koppelt selectie, brief en audit zonder nieuwe identiteit te verzinnen', () => {
    const model = bouwLegacyProductiedossierReadmodel({
      selectie,
      brieven: [{ rij: brief, adres }],
      events: [event],
    });

    expect(model.dossier.selectieId).toBe('selectie-1');
    expect(model.dossier.primaireWerkbak).toBe('nieuwe_selectie');
    expect(model.brieven).toHaveLength(1);
    expect(model.brieven[0].brief).toMatchObject({
      id: 'brief-1',
      briefnummer: null,
      selectieId: 'selectie-1',
    });
    expect(model.brieven[0].audit.map(item => item.eventId)).toEqual(['event-1']);
    expect(model.losgekoppeldeAudit).toEqual([]);
  });

  it('houdt printdatum en postdatum afzonderlijk', () => {
    const model = bouwLegacyProductiedossierReadmodel({
      selectie,
      brieven: [{ rij: brief, adres }],
      events: [event],
    });

    expect(model.brieven[0].printdatum).toBe('2026-08-02T12:00:00.000Z');
    expect(model.brieven[0].postdatum).toBe('2026-08-03T09:00:00.000Z');
    expect(model.brieven[0].versie.verzondenOp).toBe('2026-08-03T09:00:00.000Z');
  });

  it('neemt events van andere signalen niet op', () => {
    const model = bouwLegacyProductiedossierReadmodel({
      selectie,
      brieven: [{ rij: brief, adres }],
      events: [{ ...event, id: 'event-ander', signaal_id: 'signaal-ander' }],
    });

    expect(model.brieven[0].audit).toEqual([]);
    expect(model.losgekoppeldeAudit).toEqual([]);
  });

  it('behoudt events zonder briefkoppeling als losgekoppelde audit', () => {
    const model = bouwLegacyProductiedossierReadmodel({
      selectie,
      brieven: [{ rij: brief, adres }],
      events: [{ ...event, id: 'event-los', brief_id: null }],
    });

    expect(model.losgekoppeldeAudit.map(item => item.eventId)).toEqual(['event-los']);
    expect(model.waarschuwingen).toContain(
      '1 audit-event(s) konden niet hard aan een aanwezige brief worden gekoppeld.',
    );
  });

  it('behoudt events die verwijzen naar een ontbrekende legacybrief', () => {
    const model = bouwLegacyProductiedossierReadmodel({
      selectie,
      brieven: [],
      events: [{ ...event, id: 'event-wees', brief_id: 'brief-ontbreekt' }],
    });

    expect(model.losgekoppeldeAudit.map(item => item.eventId)).toEqual(['event-wees']);
    expect(model.waarschuwingen).toContain(
      'Audit-events verwijzen naar ontbrekende legacybrief: brief-ontbreekt',
    );
  });

  it('koppelt alleen brieven van hetzelfde signaal', () => {
    const model = bouwLegacyProductiedossierReadmodel({
      selectie,
      brieven: [
        { rij: brief, adres },
        { rij: { ...brief, id: 'brief-ander', signaal_id: 'signaal-ander' }, adres },
      ],
      events: [],
    });

    expect(model.brieven.map(item => item.brief.id)).toEqual(['brief-1']);
  });
});
