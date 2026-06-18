// Brieven V2 — campagnestappen mogen nooit Brief 4/5/6 introduceren.
import { describe, it, expect } from 'vitest';
import {
  STAP_VOLGORDE, CAMPAGNE_STAP_LABEL,
  groepeerBrievenPerGeadresseerde, samenvatting,
} from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function b(p: Partial<OffMarketBrief> & { id: string; eigenaar_naam: string }): OffMarketBrief {
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

describe('Brieven V2 — groepering', () => {
  it('STAP_VOLGORDE bevat alleen brief_1/2/3 — geen 4/5/6', () => {
    expect(STAP_VOLGORDE).toEqual(['brief_1', 'brief_2', 'brief_3']);
    const labels = Object.values(CAMPAGNE_STAP_LABEL);
    expect(labels.join(' ')).not.toMatch(/Brief\s*(4|5|6)/i);
  });

  it('vier geadresseerden krijgen elk Brief 1', () => {
    const brieven = [
      b({ id: '1', eigenaar_naam: 'Eigenaar Alfa', verzendadres: 'Alfa 1' }),
      b({ id: '2', eigenaar_naam: 'Eigenaar Bravo', verzendadres: 'Bravo 2' }),
      b({ id: '3', eigenaar_naam: 'Eigenaar Charlie', verzendadres: 'Charlie 3' }),
      b({ id: '4', eigenaar_naam: 'Eigenaar Delta', verzendadres: 'Delta 4' }),
    ];
    const groepen = groepeerBrievenPerGeadresseerde(brieven);
    expect(groepen).toHaveLength(4);
    for (const g of groepen) {
      expect(g.stappen.brief_1.actiefConcept).not.toBeNull();
      expect(g.stappen).toHaveProperty('brief_2');
      expect(g.stappen).toHaveProperty('brief_3');
      expect((g.stappen as any).brief_4).toBeUndefined();
    }
  });

  it('samenvatting telt reacties en open opvolgingen op briefniveau', () => {
    const brieven: any[] = [
      b({ id: '1', eigenaar_naam: 'Eigenaar Alfa', status: 'verstuurd',
          verzonden_op: '2026-06-01T12:00:00Z',
          postdatum: '2026-06-01', opvolgdatum: '2026-06-22' }),
      b({ id: '2', eigenaar_naam: 'Eigenaar Bravo', status: 'verstuurd',
          verzonden_op: '2026-06-01T12:00:00Z',
          postdatum: '2026-06-01', opvolgdatum: '2026-06-22',
          responsstatus: 'interesse', responsdatum: '2026-06-10' }),
    ];
    const sv = samenvatting(groepeerBrievenPerGeadresseerde(brieven), [], 's1');
    expect(sv.aantalGeadresseerden).toBe(2);
    expect(sv.brief1Verstuurd).toBe(2);
    expect(sv.reacties).toBe(1);
    expect(sv.openOpvolgingen).toBe(1);
  });
});
