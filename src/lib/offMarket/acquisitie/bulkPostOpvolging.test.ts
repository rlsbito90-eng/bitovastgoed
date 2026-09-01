import { describe, expect, it } from 'vitest';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwBulkPostOpvolgPlan } from './bulkPostOpvolging';

function signaal(id: string): OffMarketSignaal {
  return { id, adres: `Teststraat ${id}`, plaats: 'Amsterdam' } as OffMarketSignaal;
}

function brief(args: {
  id: string;
  signaalId: string;
  key: string;
  stap?: 'brief_1' | 'brief_2' | 'brief_3' | null;
  status?: 'concept' | 'definitief' | 'verstuurd';
  responsstatus?: string | null;
}): OffMarketBrief {
  return {
    id: args.id,
    signaal_id: args.signaalId,
    eigenaar_naam: `Ontvanger ${args.key}`,
    eigenaar_bedrijfsnaam: null,
    verzendadres: `Dorpsstraat 1\n1234 AB Amsterdam`,
    objectadres: `Teststraat ${args.signaalId}`,
    objectomschrijving: `Teststraat ${args.signaalId}`,
    aanhef: 'Geachte heer/mevrouw,',
    onderwerp: 'Interesse in uw pand',
    brieftekst: 'Test',
    status: args.status ?? 'verstuurd',
    verzonden_op: args.status === 'concept' ? null : '2026-08-01T12:00:00.000Z',
    aangemaakt_door: null,
    created_at: `2026-08-01T12:00:0${args.id.length}.000Z`,
    updated_at: '2026-08-01T12:00:00.000Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: args.stap === undefined ? 'brief_1' : args.stap,
    geadresseerde_key: args.key,
    responsstatus: args.responsstatus ?? null,
  };
}

describe('bulk postopvolging', () => {
  it('behoudt alle geselecteerde geadresseerden en groepeert niet opnieuw op partij', () => {
    const signalen = Array.from({ length: 10 }, (_, index) => signaal(String(index + 1)));
    const brieven = signalen.flatMap((s, index) => {
      const basis = [brief({ id: `b-${s.id}-a`, signaalId: s.id, key: `partij-${s.id}-a` })];
      if (index < 3) basis.push(brief({ id: `b-${s.id}-b`, signaalId: s.id, key: `partij-${s.id}-b` }));
      return basis;
    });

    const resultaat = bouwBulkPostOpvolgPlan({ signalen, brieven });

    expect(resultaat.telling).toEqual({ signalen: 10, geadresseerden: 13, brieven: 13, uitzonderingen: 0 });
    expect(resultaat.plan).toHaveLength(13);
    expect(resultaat.plan.every((item) => item.campagneStap === 'brief_2')).toBe(true);
  });

  it('bepaalt Brief 2 en Brief 3 per geadresseerde uit de eigen verzendhistorie', () => {
    const brieven = [
      brief({ id: '1', signaalId: 's', key: 'a', stap: 'brief_1' }),
      brief({ id: '2', signaalId: 's', key: 'b', stap: 'brief_1' }),
      brief({ id: '3', signaalId: 's', key: 'b', stap: 'brief_2' }),
    ];
    const resultaat = bouwBulkPostOpvolgPlan({ signalen: [signaal('s')], brieven });

    expect(resultaat.plan.map((item) => [item.geadresseerdeKey, item.campagneStap])).toEqual([
      ['a', 'brief_2'],
      ['b', 'brief_3'],
    ]);
  });

  it('toont respons, ontbrekende verzending en een complete reeks als expliciete uitzondering', () => {
    const brieven = [
      brief({ id: '1', signaalId: 's', key: 'respons', responsstatus: 'interesse' }),
      brief({ id: '2', signaalId: 's', key: 'concept', status: 'concept' }),
      brief({ id: '3', signaalId: 's', key: 'compleet', stap: 'brief_1' }),
      brief({ id: '4', signaalId: 's', key: 'compleet', stap: 'brief_2' }),
      brief({ id: '5', signaalId: 's', key: 'compleet', stap: 'brief_3' }),
    ];
    const resultaat = bouwBulkPostOpvolgPlan({ signalen: [signaal('s')], brieven });

    expect(resultaat.telling.uitzonderingen).toBe(3);
    expect(resultaat.plan).toHaveLength(0);
    expect(resultaat.rijen.map((rij) => rij.uitzondering).sort()).toEqual([
      'geen_verzonden_brief', 'reeks_compleet', 'respons_geregistreerd',
    ]);
  });

  it('vult legacy verzonden brieven zonder stap chronologisch aan', () => {
    const brieven = [
      brief({ id: '1', signaalId: 's', key: 'legacy', stap: null }),
      brief({ id: '2', signaalId: 's', key: 'legacy', stap: null }),
    ];
    const resultaat = bouwBulkPostOpvolgPlan({ signalen: [signaal('s')], brieven });
    expect(resultaat.plan[0]?.campagneStap).toBe('brief_3');
  });
});
