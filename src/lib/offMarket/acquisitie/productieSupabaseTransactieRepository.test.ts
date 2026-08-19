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

const batch = {
  id: 'batch-1', batchnummer: 'BAT2026080801', status: 'documenten_gegenereerd' as const,
  documentversie: 1, aanvullingOpBatchId: null, printdatum: null, verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};
const documenttypen = ['batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels'] as const;
const nieuweDocumenten = documenttypen.map((documenttype, index) => ({
  id: `doc-${index}`, batchId: batch.id, documentversie: 2, documenttype,
  bestandReferentie: `off-market-productie/actor-1/batch-1/v2/poging/${documenttype}`,
  status: 'actief' as const, metadata: { bestandsnaam: `${documenttype}.pdf` },
  createdAt: '2026-08-08T08:30:00.000Z', vervallenOp: null,
}));
const documentversieInput = {
  actie: 'batch_documentversie_vernieuwen' as const,
  actorId: 'actor-1',
  operationKey: 'batch-documentversie:batch-1:v2',
  verwachtVersienummer: 1,
  uitgevoerdOp: '2026-08-08T08:30:00.000Z',
  batch,
  nieuweDocumentversie: 2,
  reden: 'Huisstijlherstel',
  opgeslagenDocumenten: nieuweDocumenten,
  plan: {
    batchId: batch.id, batchnummer: batch.batchnummer, documentversie: 2,
    briefAantal: 1, geadresseerdeAantal: 1,
    documenten: documenttypen.map((documenttype) => ({
      documenttype, bestandsnaam: `${documenttype}.pdf`, documentversie: 2,
      briefVersieIds: ['versie-1'],
    })),
    waarschuwingen: [],
  },
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

  it('vernieuwt batchdocumenten via exact één transactionele RPC', async () => {
    const voerRpcUit = vi.fn<ProductieSupabaseRpcUitvoerder['voerRpcUit']>()
      .mockResolvedValue({ data: null, error: null });
    const repository = new SupabaseAcquisitieProductieTransactieRepository({ voerRpcUit });

    await expect(repository.vernieuwBatchdocumenten(documentversieInput)).resolves.toBeUndefined();

    expect(voerRpcUit).toHaveBeenCalledOnce();
    expect(voerRpcUit).toHaveBeenCalledWith(
      'off_market_batch_documentversie_vernieuwen',
      expect.objectContaining({
        p_batch_id: 'batch-1',
        p_operation_key: 'batch-documentversie:batch-1:v2',
        p_verwacht_documentversie: 1,
        p_nieuwe_documentversie: 2,
        p_reden: 'Huisstijlherstel',
        p_documenten: expect.arrayContaining([
          expect.objectContaining({ documenttype: 'brieven_pdf' }),
        ]),
      }),
    );
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
