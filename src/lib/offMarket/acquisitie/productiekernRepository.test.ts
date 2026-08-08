import { describe, expect, it } from 'vitest';
import {
  ProductiekernNietGeactiveerdError,
  UitgeschakeldeAcquisitieProductiekernRepository,
} from './productiekernRepository';

const basisInput = {
  actorId: 'user-1',
  operationKey: 'operation-1',
};

async function verwachtGeblokkeerd(promise: Promise<unknown>, handeling: string) {
  await expect(promise).rejects.toMatchObject({
    name: 'ProductiekernNietGeactiveerdError',
    code: 'ACQUISITIE_PRODUCTIEKERN_NIET_GEACTIVEERD',
    message: expect.stringContaining(handeling),
  });
}

describe('UitgeschakeldeAcquisitieProductiekernRepository', () => {
  it('gebruikt een herkenbare, fail-closed fout', () => {
    const fout = new ProductiekernNietGeactiveerdError('reserveerBrief');
    expect(fout).toBeInstanceOf(Error);
    expect(fout.code).toBe('ACQUISITIE_PRODUCTIEKERN_NIET_GEACTIVEERD');
    expect(fout.message).toContain('reserveerBrief');
  });

  it('blokkeert alle leesacties zolang BUILD A niet is geactiveerd', async () => {
    const repository = new UitgeschakeldeAcquisitieProductiekernRepository();

    await verwachtGeblokkeerd(repository.haalDossier('selectie-1'), 'haalDossier');
    await verwachtGeblokkeerd(repository.haalBrief('brief-1'), 'haalBrief');
    await verwachtGeblokkeerd(repository.haalBriefversies('brief-1'), 'haalBriefversies');
    await verwachtGeblokkeerd(repository.haalPrintbatch('batch-1'), 'haalPrintbatch');
  });

  it('blokkeert alle mutaties zonder Supabase of andere side effects aan te roepen', async () => {
    const repository = new UitgeschakeldeAcquisitieProductiekernRepository();

    await verwachtGeblokkeerd(repository.startVerwerking({
      selectieId: 'selectie-1',
      ...basisInput,
    }), 'startVerwerking');

    await verwachtGeblokkeerd(repository.reserveerBrief({
      selectieId: 'selectie-1',
      signaalId: 'signaal-1',
      jaar: 2026,
      ...basisInput,
    }), 'reserveerBrief');

    await verwachtGeblokkeerd(repository.maakBriefversie({
      briefId: 'brief-1',
      inhoudSnapshot: {},
      geadresseerdeSnapshot: {},
      ...basisInput,
    }), 'maakBriefversie');

    await verwachtGeblokkeerd(repository.maakPrintbatch({
      datum: '2026-08-06',
      ...basisInput,
    }), 'maakPrintbatch');

    await verwachtGeblokkeerd(repository.voegBriefversieToeAanBatch({
      batchId: 'batch-1',
      briefId: 'brief-1',
      briefVersieId: 'versie-1',
      ...basisInput,
    }), 'voegBriefversieToeAanBatch');

    await verwachtGeblokkeerd(repository.markeerBatchGeprint({
      batchId: 'batch-1',
      printdatum: '2026-08-06T10:00:00.000Z',
      ...basisInput,
    }), 'markeerBatchGeprint');

    await verwachtGeblokkeerd(repository.markeerBriefGepost({
      briefId: 'brief-1',
      briefVersieId: 'versie-1',
      batchId: 'batch-1',
      verzenddatum: '2026-08-06T12:00:00.000Z',
      ...basisInput,
    }), 'markeerBriefGepost');
  });
});
