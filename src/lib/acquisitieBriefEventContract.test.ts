import { describe, expect, it } from 'vitest';
import { naarAcquisitieBriefEventRow } from './acquisitieBriefEventContract';

describe('acquisitieBriefEventContract', () => {
  it('bouwt een geldig Off-Market-event', () => {
    const row = naarAcquisitieBriefEventRow({
      dossierType: 'off_market_signaal',
      signaalId: 'signaal-1',
      eventType: 'sent',
      briefNummer: 1,
      relatieId: 'relatie-1',
    });

    expect(row.signaal_id).toBe('signaal-1');
    expect(row.vastgoedkans_id).toBeNull();
    expect(row.dossier_type).toBe('off_market_signaal');
    expect(row.brief_nummer).toBe(1);
  });

  it('bouwt een geldig Vastgoedkans-event', () => {
    const row = naarAcquisitieBriefEventRow({
      dossierType: 'vastgoedkans',
      vastgoedkansId: 'kans-1',
      eventType: 'response_received',
      responsStatus: 'interesse',
      volgendeActie: 'kwalificeren',
    });

    expect(row.signaal_id).toBeNull();
    expect(row.vastgoedkans_id).toBe('kans-1');
    expect(row.respons_status).toBe('interesse');
    expect(row.volgende_actie).toBe('kwalificeren');
  });

  it('weigert een Off-Market-event zonder signaal', () => {
    expect(() => naarAcquisitieBriefEventRow({
      dossierType: 'off_market_signaal',
      eventType: 'concept_created',
    })).toThrow('signaalId');
  });

  it('weigert twee dossierreferenties tegelijk', () => {
    expect(() => naarAcquisitieBriefEventRow({
      dossierType: 'vastgoedkans',
      signaalId: 'signaal-1',
      vastgoedkansId: 'kans-1',
      eventType: 'concept_created',
    })).toThrow('uitsluitend');
  });

  it('normaliseert lege optionele waarden naar null', () => {
    const row = naarAcquisitieBriefEventRow({
      dossierType: 'vastgoedkans',
      vastgoedkansId: ' kans-1 ',
      eventType: 'follow_up_created',
      relatieId: ' ',
      volgendeActieOp: '',
    });

    expect(row.vastgoedkans_id).toBe('kans-1');
    expect(row.relatie_id).toBeNull();
    expect(row.volgende_actie_op).toBeNull();
  });
});
