import { describe, it, expect } from 'vitest';
import { bepaalVolgendeActie } from '@/lib/offMarket/volgendeActie';
import type { Taak } from '@/data/mock-data';

const sig = { volgende_actie_datum: null, volgende_actie_omschrijving: null } as any;

function taak(p: Partial<Taak>): Taak {
  return {
    id: p.id ?? 't',
    titel: p.titel ?? 'Taak',
    type: p.type ?? 'follow_up',
    deadline: p.deadline ?? '2026-07-01',
    prioriteit: p.prioriteit ?? ('normaal' as any),
    status: p.status ?? ('open' as any),
    offMarketSignaalId: p.offMarketSignaalId,
    softDeletedAt: p.softDeletedAt,
  } as Taak;
}

describe('bepaalVolgendeActie', () => {
  it('vindt eerstvolgende open taak met oudste deadline', () => {
    const taken = [
      taak({ id: 'a', deadline: '2026-08-10', offMarketSignaalId: 's1' }),
      taak({ id: 'b', deadline: '2026-07-05', offMarketSignaalId: 's1' }),
      taak({ id: 'c', deadline: '2026-06-01', offMarketSignaalId: 's2' }),
    ];
    const res = bepaalVolgendeActie(sig, taken, 's1');
    expect(res?.taakId).toBe('b');
    expect(res?.deadline).toBe('2026-07-05');
    expect(res?.bron).toBe('taak');
  });

  it('negeert afgeronde, geannuleerde en soft-deleted taken', () => {
    const taken = [
      taak({ id: 'a', deadline: '2026-06-01', status: 'afgerond' as any, offMarketSignaalId: 's1' }),
      taak({ id: 'b', deadline: '2026-06-02', status: 'geannuleerd' as any, offMarketSignaalId: 's1' }),
      taak({ id: 'c', deadline: '2026-06-03', offMarketSignaalId: 's1', softDeletedAt: '2026-06-01' }),
      taak({ id: 'd', deadline: '2026-09-01', offMarketSignaalId: 's1' }),
    ];
    const res = bepaalVolgendeActie(sig, taken, 's1');
    expect(res?.taakId).toBe('d');
  });

  it('fallback naar signaal als geen open taak bestaat', () => {
    const res = bepaalVolgendeActie(
      { volgende_actie_datum: '2026-07-01', volgende_actie_omschrijving: 'Bellen' } as any,
      [],
      's1',
    );
    expect(res?.bron).toBe('signaal');
    expect(res?.titel).toBe('Bellen');
  });

  it('null wanneer geen taken en geen signaal-actie', () => {
    expect(bepaalVolgendeActie(sig, [], 's1')).toBeNull();
  });
});
