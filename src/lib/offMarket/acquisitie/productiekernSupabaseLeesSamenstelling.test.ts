import { describe, expect, it, vi } from 'vitest';

import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import { stelSupabaseProductiekernLezenSamen } from './productiekernSupabaseLeesSamenstelling';
import type { ProductiekernSupabaseLeesTransport } from './productiekernSupabaseLeesRepository';

function transport(): ProductiekernSupabaseLeesTransport {
  return {
    haalEen: vi.fn(async () => ({
      selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
      verwerking_gestart_op: null, verwerking_gestart_door: null,
      primaire_werkbak: 'nieuwe_selectie', volgende_actie_op: null,
      volgende_actie_omschrijving: null,
    })),
    haalMeerdere: vi.fn(async () => []),
  };
}

const volledigBewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
};

describe('stelSupabaseProductiekernLezenSamen', () => {
  it('roept Supabase niet aan wanneer één bewijsvoorwaarde ontbreekt', () => {
    const t = transport();
    const samenstelling = stelSupabaseProductiekernLezenSamen(
      { ...volledigBewijs, explicietLeesakkoord: false },
      t,
    );

    expect(samenstelling.activatie.lezenActief).toBe(false);
    expect(() => samenstelling.repository.haalDossier('selectie-1'))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(t.haalEen).not.toHaveBeenCalled();
  });

  it('delegeert reads pas bij volledig bewijs', async () => {
    const t = transport();
    const samenstelling = stelSupabaseProductiekernLezenSamen(volledigBewijs, t);

    expect(samenstelling.activatie.lezenActief).toBe(true);
    await expect(samenstelling.repository.haalDossier('selectie-1'))
      .resolves.toMatchObject({ selectieId: 'selectie-1' });
    expect(t.haalEen).toHaveBeenCalledTimes(1);
  });

  it('houdt writes ook met volledig leesbewijs geblokkeerd', () => {
    const t = transport();
    const samenstelling = stelSupabaseProductiekernLezenSamen(volledigBewijs, t);

    expect(() => samenstelling.repository.startVerwerking({
      selectieId: 'selectie-1', actorId: 'actor-1', operationKey: 'op-1',
    })).toThrow(ProductiekernNietGeactiveerdError);
    expect(t.haalEen).not.toHaveBeenCalled();
  });
});
