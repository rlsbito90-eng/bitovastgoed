import { describe, expect, it } from 'vitest';
import { kiesMeestRecenteVerstuurdeBrief } from '@/components/offmarket/acquisitie/FocusOpvolgActie';

function brief(extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    status: 'verstuurd',
    archived_at: null,
    verzonden_op: null,
    postdatum: null,
    created_at: '2026-07-01T10:00:00Z',
    ...extra,
  } as any;
}

describe('kiesMeestRecenteVerstuurdeBrief', () => {
  it('kiest de meest recente actieve verstuurde brief', () => {
    const gekozen = kiesMeestRecenteVerstuurdeBrief([
      brief({ id: 'oud', verzonden_op: '2026-07-10T10:00:00Z' }),
      brief({ id: 'nieuw', verzonden_op: '2026-07-30T10:00:00Z' }),
      brief({ id: 'concept', status: 'concept', created_at: '2026-08-01T10:00:00Z' }),
      brief({ id: 'archief', archived_at: '2026-08-01T10:00:00Z', verzonden_op: '2026-08-01T09:00:00Z' }),
    ]);

    expect(gekozen?.id).toBe('nieuw');
  });

  it('valt terug op postdatum en daarna created_at', () => {
    expect(kiesMeestRecenteVerstuurdeBrief([
      brief({ id: 'created', created_at: '2026-07-20T10:00:00Z' }),
      brief({ id: 'post', postdatum: '2026-07-25' }),
    ])?.id).toBe('post');
  });

  it('geeft null wanneer geen verstuurde actieve brief bestaat', () => {
    expect(kiesMeestRecenteVerstuurdeBrief([
      brief({ status: 'concept' }),
      brief({ archived_at: '2026-08-01T00:00:00Z' }),
    ])).toBeNull();
  });
});
