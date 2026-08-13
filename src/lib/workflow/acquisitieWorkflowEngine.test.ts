import { describe, expect, it } from 'vitest';
import { evalueerAcquisitieWorkflow, type AcquisitieWorkflowEvent } from './acquisitieWorkflowEngine';

const e = (id: string, type: AcquisitieWorkflowEvent['type'], occurredAt: string, metadata: Record<string, unknown> = {}): AcquisitieWorkflowEvent => ({ id, type, occurredAt, metadata });

describe('BUILD 2.0E — Workflow & Automation Engine', () => {
  it('leidt een veilige volgende actie af zonder commerciële status automatisch te wijzigen', () => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'pand_toegevoegd', '2026-08-01T10:00:00Z'),
      e('2', 'kadaster_opgehaald', '2026-08-02T10:00:00Z', { eigenaarResultaat: 'uniek' }),
      e('3', 'eigenaar_bevestigd', '2026-08-03T10:00:00Z'),
    ]);
    expect(state.lifecycle).toBe('active');
    expect(state.eigenaar).toBe('bevestigd');
    expect(state.nextAction).toMatchObject({ code: 'brief_voorbereiden', mode: 'confirmation' });
  });

  it('maakt na verzending een afgeleide opvolgactie met datum', () => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'eigenaar_bevestigd', '2026-08-01T10:00:00Z'),
      e('2', 'brief_verzonden', '2026-08-12T12:00:00Z', { opvolgdatum: '2026-08-26' }),
    ]);
    expect(state.outreach).toBe('verzonden');
    expect(state.nextAction).toMatchObject({ code: 'opvolgen', dueAt: '2026-08-26', mode: 'proposal' });
  });

  it('laat een nieuwere respons de oudere afgeleide follow-up superseden', () => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'brief_verzonden', '2026-08-12T12:00:00Z', { opvolgdatum: '2026-08-26' }),
      e('2', 'reactie_ontvangen', '2026-08-18T09:00:00Z', { uitkomst: 'interesse' }),
    ]);
    expect(state.outreach).toBe('reactie');
    expect(state.nextAction?.code).toBe('vervolg_interesse');
    expect(state.nextAction?.supersedes).toContain('opvolgen');
  });

  it('archiveert zonder historie te verwijderen en heropenen activeert bewuste herbeoordeling', () => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'brief_verzonden', '2026-08-12T12:00:00Z', { opvolgdatum: '2026-08-26' }),
      e('2', 'gearchiveerd', '2026-08-20T09:00:00Z'),
      e('3', 'heropend', '2026-08-22T09:00:00Z'),
    ]);
    expect(state.lifecycle).toBe('active');
    expect(state.outreach).toBe('verzonden');
    expect(state.nextAction).toMatchObject({ code: 'herbeoordelen', mode: 'confirmation' });
    expect(state.appliedRuleIds).toContain('lifecycle.gearchiveerd');
    expect(state.appliedRuleIds).toContain('lifecycle.heropend');
  });

  it('sluit een deal hard af en laat latere oude follow-up events geen actie heropenen', () => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'brief_verzonden', '2026-08-12T12:00:00Z', { opvolgdatum: '2026-08-26' }),
      e('2', 'deal_gesloten', '2026-08-20T09:00:00Z'),
      e('3', 'follow_up_gepland', '2026-08-21T09:00:00Z', { opvolgdatum: '2026-08-28' }),
    ]);
    expect(state.lifecycle).toBe('deal_closed');
    expect(state.nextAction).toBeNull();
  });

  it.each([
    ['meer_informatie', 'informatie_sturen', 'confirmation'],
    ['later_bellen', 'later_bellen', 'proposal'],
    ['geen_interesse', 'afsluiten_beoordelen', 'confirmation'],
    ['verkeerde_eigenaar', 'eigenaar_heronderzoek', 'confirmation'],
    ['overig', 'reactie_beoordelen', 'confirmation'],
  ] as const)('classificeert respons %s zonder autonome commerciële beslissing', (uitkomst, code, mode) => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'brief_verzonden', '2026-08-12T12:00:00Z', { opvolgdatum: '2026-08-26' }),
      e('2', 'reactie_ontvangen', '2026-08-18T09:00:00Z', { uitkomst, vervolgdatum: '2026-09-03' }),
    ]);
    expect(state.nextAction).toMatchObject({ code, mode });
    expect(state.lifecycle).toBe('active');
  });

  it('stuurt retourpost naar eigenaar/adres-heronderzoek', () => {
    const state = evalueerAcquisitieWorkflow([
      e('1', 'brief_verzonden', '2026-08-12T12:00:00Z', { opvolgdatum: '2026-08-26' }),
      e('2', 'retour_post', '2026-08-18T09:00:00Z'),
    ]);
    expect(state.outreach).toBe('retour');
    expect(state.nextAction).toMatchObject({ code: 'eigenaar_heronderzoek', mode: 'confirmation' });
  });
});
