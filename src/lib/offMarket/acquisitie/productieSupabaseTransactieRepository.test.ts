import { describe, expect, it, vi } from 'vitest';

import { productiekernStandaardUitgeschakeld } from './productieActivatiePoort';
import {
  maakGepoorteSupabaseProductieTransactieRepository,
  ProductieSupabaseRpcError,
  SupabaseAcquisitieProductieTransactieRepository,
  type ProductieSupabaseRpcUitvoerder,
} from './productieSupabaseTransactieRepository';

const brief = {
  id: 'brief-1',
  briefnummer: null,
  signaalId: 'signaal-1',
  selectieId: 'selectie-1',
  objectId: null,
  relatieId: null,
  actieveVersie: 1,
  status: 'concept' as const,
  vervangingVanBriefId: null,
  definitiefOp: null,
  vergrendeldOp: null,
  annuleringsreden: null,
};

const actieveVersie = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'actief' as const,
  inhoud: {
    onderwerp: 'Onderwerp',
    brieftekst: 'Brieftekst',
    objectadres: null,
    objectomschrijving: null,
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'Eigenaar',
    bedrijfsnaam: null,
    aanhef: 'Geachte heer/mevrouw',
    straatHuisnummer: 'Straat 1',
    postcode: '1234 AB',
    plaats: 'Plaats',
    land: 'Nederland',
    bron: 'test',
    verificatiestatus: 'handmatig_gecontroleerd' as const,
    relatieId: null,
  },
  bestandReferentie: null,
  createdAt: '2026-08-08T08:00:00.000Z',
  vervallenOp: null,
  verzondenOp: null,
};

const input = {
  actie: 'brief_definitief_maken' as const,
  actorId: 'actor-1',
  operationKey: 'acq-productie:v1:brief_definitief_maken:brief:brief-1:request-1',
  verwachtVersienummer: 1,
  uitgevoerdOp: '2026-08-08T08:30:00.000Z',
  brief,
  actieveVersie,
  jaar: 2026,
};

describe('SupabaseAcquisitieProductieTransactieRepository', () => {
  it('voert exact één allowlisted RPC uit en parseert het briefresultaat', async () => {
    const voerRpcUit = vi.fn<ProductieSupabaseRpcUitvoerder['voerRpcUit']>()
      .mockResolvedValue({
        data: [{ brief_id: 'brief-1', briefnummer: 'BR2026000001' }],
        error: null,
      });
    const repository = new SupabaseAcquisitieProductieTransactieRepository({ voerRpcUit });

    await expect(repository.maakBriefDefinitief(input)).resolves.toEqual({
      briefId: 'brief-1',
      briefnummer: 'BR2026000001',
    });

    expect(voerRpcUit).toHaveBeenCalledTimes(1);
    expect(voerRpcUit).toHaveBeenCalledWith('off_market_brief_definitief_maken', {
      p_brief_id: 'brief-1',
      p_brief_versie_id: 'versie-1',
      p_actor_id: 'actor-1',
      p_operation_key: input.operationKey,
      p_verwacht_versienummer: 1,
      p_uitgevoerd_op: '2026-08-08T08:30:00.000Z',
      p_jaar: 2026,
    });
  });

  it('normaliseert databasefouten naar het bestaande veilige RPC-foutcontract', async () => {
    const repository = new SupabaseAcquisitieProductieTransactieRepository({
      voerRpcUit: async () => ({
        data: null,
        error: { message: 'optimistic_lock_conflict' },
      }),
    });

    try {
      await repository.maakBriefDefinitief(input);
      throw new Error('Verwachte fout bleef uit.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductieSupabaseRpcError);
      expect(error).toMatchObject({
        code: 'optimistic_lock_conflict',
        retrybaar: true,
        rpc: 'off_market_brief_definitief_maken',
        message: 'De gegevens zijn intussen gewijzigd. Ververs en probeer opnieuw.',
      });
    }
  });

  it('roept de RPC-uitvoerder niet aan wanneer de centrale productiepoort dicht staat', () => {
    const voerRpcUit = vi.fn<ProductieSupabaseRpcUitvoerder['voerRpcUit']>();
    const repository = maakGepoorteSupabaseProductieTransactieRepository(
      productiekernStandaardUitgeschakeld,
      { voerRpcUit },
    );

    expect(() => repository.maakBriefDefinitief(input)).toThrow(
      'Transactionele productiehandeling "maakBriefDefinitief" is niet geactiveerd.',
    );
    expect(voerRpcUit).not.toHaveBeenCalled();
  });
});
