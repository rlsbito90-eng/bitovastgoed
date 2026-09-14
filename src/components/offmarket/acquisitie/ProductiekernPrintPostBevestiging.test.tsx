import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductiekernBatchBrief } from '@/lib/offMarket/acquisitie/productiekernPrintbatch';
import type { AcquisitieProductieTransactieRepository } from '@/lib/offMarket/acquisitie/productieTransactieRepository';
import ProductiekernPrintPostBevestiging from './ProductiekernPrintPostBevestiging';

const { markeerBatchGepost, toastError, toastSuccess } = vi.hoisted(() => ({
  markeerBatchGepost: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'actor-1' } }, error: null })) } },
}));
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock('@/lib/offMarket/acquisitie/productiekernBrowserWriteClient', () => ({
  maakStandaardProductiekernBrowserWriteSamenstelling: () => ({
    activatie: { schrijvenActief: true },
    transactieRepository: { markeerBatchGepost } as unknown as AcquisitieProductieTransactieRepository,
  }),
}));

const batch = {
  id: 'batch-2026083001', batchnummer: 'BAT2026083001', status: 'geprint' as const,
  documentversie: 3, aanvullingOpBatchId: null,
  printdatum: '2026-08-30T09:00:00.000Z', verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};
const brieven: ProductiekernBatchBrief[] = [{
  brief: {
    id: 'brief-1', briefnummer: 'BR2026000001', signaalId: 'signaal-1', selectieId: 'selectie-1',
    objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief',
    vervangingVanBriefId: null, definitiefOp: '2026-08-30T08:00:00.000Z',
    vergrendeldOp: '2026-08-30T08:00:00.000Z', annuleringsreden: null,
  },
  versie: {
    id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'actief',
    inhoud: { onderwerp: 'Onderwerp', brieftekst: 'Tekst', objectadres: null, objectomschrijving: null, templateId: null, templateVersie: null },
    geadresseerde: { naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1', postcode: '1234 AB', plaats: 'Plaats', land: 'Nederland', bron: 'test', verificatiestatus: 'onbekend', relatieId: null },
    bestandReferentie: null, createdAt: '2026-08-30T08:00:00.000Z', vervallenOp: null, verzondenOp: null,
  },
  geadresseerdeKey: 'signaal-1|eigenaar',
}];

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ProductiekernPrintPostBevestiging', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verwerkt BAT2026083001 via de atomische batchactie en ververst de UI-projecties', async () => {
    markeerBatchGepost.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const onBatchChange = vi.fn();
    render(
      <ProductiekernPrintPostBevestiging batch={batch} brieven={brieven} onBatchChange={onBatchChange} />,
      { wrapper: wrapper(queryClient) },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alle brieven daadwerkelijk gepost' }));

    await waitFor(() => expect(markeerBatchGepost).toHaveBeenCalledOnce());
    expect(markeerBatchGepost).toHaveBeenCalledWith(expect.objectContaining({
      actie: 'batch_gepost_markeren',
      batch,
      actorId: 'actor-1',
      operationKey: 'batch-gepost:batch-2026083001:v3',
      verwachtVersienummer: 3,
    }));
    await waitFor(() => expect(onBatchChange).toHaveBeenCalledWith(expect.objectContaining({
      status: 'gepost', documentversie: 3, printdatum: batch.printdatum,
    })));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['off-market-acquisitie-productiekern'] });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('laat de UI en batch ongewijzigd en toont de fout bij een mislukte atomaire actie', async () => {
    markeerBatchGepost.mockRejectedValueOnce(new Error('Documentversie is intussen gewijzigd.'));
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const onBatchChange = vi.fn();
    render(
      <ProductiekernPrintPostBevestiging batch={batch} brieven={brieven} onBatchChange={onBatchChange} />,
      { wrapper: wrapper(queryClient) },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alle brieven daadwerkelijk gepost' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Documentversie is intussen gewijzigd.'));
    expect(onBatchChange).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Alle brieven daadwerkelijk gepost' })).toBeEnabled();
  });
});
