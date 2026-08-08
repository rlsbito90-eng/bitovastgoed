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

const dossierRij = {
  selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
  verwerking_gestart_op: '2026-08-08T12:00:00Z', verwerking_gestart_door: 'actor-1',
  primaire_werkbak: 'eigenaar_achterhalen', volgende_actie_op: null,
  volgende_actie_omschrijving: null,
};

describe('stelProductiekernSupabaseClientSamen', () => {
  it('stopt single- én bulkreads vóór de uitvoerder zonder volledig bewijs', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => null),
      voerBulkUit: vi.fn(async () => []),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(null, uitvoerder);

    expect(samenstelling.activatie.lezenActief).toBe(false);
    expect(() => samenstelling.repository.haalBrief('brief-1'))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => samenstelling.bulkRepository.haalDossiersOpSelectieIds(['selectie-1']))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(() => samenstelling.bulkRepository.haalBrievenOpIds(['brief-1']))
      .toThrow(ProductiekernNietGeactiveerdError);
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
    expect(uitvoerder.voerBulkUit).not.toHaveBeenCalled();
  });

  it('voert bij volledig bewijs allowlisted single- en bulkreads uit', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => briefRij),
      voerBulkUit: vi.fn(async (input) => input.tabel === 'off_market_acquisitie_dossiers' ? [dossierRij] : [briefRij]),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(volledigBewijs, uitvoerder);

    await expect(samenstelling.repository.haalBrief('brief-1')).resolves.toMatchObject({ id: 'brief-1' });
    await expect(samenstelling.bulkRepository.haalDossiersOpSelectieIds(['selectie-1']))
      .resolves.toEqual([expect.objectContaining({ selectieId: 'selectie-1' })]);
    await expect(samenstelling.bulkRepository.haalBrievenOpIds(['brief-1']))
      .resolves.toEqual([expect.objectContaining({ id: 'brief-1' })]);
    expect(uitvoerder.voerUit).toHaveBeenCalledTimes(1);
    expect(uitvoerder.voerBulkUit).toHaveBeenCalledTimes(2);
  });

  it('voegt identieke gelijktijdige single reads standaard samen', async () => {
    let losOp: ((waarde: typeof briefRij) => void) | undefined;
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(() => new Promise((resolve) => { losOp = resolve; })),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(volledigBewijs, uitvoerder);
    const eerste = samenstelling.repository.haalBrief('brief-1');
    const tweede = samenstelling.repository.haalBrief('brief-1');
    expect(uitvoerder.voerUit).toHaveBeenCalledTimes(1);
    losOp?.(briefRij);
    await expect(Promise.all([eerste, tweede])).resolves.toHaveLength(2);
  });

  it('voegt identieke gelijktijdige bulkreads standaard samen', async () => {
    let losOp: ((waarde: Record<string, unknown>[]) => void) | undefined;
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => null),
      voerBulkUit: vi.fn(() => new Promise((resolve) => { losOp = resolve; })),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(volledigBewijs, uitvoerder);
    const eerste = samenstelling.bulkRepository.haalBrievenOpIds(['brief-1']);
    const tweede = samenstelling.bulkRepository.haalBrievenOpIds(['brief-1']);
    expect(uitvoerder.voerBulkUit).toHaveBeenCalledTimes(1);
    losOp?.([briefRij]);
    await expect(Promise.all([eerste, tweede])).resolves.toHaveLength(2);
  });

  it('laat single- en bulkpogingen hetzelfde querybudget delen', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => briefRij),
      voerBulkUit: vi.fn(async () => [briefRij]),
    };
    const samenstelling = stelProductiekernSupabaseClientSamen(
      volledigBewijs,
      uitvoerder,
      { maximaalAantalQueries: 1, weerbaarheid: { retry: { maximaalAantalPogingen: 1 } } },
    );

    await expect(samenstelling.repository.haalBrief('brief-1')).resolves.toMatchObject({ id: 'brief-1' });
    await expect(samenstelling.bulkRepository.haalBrievenOpIds(['brief-1']))
      .rejects.toBeInstanceOf(ProductiekernLeesBudgetOverschredenError);
    expect(uitvoerder.voerBulkUit).not.toHaveBeenCalled();
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
        weerbaarheid: { retry: { maximaalAantalPogingen: 3, wacht: async () => undefined } },
      },
    );
    await expect(samenstelling.repository.haalBrief('brief-1'))
      .rejects.toBeInstanceOf(ProductiekernLeesBudgetOverschredenError);
    expect(uitvoerder.voerUit).toHaveBeenCalledTimes(2);
  });

  it('houdt het schrijfpad gesloten ongeacht bewijs en uitvoerder', () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = { voerUit: vi.fn(async () => null) };
    const samenstelling = stelProductiekernSupabaseClientSamen(volledigBewijs, uitvoerder);
    expect(() => samenstelling.repository.maakPrintbatch({
      actorId: 'actor-1', operationKey: 'op-1', datum: '2026-08-06',
    })).toThrow(ProductiekernNietGeactiveerdError);
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
  });
});
