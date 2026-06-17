import { describe, it, expect } from 'vitest';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function brief(p: Partial<OffMarketBrief> & { id: string; eigenaar_naam: string }): OffMarketBrief {
  return {
    signaal_id: 's1',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1\n1000 AA Voorbeeldstad',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: 'concept', verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    ...p,
  } as OffMarketBrief;
}

describe('groepering — vier eigenaren', () => {
  const brieven: OffMarketBrief[] = [
    brief({ id: '1', eigenaar_naam: 'Eigenaar Alfa', verzendadres: 'Alfa 1' }),
    brief({ id: '2', eigenaar_naam: 'Eigenaar Bravo', verzendadres: 'Bravo 2' }),
    brief({ id: '3', eigenaar_naam: 'Eigenaar Charlie', verzendadres: 'Charlie 3' }),
    brief({ id: '4', eigenaar_naam: 'Eigenaar Delta', verzendadres: 'Delta 4' }),
  ];

  it('vier eigenaren → vier groepen, iedere groep start op Brief 1', () => {
    const g = groepeerBrievenPerGeadresseerde(brieven);
    expect(g).toHaveLength(4);
    for (const groep of g) {
      expect(groep.stappen.brief_1.actiefConcept).not.toBeNull();
      expect(groep.stappen.brief_2.actiefConcept).toBeNull();
      expect(groep.stappen.brief_3.actiefConcept).toBeNull();
    }
  });

  it('CAMPAGNE_STAP_LABEL bevat nooit Brief 4', async () => {
    const { CAMPAGNE_STAP_LABEL } = await import('@/lib/offMarket/brieven/groepering');
    expect(Object.values(CAMPAGNE_STAP_LABEL).some(v => v.includes('Brief 4'))).toBe(false);
  });

  it('meerdere concepten in dezelfde stap = conceptversies', () => {
    const lijst = [
      brief({ id: 'a', eigenaar_naam: 'Eigenaar X', created_at: '2026-06-01T10:00:00Z' }),
      brief({ id: 'b', eigenaar_naam: 'Eigenaar X', created_at: '2026-06-02T10:00:00Z' }),
      brief({ id: 'c', eigenaar_naam: 'Eigenaar X', created_at: '2026-06-03T10:00:00Z' }),
    ];
    const g = groepeerBrievenPerGeadresseerde(lijst);
    expect(g).toHaveLength(1);
    expect(g[0].stappen.brief_1.actiefConcept?.id).toBe('c');
    expect(g[0].stappen.brief_1.oudereConcepten.map(x => x.id)).toEqual(['a', 'b']);
  });
});
