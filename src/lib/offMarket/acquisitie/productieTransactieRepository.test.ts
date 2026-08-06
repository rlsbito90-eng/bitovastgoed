import { describe, expect, it } from 'vitest';

import {
  ProductieTransactiesNietGeactiveerdError,
  UitgeschakeldeAcquisitieProductieTransactieRepository,
} from './productieTransactieRepository';

const repository = new UitgeschakeldeAcquisitieProductieTransactieRepository();

async function verwachtGeblokkeerd(promise: Promise<unknown>, handeling: string) {
  await expect(promise).rejects.toMatchObject({
    name: 'ProductieTransactiesNietGeactiveerdError',
    code: 'ACQUISITIE_PRODUCTIETRANSACTIES_NIET_GEACTIVEERD',
    message: `Transactionele productiehandeling "${handeling}" is niet geactiveerd.`,
  });
}

describe('UitgeschakeldeAcquisitieProductieTransactieRepository', () => {
  it('blokkeert het definitief maken van een brief', async () => {
    await verwachtGeblokkeerd(repository.maakBriefDefinitief({} as never), 'maakBriefDefinitief');
  });

  it('blokkeert batchdocumentregistratie', async () => {
    await verwachtGeblokkeerd(
      repository.registreerBatchdocumenten({} as never),
      'registreerBatchdocumenten',
    );
  });

  it('blokkeert printregistratie', async () => {
    await verwachtGeblokkeerd(repository.markeerBatchGeprint({} as never), 'markeerBatchGeprint');
  });

  it('blokkeert postregistratie', async () => {
    await verwachtGeblokkeerd(repository.markeerBriefGepost({} as never), 'markeerBriefGepost');
  });

  it('gebruikt een herkenbaar domeinfouttype', () => {
    const fout = new ProductieTransactiesNietGeactiveerdError('test');
    expect(fout).toBeInstanceOf(Error);
    expect(fout.code).toBe('ACQUISITIE_PRODUCTIETRANSACTIES_NIET_GEACTIVEERD');
  });
});
