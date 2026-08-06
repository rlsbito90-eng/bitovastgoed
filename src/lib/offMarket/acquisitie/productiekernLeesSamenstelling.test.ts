import { describe, expect, it, vi } from 'vitest';

import { stelProductiekernLezenSamen } from './productiekernLeesSamenstelling';
import {
  ProductiekernNietGeactiveerdError,
  type AcquisitieProductiekernRepository,
} from './productiekernRepository';

function maakAchterliggendeRepository(): AcquisitieProductiekernRepository {
  return {
    haalDossier: vi.fn().mockResolvedValue(null),
    haalBrief: vi.fn().mockResolvedValue(null),
    haalBriefversies: vi.fn().mockResolvedValue([]),
    haalPrintbatch: vi.fn().mockResolvedValue(null),
    startVerwerking: vi.fn(),
    reserveerBrief: vi.fn(),
    maakBriefversie: vi.fn(),
    maakPrintbatch: vi.fn(),
    voegBriefversieToeAanBatch: vi.fn(),
    markeerBatchGeprint: vi.fn(),
    markeerBriefGepost: vi.fn(),
  };
}

const volledigLeesbewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
};

const willekeurigeInput = {} as never;

describe('stelProductiekernLezenSamen', () => {
  it('blijft zonder bewijs fail-closed en delegeert geen read', () => {
    const achterliggend = maakAchterliggendeRepository();
    const samenstelling = stelProductiekernLezenSamen(undefined, achterliggend);

    expect(samenstelling.activatie.lezenActief).toBe(false);
    expect(samenstelling.activatie.ontbrekendBewijs).toHaveLength(6);
    expect(() => samenstelling.repository.haalDossier('selectie-1'))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(achterliggend.haalDossier).not.toHaveBeenCalled();
  });

  it('delegeert reads alleen wanneer ieder bewijs expliciet groen is', async () => {
    const achterliggend = maakAchterliggendeRepository();
    const samenstelling = stelProductiekernLezenSamen(
      volledigLeesbewijs,
      achterliggend,
    );

    expect(samenstelling.activatie).toEqual({
      lezenActief: true,
      ontbrekendBewijs: [],
    });
    await expect(samenstelling.repository.haalDossier('selectie-1'))
      .resolves.toBeNull();
    expect(achterliggend.haalDossier).toHaveBeenCalledWith('selectie-1');
  });

  it('blokkeert schrijven ook bij volledig groen leesbewijs', () => {
    const achterliggend = maakAchterliggendeRepository();
    const samenstelling = stelProductiekernLezenSamen(
      volledigLeesbewijs,
      achterliggend,
    );

    expect(() => samenstelling.repository.reserveerBrief(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(achterliggend.reserveerBrief).not.toHaveBeenCalled();
  });

  it('weigert gedeeltelijk bewijs zonder handmatige boolean-overrides', () => {
    const achterliggend = maakAchterliggendeRepository();
    const samenstelling = stelProductiekernLezenSamen({
      ...volledigLeesbewijs,
      actueleRlsGeverifieerd: false,
    }, achterliggend);

    expect(samenstelling.activatie.lezenActief).toBe(false);
    expect(samenstelling.activatie.ontbrekendBewijs).toEqual([
      'Actuele productie-RLS is niet geverifieerd.',
    ]);
  });
});
