import { describe, expect, it } from 'vitest';
import { naarWorkflowEventVanBriefEvent, projecteerBriefEventNaarWorkflow } from './acquisitieBriefWorkflowAdapter';

describe('BUILD 2.0E — bestaande briefevents naar workflow', () => {
  it('projecteert geposte brief naar opvolging zonder externe actie', () => {
    const projectie = projecteerBriefEventNaarWorkflow({
      vastgoedkans_id: 'kans-1', brief_id: 'brief-1', event_type: 'posted',
      metadata: { opvolgdatum: '2026-08-26' },
    });
    expect(projectie).toEqual({
      volgendeActie: 'Volg verzending op',
      volgendeActieOp: '2026-08-26',
      workflowMode: 'proposal',
      workflowCode: 'opvolgen',
    });
  });

  it.each([
    ['interesse', 'vervolg_interesse'],
    ['wil_meer_informatie', 'informatie_sturen'],
    ['later_opnieuw_benaderen', 'later_bellen'],
    ['niet_geinteresseerd', 'afsluiten_beoordelen'],
    ['verkeerd_adres', 'eigenaar_heronderzoek'],
  ])('vertaalt bestaande responsstatus %s naar %s', (status, code) => {
    const projectie = projecteerBriefEventNaarWorkflow({
      signaal_id: 'signaal-1', brief_id: 'brief-1', event_type: 'response_received', status,
    });
    expect(projectie.workflowCode).toBe(code);
  });

  it('maakt van geen_reactie geen inbound workflow-event', () => {
    expect(naarWorkflowEventVanBriefEvent({
      signaal_id: 'signaal-1', brief_id: 'brief-1', event_type: 'response_received', status: 'geen_reactie',
    })).toBeNull();
    expect(projecteerBriefEventNaarWorkflow({
      signaal_id: 'signaal-1', brief_id: 'brief-1', event_type: 'response_received', status: 'geen_reactie',
    })).toEqual({
      volgendeActie: null,
      volgendeActieOp: null,
      workflowMode: null,
      workflowCode: null,
    });
  });

  it('behandelt retourpost als eigenaar/adres-heronderzoek', () => {
    const event = naarWorkflowEventVanBriefEvent({
      signaal_id: 'signaal-1', brief_id: 'brief-1', event_type: 'returned_mail', status: 'retour_post',
    }, 'event-1');
    expect(event).toMatchObject({ id: 'event-1', type: 'retour_post' });
    expect(projecteerBriefEventNaarWorkflow({
      signaal_id: 'signaal-1', event_type: 'returned_mail', status: 'retour_post',
    }).workflowCode).toBe('eigenaar_heronderzoek');
  });

  it('laat audit-only events zonder workflowgevolg ongemoeid', () => {
    expect(projecteerBriefEventNaarWorkflow({
      vastgoedkans_id: 'kans-1', event_type: 'pdf_generated',
    })).toEqual({
      volgendeActie: null,
      volgendeActieOp: null,
      workflowMode: null,
      workflowCode: null,
    });
  });
});
