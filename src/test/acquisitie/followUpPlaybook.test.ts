import { describe, expect, it } from 'vitest';
import { bepaalFollowUpActie } from '@/lib/acquisitie/followUpPlaybook';

describe('acquisitie follow-up playbook', () => {
  const nu = new Date('2026-08-23T10:00:00Z');

  it('adviseert Brief 2 pas na 21 dagen zonder reactie', () => {
    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_1',
      laatsteVerzondenOp: '2026-08-10T09:00:00Z',
      responsstatus: 'geen_reactie',
      nu,
    }).actie).toBe('wachten');

    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_1',
      laatsteVerzondenOp: '2026-08-01T09:00:00Z',
      responsstatus: 'geen_reactie',
      nu,
    }).actie).toBe('brief_2_voorbereiden');
  });

  it('adviseert Brief 3 pas na 28 dagen zonder reactie op Brief 2', () => {
    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_2',
      laatsteVerzondenOp: '2026-07-20T09:00:00Z',
      responsstatus: 'geen_reactie',
      nu,
    }).actie).toBe('brief_3_voorbereiden');
  });

  it('stopt de standaardsequence zodra inhoudelijke respons is geregistreerd', () => {
    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_1',
      laatsteVerzondenOp: '2026-07-01T09:00:00Z',
      responsstatus: 'interesse',
      nu,
    }).actie).toBe('sequence_stop');

    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_1',
      laatsteVerzondenOp: '2026-07-01T09:00:00Z',
      responsstatus: 'niet_geinteresseerd',
      nu,
    }).actie).toBe('sequence_stop');
  });

  it('zet later opnieuw benaderen buiten de standaard no-response sequence', () => {
    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_1',
      laatsteVerzondenOp: '2026-07-01T09:00:00Z',
      responsstatus: 'later_opnieuw_benaderen',
      nu,
    }).actie).toBe('handmatige_opvolging');
  });

  it('gaat na Brief 3 pas na circa 9 maanden naar nurture', () => {
    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_3',
      laatsteVerzondenOp: '2026-08-01T09:00:00Z',
      responsstatus: 'geen_reactie',
      nu,
    }).actie).toBe('wachten');

    expect(bepaalFollowUpActie({
      laatsteStap: 'brief_3',
      laatsteVerzondenOp: '2025-10-01T09:00:00Z',
      responsstatus: 'geen_reactie',
      nu,
    }).actie).toBe('nurture_herbenaderen');
  });
});
