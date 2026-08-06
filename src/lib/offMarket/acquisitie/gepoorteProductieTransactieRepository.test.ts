import { describe, expect, it, vi } from 'vitest';

import { maakGepoorteProductieTransactieRepository } from './gepoorteProductieTransactieRepository';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';
import type { AcquisitieProductieTransactieRepository } from './productieTransactieRepository';

function maakAchterliggendeRepository(): AcquisitieProductieTransactieRepository {
  return {
    maakBriefDefinitief: vi.fn().mockResolvedValue({
      briefId: 'brief-1',
      briefnummer: 'BR2026000001',
    }),
    registreerBatchdocumenten: vi.fn().mockResolvedValue(undefined),
    markeerBatchGeprint: vi.fn().mockResolvedValue(undefined),
    markeerBriefGepost: vi.fn().mockResolvedValue(undefined),
  };
}

const willekeurigeInput = {} as never;

describe('GepoorteAcquisitieProductieTransactieRepository', () => {
  it('blokkeert vóór delegatie zolang schrijven niet actief is', async () => {
    const achterliggend = maakAchterliggendeRepository();
    const repository = maakGepoorteProductieTransactieRepository({
      lezenActief: false,
      schrijvenActief: false,
      ontbrekendBewijs: ['Expliciet productieakkoord ontbreekt.'],
    }, achterliggend);

    await expect(repository.maakBriefDefinitief(willekeurigeInput))
      .rejects.toBeInstanceOf(ProductieTransactiesNietGeactiveerdError);
    expect(achterliggend.maakBriefDefinitief).not.toHaveBeenCalled();
  });

  it('laat lezenActief zonder schrijftoegang nooit door', async () => {
    const achterliggend = maakAchterliggendeRepository();
    const repository = maakGepoorteProductieTransactieRepository({
      lezenActief: true,
      schrijvenActief: false,
      ontbrekendBewijs: ['Schrijfpoort gesloten.'],
    }, achterliggend);

    await expect(repository.markeerBatchGeprint(willekeurigeInput))
      .rejects.toBeInstanceOf(ProductieTransactiesNietGeactiveerdError);
    expect(achterliggend.markeerBatchGeprint).not.toHaveBeenCalled();
  });

  it('delegeert iedere handeling alleen bij expliciete schrijftoegang', async () => {
    const achterliggend = maakAchterliggendeRepository();
    const repository = maakGepoorteProductieTransactieRepository({
      lezenActief: true,
      schrijvenActief: true,
      ontbrekendBewijs: [],
    }, achterliggend);

    await expect(repository.maakBriefDefinitief(willekeurigeInput)).resolves.toEqual({
      briefId: 'brief-1',
      briefnummer: 'BR2026000001',
    });
    await repository.registreerBatchdocumenten(willekeurigeInput);
    await repository.markeerBatchGeprint(willekeurigeInput);
    await repository.markeerBriefGepost(willekeurigeInput);

    expect(achterliggend.maakBriefDefinitief).toHaveBeenCalledOnce();
    expect(achterliggend.registreerBatchdocumenten).toHaveBeenCalledOnce();
    expect(achterliggend.markeerBatchGeprint).toHaveBeenCalledOnce();
    expect(achterliggend.markeerBriefGepost).toHaveBeenCalledOnce();
  });
});
