import { describe, expect, it } from 'vitest';
import {
  deadlineLabel,
  getDeadlineDateTime,
  isTaakTeLaat,
  isTaakVandaag,
  isTaakDezeWeek,
  sorteerTaken,
} from '@/lib/taakHelpers';

describe('taakplanning — deadline is optioneel', () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);

  it('behandelt een taak zonder deadline niet als vandaag, deze week of verlopen', () => {
    const taak = { deadline: '', deadlineTijd: undefined, status: 'open' } as any;

    expect(getDeadlineDateTime(taak)).toBeNull();
    expect(isTaakVandaag(taak, now)).toBe(false);
    expect(isTaakDezeWeek(taak, now)).toBe(false);
    expect(isTaakTeLaat(taak, now)).toBe(false);
    expect(deadlineLabel(taak, now)).toBe('Geen datum');
  });

  it('sorteert een gedateerde taak vóór een taak zonder datum', () => {
    const zonderDatum = {
      id: 'zonder',
      titel: 'Zonder deadline',
      deadline: '',
      prioriteit: 'urgent',
      status: 'open',
    } as any;
    const metDatum = {
      id: 'met',
      titel: 'Met deadline',
      deadline: '2026-08-19',
      prioriteit: 'laag',
      status: 'open',
    } as any;

    expect(sorteerTaken([zonderDatum, metDatum], now).map((taak) => taak.id)).toEqual(['met', 'zonder']);
  });
});
