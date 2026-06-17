import { describe, it, expect } from 'vitest';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
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

describe('campagnestap-afleiding per geadresseerde', () => {
  it('concept vóór verstuurd telt als conceptversie van Brief 1', () => {
    const g = groepeerBrievenPerGeadresseerde([
      b({ id: '1', created_at: '2026-06-01T10:00:00Z', status: 'concept' }),
      b({ id: '2', created_at: '2026-06-02T10:00:00Z', status: 'verstuurd', verzonden_op: '2026-06-02T10:00:00Z' }),
    ]);
    expect(g[0].stappen.brief_1.verstuurd?.id).toBe('2');
    // Conceptversie 1 hoort bij Brief 1, niet bij Brief 2.
    const conceptIds = [
      g[0].stappen.brief_1.actiefConcept?.id,
      ...g[0].stappen.brief_1.oudereConcepten.map(x => x.id),
    ].filter(Boolean);
    expect(conceptIds).toContain('1');
    expect(g[0].stappen.brief_2.actiefConcept).toBeNull();
  });

  it('verstuurde Brief 1 + later concept = Brief 2 concept', () => {
    const g = groepeerBrievenPerGeadresseerde([
      b({ id: '1', created_at: '2026-06-01T10:00:00Z', status: 'verstuurd', verzonden_op: '2026-06-01T10:00:00Z' }),
      b({ id: '2', created_at: '2026-06-10T10:00:00Z', status: 'concept' }),
    ]);
    expect(g[0].stappen.brief_1.verstuurd?.id).toBe('1');
    expect(g[0].stappen.brief_2.actiefConcept?.id).toBe('2');
  });

  it('Brief 3 pas na Brief 2 verstuurd', () => {
    const g = groepeerBrievenPerGeadresseerde([
      b({ id: '1', created_at: '2026-06-01T10:00:00Z', status: 'verstuurd', verzonden_op: '2026-06-01T10:00:00Z' }),
      b({ id: '2', created_at: '2026-06-10T10:00:00Z', status: 'verstuurd', verzonden_op: '2026-06-10T10:00:00Z' }),
      b({ id: '3', created_at: '2026-06-20T10:00:00Z', status: 'concept' }),
    ]);
    expect(g[0].stappen.brief_2.verstuurd?.id).toBe('2');
    expect(g[0].stappen.brief_3.actiefConcept?.id).toBe('3');
  });
});
