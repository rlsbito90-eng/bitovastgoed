import { describe, expect, it, vi } from 'vitest';

import { maakGepoorteProductiekernLeesRepository } from './gepoorteProductiekernLeesRepository';
import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';

function maakAchterliggendeRepository(): AcquisitieProductiekernRepository {
  return {
    haalDossier: vi.fn().mockResolvedValue(null),
    haalBrief: vi.fn().mockResolvedValue(null),
    haalBriefversies: vi.fn().mockResolvedValue([]),
    haalPrintbatch: vi.fn().mockResolvedValue(null),
    haalPrintbatchBrieven: vi.fn().mockResolvedValue([]),
    startVerwerking: vi.fn(),
    reserveerBrief: vi.fn(),
    maakBriefversie: vi.fn(),
    maakPrintbatch: vi.fn(),
    voegBriefversieToeAanBatch: vi.fn(),
    markeerBatchGeprint: vi.fn(),
    markeerBriefGepost: vi.fn(),
  };
}

const willekeurigeInput = {} as never;

describe('GepoorteProductiekernLeesRepository', () => {
  it('blokkeert reads vóór delegatie zolang de leespoort gesloten is', () => {
    const achterliggend = maakAchterliggendeRepository();
    const repository = maakGepoorteProductiekernLeesRepository({
      lezenActief: false,
      ontbrekendBewijs: ['Expliciet leesakkoord ontbreekt.'],
    }, achterliggend);

    expect(() => repository.haalDossier('selectie-1'))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.haalPrintbatchBrieven('batch-1'))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(achterliggend.haalDossier).not.toHaveBeenCalled();
    expect(achterliggend.haalPrintbatchBrieven).not.toHaveBeenCalled();
  });

  it('delegeert uitsluitend reads wanneer de leespoort expliciet open is', async () => {
    const achterliggend = maakAchterliggendeRepository();
    const repository = maakGepoorteProductiekernLeesRepository({
      lezenActief: true,
      ontbrekendBewijs: [],
    }, achterliggend);

    await expect(repository.haalDossier('selectie-1')).resolves.toBeNull();
    await expect(repository.haalBrief('brief-1')).resolves.toBeNull();
    await expect(repository.haalBriefversies('brief-1')).resolves.toEqual([]);
    await expect(repository.haalPrintbatch('batch-1')).resolves.toBeNull();
    await expect(repository.haalPrintbatchBrieven('batch-1')).resolves.toEqual([]);

    expect(achterliggend.haalDossier).toHaveBeenCalledWith('selectie-1');
    expect(achterliggend.haalBrief).toHaveBeenCalledWith('brief-1');
    expect(achterliggend.haalBriefversies).toHaveBeenCalledWith('brief-1');
    expect(achterliggend.haalPrintbatch).toHaveBeenCalledWith('batch-1');
    expect(achterliggend.haalPrintbatchBrieven).toHaveBeenCalledWith('batch-1');
  });

  it('blokkeert iedere write ook wanneer lezen actief is', () => {
    const achterliggend = maakAchterliggendeRepository();
    const repository = maakGepoorteProductiekernLeesRepository({
      lezenActief: true,
      ontbrekendBewijs: [],
    }, achterliggend);

    expect(() => repository.startVerwerking(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.reserveerBrief(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.maakBriefversie(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.maakPrintbatch(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.voegBriefversieToeAanBatch(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.markeerBatchGeprint(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => repository.markeerBriefGepost(willekeurigeInput))
      .toThrow(ProductiekernNietGeactiveerdError);

    expect(achterliggend.startVerwerking).not.toHaveBeenCalled();
    expect(achterliggend.reserveerBrief).not.toHaveBeenCalled();
    expect(achterliggend.maakBriefversie).not.toHaveBeenCalled();
    expect(achterliggend.maakPrintbatch).not.toHaveBeenCalled();
    expect(achterliggend.voegBriefversieToeAanBatch).not.toHaveBeenCalled();
    expect(achterliggend.markeerBatchGeprint).not.toHaveBeenCalled();
    expect(achterliggend.markeerBriefGepost).not.toHaveBeenCalled();
  });
});
