import { describe, expect, it } from 'vitest';
import { maakEigenaarGeidentificeerdEvent, projecteerKadasterKostenEventNaarAcquisitieEvent } from './domainEventContract';
import type { KadasterKostenEventRow } from '@/lib/kadaster/databaseContract';

function kadasterEvent(overrides: Partial<KadasterKostenEventRow> = {}): KadasterKostenEventRow {
  return {
    id: 'event-1',
    product_code: 'eigendomsinformatie',
    status: 'bevestigd',
    bron_module: 'vastgoedkansen',
    bron_record_id: 'kans-1',
    aantal_eenheden: 1,
    geraamde_kosten: 3.10,
    werkelijke_kosten: null,
    valuta: 'EUR',
    gebruiker_id: 'user-1',
    crm_objectregistratie_id: 'crm-object-1',
    vastgoedkans_id: 'kans-1',
    object_id: 'object-1',
    campagne_id: null,
    adres_label: 'Voorbeeldstraat 1',
    externe_request_id: 'REQ-1',
    hergebruikt_van_event_id: null,
    aangevraagd_op: '2026-08-15T10:00:00Z',
    geleverd_op: null,
    metadata: {},
    created_at: '2026-08-15T10:00:00Z',
    ...overrides,
  };
}

describe('TRACK-1B acquisitie-domeincontract', () => {
  it('projecteert een bevestigde Kadasteraanvraag als feitelijke aanvraag', () => {
    expect(projecteerKadasterKostenEventNaarAcquisitieEvent(kadasterEvent())).toMatchObject({
      type: 'kadaster_aangevraagd',
      bron: 'vastgoedkansen',
      externalReference: 'REQ-1',
      idempotencyKey: 'kadaster:REQ-1:kadaster_aangevraagd',
    });
  });

  it('projecteert levering apart van aanvraag', () => {
    expect(projecteerKadasterKostenEventNaarAcquisitieEvent(kadasterEvent({
      status: 'geleverd',
      geleverd_op: '2026-08-15T10:05:00Z',
      werkelijke_kosten: 3.10,
    }))).toMatchObject({
      type: 'kadaster_geleverd',
      occurredAt: '2026-08-15T10:05:00Z',
    });
  });

  it('telt hergebruik niet als nieuwe Kadasteraanvraag', () => {
    expect(projecteerKadasterKostenEventNaarAcquisitieEvent(kadasterEvent({ status: 'hergebruikt' }))).toBeNull();
  });

  it('markeert mislukte of geannuleerde requests als mislukt en niet als levering', () => {
    expect(projecteerKadasterKostenEventNaarAcquisitieEvent(kadasterEvent({ status: 'mislukt' }))).toMatchObject({ type: 'kadaster_mislukt' });
    expect(projecteerKadasterKostenEventNaarAcquisitieEvent(kadasterEvent({ status: 'geannuleerd' }))).toMatchObject({ type: 'kadaster_mislukt' });
  });

  it('maakt een eigenaarfeit alleen bij exact één dossier en een eigenaar', () => {
    expect(maakEigenaarGeidentificeerdEvent({
      bron: 'off_market_radar',
      occurredAt: '2026-08-15T11:00:00Z',
      signaalId: 'signaal-1',
      eigenaarId: 'eigenaar-1',
    })).toMatchObject({ type: 'eigenaar_geidentificeerd', bron: 'off_market_radar' });

    expect(maakEigenaarGeidentificeerdEvent({
      bron: 'off_market_radar',
      occurredAt: '2026-08-15T11:00:00Z',
      signaalId: 'signaal-1',
      vastgoedkansId: 'kans-1',
      eigenaarId: 'eigenaar-1',
    })).toBeNull();
  });
});
