import { describe, expect, it } from 'vitest';
import { valideerOpvolgkeuze } from '@/hooks/useBriefOpvolgkeuze';
import { bouwMarkeerBulkPlan } from '@/components/offmarket/acquisitie/MarkeerBulkDialog';

function brief(extra: Record<string, unknown> = {}) {
  return {
    id: 'brief-1',
    signaal_id: 'sig-1',
    kanaal: 'post',
    status: 'concept',
    verzendstatus: 'geprint',
    archived_at: null,
    ...extra,
  } as any;
}

describe('valideerOpvolgkeuze', () => {
  it('vereist datum en gekoppelde taak bij opvolgtaak plannen', () => {
    const basis = {
      briefId: 'brief-1',
      signaalId: 'sig-1',
      keuze: 'taak_plannen' as const,
    };
    expect(valideerOpvolgkeuze(basis)).toBe('Kies een opvolgdatum.');
    expect(valideerOpvolgkeuze({ ...basis, opvolgdatum: '2026-08-22' }))
      .toBe('De opvolgtaak kon niet worden gekoppeld.');
    expect(valideerOpvolgkeuze({
      ...basis,
      opvolgdatum: '2026-08-22',
      gekoppeldeTaakId: 'taak-1',
    })).toBeNull();
  });

  it('vereist een inhoudelijke reden bij bewust overslaan', () => {
    const basis = {
      briefId: 'brief-1',
      signaalId: 'sig-1',
      keuze: 'bewust_overslaan' as const,
    };
    expect(valideerOpvolgkeuze(basis))
      .toBe('Leg vast waarom opvolging bewust wordt overgeslagen.');
    expect(valideerOpvolgkeuze({ ...basis, overslaReden: '   ' }))
      .toBe('Leg vast waarom opvolging bewust wordt overgeslagen.');
    expect(valideerOpvolgkeuze({ ...basis, overslaReden: 'Eigenaar heeft afgewezen.' }))
      .toBeNull();
  });
});

describe('bouwMarkeerBulkPlan', () => {
  it('neemt alleen geprinte, nog niet geposte postbrieven mee voor gepost', () => {
    const plan = bouwMarkeerBulkPlan([
      brief({ id: 'gereed', verzendstatus: 'geprint' }),
      brief({ id: 'niet-geprint', verzendstatus: 'concept' }),
      brief({ id: 'al-gepost', status: 'verstuurd', verzendstatus: 'gepost' }),
      brief({ id: 'email', kanaal: 'email' }),
      brief({ id: 'archief', archived_at: '2026-08-01T00:00:00Z' }),
    ], 'gepost');

    expect(plan.teVerwerken.map((b) => b.id)).toEqual(['gereed']);
    expect(plan.overgeslagen).toHaveLength(4);
  });

  it('neemt voor geprint alleen actieve, nog niet geprinte postbrieven mee', () => {
    const plan = bouwMarkeerBulkPlan([
      brief({ id: 'concept', verzendstatus: 'concept' }),
      brief({ id: 'al-geprint', verzendstatus: 'geprint' }),
      brief({ id: 'email', kanaal: 'email', verzendstatus: 'concept' }),
    ], 'geprint');

    expect(plan.teVerwerken.map((b) => b.id)).toEqual(['concept']);
    expect(plan.overgeslagen).toHaveLength(2);
  });
});
