import { describe, it, expect, vi } from 'vitest';
import {
  bouwReactivatiePayload,
  mergeKandidaatInState,
  voerKandidaatToevoegingUit,
} from '@/lib/pipeline/kandidaatToevoegen';
import { beschrijfKandidaatFout } from '@/lib/pipeline/kandidaatFouten';
import { kiesBesteZoekprofielMatch } from '@/lib/pipeline/zoekprofielKeuze';

const rij = (id: string) => ({ id, objectId: 'obj-1', relatieId: 'rel-1' });

describe('voerKandidaatToevoegingUit', () => {
  it('voegt normaal in wanneer er geen bestaande rij is', async () => {
    const insert = vi.fn().mockResolvedValue(rij('new'));
    const reactiveer = vi.fn();
    const res = await voerKandidaatToevoegingUit({
      vindBestaande: async () => null, reactiveer, insert,
    });
    expect(res).toEqual({ rij: rij('new'), gereactiveerd: false });
    expect(reactiveer).not.toHaveBeenCalled();
  });

  it('reactiveert een soft-deleted rij in plaats van opnieuw in te voegen', async () => {
    const insert = vi.fn();
    const reactiveer = vi.fn().mockResolvedValue(rij('oud'));
    const res = await voerKandidaatToevoegingUit({
      vindBestaande: async () => ({ id: 'oud', soft_deleted_at: '2026-01-01T00:00:00Z' }),
      reactiveer, insert,
    });
    expect(reactiveer).toHaveBeenCalledWith('oud');
    expect(insert).not.toHaveBeenCalled();
    expect(res).toEqual({ rij: rij('oud'), gereactiveerd: true });
  });

  it('geeft een herkenbare duplicate-fout bij een actieve rij', async () => {
    const insert = vi.fn();
    await expect(voerKandidaatToevoegingUit({
      vindBestaande: async () => ({ id: 'actief', soft_deleted_at: null }),
      reactiveer: vi.fn(), insert,
    })).rejects.toMatchObject({ code: '23505' });
    expect(insert).not.toHaveBeenCalled();

    const err = await voerKandidaatToevoegingUit({
      vindBestaande: async () => ({ id: 'actief', soft_deleted_at: null }),
      reactiveer: vi.fn(), insert: vi.fn(),
    }).catch(e => e);
    expect(beschrijfKandidaatFout(err).duplicaat).toBe(true);
  });

  it('laat een gelijktijdig unique-conflict uit de insert doorstromen', async () => {
    const conflict = Object.assign(new Error('duplicate'), { code: '23505' });
    await expect(voerKandidaatToevoegingUit({
      vindBestaande: async () => null,
      reactiveer: vi.fn(),
      insert: async () => { throw conflict; },
    })).rejects.toBe(conflict);
  });
});

describe('bouwReactivatiePayload', () => {
  it('zet soft_deleted_at terug op null en behoudt nieuwe input', () => {
    const p = bouwReactivatiePayload({ pipeline_fase: 'match_gevonden', matchscore: 72 });
    expect(p).toEqual({ pipeline_fase: 'match_gevonden', matchscore: 72, soft_deleted_at: null });
  });

  it('wist geen historie: null/undefined-velden worden weggelaten', () => {
    const p = bouwReactivatiePayload({ notities: null, bezichtiging_datum: undefined, matchscore: null });
    expect(p).toEqual({ soft_deleted_at: null });
  });
});

describe('mergeKandidaatInState', () => {
  it('houdt precies één actuele kandidaat per object/relatie', () => {
    const prev = [{ id: 'oud', objectId: 'obj-1', relatieId: 'rel-1' }, { id: 'x', objectId: 'obj-2', relatieId: 'rel-1' }];
    const next = mergeKandidaatInState(prev, { id: 'oud', objectId: 'obj-1', relatieId: 'rel-1' });
    expect(next).toHaveLength(2);
    expect(next.filter(x => x.objectId === 'obj-1' && x.relatieId === 'rel-1')).toHaveLength(1);
    expect(next[0].id).toBe('oud');
  });
});

describe('kiesBesteZoekprofielMatch', () => {
  const profielen = [
    { id: 'belegging', status: 'actief' },
    { id: 'ontwikkeling', status: 'actief' },
    { id: 'oud', status: 'inactief' },
  ];

  it('kiest het actieve profiel met de hoogste geldige score', () => {
    const keuze = kiesBesteZoekprofielMatch(profielen, p => (p.id === 'ontwikkeling' ? 81 : 42));
    expect(keuze).toEqual({ zoekprofielId: 'ontwikkeling', score: 81 });
  });

  it('negeert inactieve profielen', () => {
    const keuze = kiesBesteZoekprofielMatch(profielen, p => (p.id === 'oud' ? 99 : 10));
    expect(keuze?.zoekprofielId).not.toBe('oud');
  });

  it('geeft null als geen actief profiel een geldige match oplevert', () => {
    expect(kiesBesteZoekprofielMatch(profielen, () => undefined)).toBeNull();
    expect(kiesBesteZoekprofielMatch(profielen, () => { throw new Error('nope'); })).toBeNull();
    expect(kiesBesteZoekprofielMatch([], () => 5)).toBeNull();
  });
});
