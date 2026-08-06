import { describe, expect, it, vi } from 'vitest';

import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import { ProductiekernLeesBudgetOverschredenError } from './productiekernSupabaseLeesBudget';
import { stelProductiekernSupabaseClientSamen } from './productiekernSupabaseClientSamenstelling';
import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

const volledigBewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
};

const briefRij = {
  id: 'brief-1', briefnummer: null, signaal_id: 'signaal-1',
  selectie_id: 'selectie-1', object_id: null, relatie_id: null,
  actieve_versie: null, status: 'concept', vervanging_van_brief_id: null,
  definitief_op: null, vergrendeld_op: null, annuleringsreden: null,
};

describe('stelProductiekernSupabaseClientSamen', () => {
  it('stopt vóór de query-uitvoerder zonder volledig bewijs', () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => null),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(null, uitvoerder);

    expect(samenstelling.activatie.lezenActief).toBe(false);
    expect(() => samenstelling.repository.haalBrief('brief-1'))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
  });

  it('voert bij volledig bewijs een allowlisted read uit en mappt de rij', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => briefRij),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(
      volledigBewijs,
      uitvoerder,
    );

    await expect(samenstelling.repository.haalBrief('brief-1')).resolves.toEqual({
      id: 'brief-1', briefnummer: null, signaalId: 'signaal-1',
      selectieId: 'selectie-1', objectId: null, relatieId: null,
      actieveVersie: null, status: 'concept', vervangingVanBriefId: null,
      definitiefOp: null, vergrendeldOp: null, annuleringsreden: null,
    });
    expect(uitvoerder.voerUit).toHaveBeenCalledTimes(1);
  });

  it('voegt identieke gelijktijdige reads standaard samen', async () => {
    let losOp: ((waarde: typeof briefRij) => void) | undefined;
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(() => new Promise((resolve) => { losOp = resolve; })),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(
      volledigBewijs,
      uitvoerder,
    );

    const eerste = samenstelling.repository.haalBrief('brief-1');
    const tweede = samenstelling.repository.haalBrief('brief-1');
    expect(uitvoerder.voerUit).toHaveBeenCalledTimes(1);
    losOp?.(briefRij);

    await expect(Promise.all([eerste, tweede])).resolves.toHaveLength(2);
  });

  it('telt iedere echte retrypoging mee binnen het leesbudget', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => { throw { status: 503 }; }),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(
      volledigBewijs,
      uitvoerder,
      {
        maximaalAantalQueries: 2,
        weerbaarheid: {
          retry: {
            maximaalAantalPogingen: 3,
            wacht: async () => undefined,
          },
        },
      },
    );

    await expect(samenstelling.repository.haalBrief('brief-1'))
      .rejects.toBeInstanceOf(ProductiekernLeesBudgetOverschredenError);
    expect(uitvoerder.voerUit).toHaveBeenCalledTimes(2);
  });

  it('houdt het schrijfpad gesloten ongeacht bewijs en uitvoerder', () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => null),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(
      volledigBewijs,
      uitvoerder,
    );

    expect(() => samenstelling.repository.maakPrintbatch({
      actorId: 'actor-1', operationKey: 'op-1', datum: '2026-08-06',
    })).toThrow(ProductiekernNietGeactiveerdError);
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
  });
});
