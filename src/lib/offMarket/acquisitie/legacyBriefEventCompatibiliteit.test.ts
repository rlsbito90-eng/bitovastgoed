import { describe, expect, it } from 'vitest';

import {
  legacyBriefEventNaarProductieAudit,
  sorteerProductieAuditChronologisch,
} from './legacyBriefEventCompatibiliteit';

const basis = {
  id: 'event-1',
  signaal_id: 'signaal-1',
  brief_id: 'brief-1',
  geadresseerde_key: 'geadresseerde-1',
  campagne_stap: 'brief_1',
  kanaal: 'post',
  event_type: 'posted',
  event_date: '2026-08-03T09:00:00.000Z',
  status: 'verstuurd',
  metadata: { bron: 'legacy' },
  created_at: '2026-08-03T09:01:00.000Z',
  created_by: 'gebruiker-1',
};

describe('legacyBriefEventNaarProductieAudit', () => {
  it('behoudt bekende eventtypen en herkomstvelden', () => {
    const resultaat = legacyBriefEventNaarProductieAudit(basis);

    expect(resultaat).toMatchObject({
      eventId: 'event-1',
      signaalId: 'signaal-1',
      briefId: 'brief-1',
      geadresseerdeKey: 'geadresseerde-1',
      eventType: 'posted',
      oorspronkelijkEventType: 'posted',
      bron: 'off_market_brief_events',
      metadata: { bron: 'legacy' },
    });
    expect(resultaat.waarschuwingen).toEqual([]);
  });

  it('verliest onbekende historische eventtypen niet', () => {
    const resultaat = legacyBriefEventNaarProductieAudit({
      ...basis,
      event_type: 'historisch_custom_event',
    });

    expect(resultaat.eventType).toBe('onbekend_legacy_event');
    expect(resultaat.oorspronkelijkEventType).toBe('historisch_custom_event');
    expect(resultaat.waarschuwingen).toContain(
      'Onbekend legacy-eventtype behouden: historisch_custom_event',
    );
  });

  it('signaleert een productie-event zonder briefkoppeling', () => {
    const resultaat = legacyBriefEventNaarProductieAudit({
      ...basis,
      brief_id: null,
      event_type: 'printed',
    });

    expect(resultaat.waarschuwingen).toContain(
      'Productiegebeurtenis heeft geen brief_id en kan niet hard aan één brief worden gekoppeld.',
    );
  });

  it('signaleert verzending zonder geadresseerde-identiteit', () => {
    const resultaat = legacyBriefEventNaarProductieAudit({
      ...basis,
      geadresseerde_key: null,
      event_type: 'sent',
    });

    expect(resultaat.waarschuwingen).toContain(
      'Verzendgebeurtenis mist geadresseerde_key; opvolging per geadresseerde blijft onzeker.',
    );
  });

  it('normaliseert ontbrekende metadata naar een leeg object', () => {
    const resultaat = legacyBriefEventNaarProductieAudit({
      ...basis,
      metadata: null,
    });

    expect(resultaat.metadata).toEqual({});
  });
});

describe('sorteerProductieAuditChronologisch', () => {
  it('sorteert deterministisch op gebeurtenis, registratie en event-id', () => {
    const laat = legacyBriefEventNaarProductieAudit({
      ...basis,
      id: 'event-b',
      event_date: '2026-08-04T09:00:00.000Z',
    });
    const vroegB = legacyBriefEventNaarProductieAudit({
      ...basis,
      id: 'event-b',
      event_date: '2026-08-02T09:00:00.000Z',
      created_at: '2026-08-02T09:01:00.000Z',
    });
    const vroegA = legacyBriefEventNaarProductieAudit({
      ...basis,
      id: 'event-a',
      event_date: '2026-08-02T09:00:00.000Z',
      created_at: '2026-08-02T09:01:00.000Z',
    });

    expect(sorteerProductieAuditChronologisch([laat, vroegB, vroegA]).map(e => e.eventId))
      .toEqual(['event-a', 'event-b', 'event-b']);
  });
});
