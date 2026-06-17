import { describe, it, expect } from 'vitest';
import { veiligeOpschoonkandidaten } from '@/lib/offMarket/brieven/opschoon';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function b(p: Partial<OffMarketBrief> & { id: string; created_at: string }): OffMarketBrief {
  return {
    signaal_id: 's1',
    eigenaar_naam: 'Eigenaar Test', eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: 'concept', verzonden_op: null, aangemaakt_door: null,
    updated_at: p.created_at,
    archived_at: null, archived_reason: null,
    ...p,
  } as OffMarketBrief;
}

describe('veiligeOpschoonkandidaten', () => {
  it('verstuurde brieven zijn nooit opschoonkandidaat', () => {
    const k = veiligeOpschoonkandidaten([
      b({ id: '1', created_at: '2026-06-01T10:00:00Z', status: 'verstuurd', verzonden_op: '2026-06-01T10:00:00Z' }),
      b({ id: '2', created_at: '2026-06-02T10:00:00Z', status: 'verstuurd', verzonden_op: '2026-06-02T10:00:00Z' }),
    ], []);
    expect(k).toHaveLength(0);
  });

  it('meest recente concept per stap blijft actief', () => {
    const k = veiligeOpschoonkandidaten([
      b({ id: 'oud1', created_at: '2026-06-01T10:00:00Z' }),
      b({ id: 'oud2', created_at: '2026-06-02T10:00:00Z' }),
      b({ id: 'actief', created_at: '2026-06-03T10:00:00Z' }),
    ], []);
    const ids = k.map(x => x.brief.id);
    expect(ids).toContain('oud1');
    expect(ids).toContain('oud2');
    expect(ids).not.toContain('actief');
  });

  it('al gearchiveerde concepten zijn geen kandidaat', () => {
    const k = veiligeOpschoonkandidaten([
      b({ id: 'a', created_at: '2026-06-01T10:00:00Z', archived_at: '2026-06-04T10:00:00Z' }),
      b({ id: 'b', created_at: '2026-06-02T10:00:00Z' }),
    ], []);
    expect(k).toHaveLength(0);
  });
});
