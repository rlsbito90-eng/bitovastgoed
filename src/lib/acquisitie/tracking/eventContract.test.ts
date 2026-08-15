import { describe, expect, it } from 'vitest';
import { projecteerBriefEventNaarAcquisitieEvent } from './eventContract';

describe('TRACK-1 uniform acquisitie-eventcontract', () => {
  it('projecteert Radar en Vastgoedkansen naar dezelfde verzendsemantiek', () => {
    const radar = projecteerBriefEventNaarAcquisitieEvent({
      signaal_id: 'signaal-1',
      event_type: 'posted',
    });
    const vastgoedkans = projecteerBriefEventNaarAcquisitieEvent({
      vastgoedkans_id: 'kans-1',
      event_type: 'sent',
      kanaal: 'email',
    });

    expect(radar).toMatchObject({
      bron: 'off_market_radar',
      feit: 'communicatie_verzonden',
      kanaal: 'post',
      teltAlsVerzondenCommunicatie: true,
    });
    expect(vastgoedkans).toMatchObject({
      bron: 'vastgoedkansen',
      feit: 'communicatie_verzonden',
      kanaal: 'email',
      teltAlsVerzondenCommunicatie: true,
    });
  });

  it('telt gegenereerd, geprint of gekopieerde emailtekst niet als verzonden', () => {
    for (const event_type of ['pdf_generated', 'printed', 'email_text_copied'] as const) {
      const event = projecteerBriefEventNaarAcquisitieEvent({
        signaal_id: 'signaal-1',
        event_type,
      });
      expect(event?.teltAlsVerzondenCommunicatie).toBe(false);
    }
  });

  it('behandelt geen_reactie niet als inbound gebeurtenis', () => {
    const event = projecteerBriefEventNaarAcquisitieEvent({
      signaal_id: 'signaal-1',
      event_type: 'response_received',
      status: 'geen_reactie',
    });

    expect(event).toBeNull();
  });

  it('scheidt een echte reactie van het sentiment', () => {
    const positief = projecteerBriefEventNaarAcquisitieEvent({
      signaal_id: 'signaal-1',
      event_type: 'response_received',
      status: 'interesse',
    });
    const negatief = projecteerBriefEventNaarAcquisitieEvent({
      signaal_id: 'signaal-1',
      event_type: 'response_received',
      status: 'niet_geinteresseerd',
    });

    expect(positief).toMatchObject({
      feit: 'reactie_ontvangen',
      teltAlsReactie: true,
      sentiment: 'positief',
    });
    expect(negatief).toMatchObject({
      feit: 'reactie_ontvangen',
      teltAlsReactie: true,
      sentiment: 'negatief',
    });
  });

  it('telt retourpost niet als commerciële reactie', () => {
    const event = projecteerBriefEventNaarAcquisitieEvent({
      signaal_id: 'signaal-1',
      event_type: 'returned_mail',
    });

    expect(event).toMatchObject({
      feit: 'post_retour',
      inbound: true,
      teltAlsReactie: false,
    });
  });
});
