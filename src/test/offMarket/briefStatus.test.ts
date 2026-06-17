import { describe, it, expect } from 'vitest';
import { bepaalBriefStatus } from '@/lib/offMarket/briefStatus';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { Taak } from '@/data/mock-data';

function brief(p: Partial<OffMarketBrief>): OffMarketBrief {
  return {
    id: p.id ?? 'b',
    signaal_id: 's1',
    eigenaar_naam: null, eigenaar_bedrijfsnaam: null,
    verzendadres: null, objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: p.status ?? 'concept',
    verzonden_op: p.verzonden_op ?? null,
    aangemaakt_door: null,
    created_at: '2026-06-01', updated_at: '2026-06-01',
    ...p,
  } as OffMarketBrief;
}

function taak(titel: string, status: any = 'open'): Taak {
  return {
    id: 't' + titel, titel, type: 'follow_up', deadline: '2026-07-01',
    prioriteit: 'normaal' as any, status, offMarketSignaalId: 's1',
  } as Taak;
}

describe('bepaalBriefStatus', () => {
  it('geen brief en geen taak → geen', () => {
    expect(bepaalBriefStatus([], [], 's1')).toBe('geen');
  });
  it('alleen concept → brief1_concept', () => {
    expect(bepaalBriefStatus([brief({ status: 'concept' })], [], 's1')).toBe('brief1_concept');
  });
  it('verstuurde brief → brief1_verstuurd', () => {
    expect(bepaalBriefStatus([brief({ status: 'verstuurd', verzonden_op: '2026-06-10' })], [], 's1'))
      .toBe('brief1_verstuurd');
  });
  it('verstuurd + open Brief 2-taak → brief2_gepland', () => {
    const res = bepaalBriefStatus(
      [brief({ status: 'verstuurd', verzonden_op: '2026-06-10' })],
      [taak('Brief 2 voorbereiden / opvolgen')],
      's1',
    );
    expect(res).toBe('brief2_gepland');
  });
  it('afgeronde Brief 2-taak telt niet als gepland', () => {
    const res = bepaalBriefStatus(
      [brief({ status: 'verstuurd', verzonden_op: '2026-06-10' })],
      [taak('Brief 2 voorbereiden / opvolgen', 'afgerond')],
      's1',
    );
    expect(res).toBe('brief1_verstuurd');
  });
  it('twee verstuurde brieven aan dezelfde geadresseerde → brief2_verstuurd', () => {
    expect(bepaalBriefStatus(
      [
        brief({ id: '1', status: 'verstuurd', verzonden_op: '2026-06-01', eigenaar_naam: 'Eigenaar X', verzendadres: 'Adres 1' }),
        brief({ id: '2', status: 'verstuurd', verzonden_op: '2026-06-22', eigenaar_naam: 'Eigenaar X', verzendadres: 'Adres 1' }),
      ],
      [], 's1',
    )).toBe('brief2_verstuurd');
  });
});
