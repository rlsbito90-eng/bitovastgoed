import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProductiekernNogNietGestart from './ProductiekernNogNietGestart';
import type { ProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';

const getUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser },
  },
}));

function renderMetQueryClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function samenstelling(schrijvenActief: boolean) {
  const startVerwerking = vi.fn().mockResolvedValue({
    selectieId: 'selectie-1',
    signaalId: 'signaal-1',
    objectId: null,
    verwerkingGestartOp: '2026-08-08T20:00:00Z',
    verwerkingGestartDoor: 'actor-1',
    primaireWerkbak: 'eigenaar_achterhalen',
    volgendeActieOp: null,
    volgendeActieOmschrijving: null,
  });

  const writeSamenstelling = {
    activatie: {
      lezenActief: schrijvenActief,
      schrijvenActief,
      ontbrekendBewijs: schrijvenActief ? [] : ['bewijs ontbreekt'],
    },
    vroegeRepository: {
      startVerwerking,
      reserveerBrief: vi.fn(),
      maakBriefversie: vi.fn(),
      maakPrintbatch: vi.fn(),
      voegBriefversieToeAanBatch: vi.fn(),
    },
    transactieRepository: {
      maakBriefDefinitief: vi.fn(),
      registreerBatchdocumenten: vi.fn(),
      markeerBatchGeprint: vi.fn(),
      markeerBriefGepost: vi.fn(),
    },
  } as unknown as ProductiekernBrowserWriteSamenstelling;

  return { writeSamenstelling, startVerwerking };
}

const item = {
  selectieId: 'selectie-1',
  signaalId: 'signaal-1',
  label: 'Teststraat 1, Amsterdam',
};

describe('ProductiekernNogNietGestart', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it('blokkeert Start verwerking wanneer werk-CRM schrijven niet actief is', () => {
    const { writeSamenstelling, startVerwerking } = samenstelling(false);
    renderMetQueryClient(
      <ProductiekernNogNietGestart items={[item]} writeSamenstelling={writeSamenstelling} />,
    );

    expect(screen.getByRole('button', { name: 'Start verwerking' })).toBeDisabled();
    expect(startVerwerking).not.toHaveBeenCalled();
  });

  it('gebruikt uitsluitend de ingelogde actor en start exact één verwerking', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'actor-1' } }, error: null });
    const { writeSamenstelling, startVerwerking } = samenstelling(true);
    renderMetQueryClient(
      <ProductiekernNogNietGestart items={[item]} writeSamenstelling={writeSamenstelling} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start verwerking' }));

    await waitFor(() => expect(startVerwerking).toHaveBeenCalledTimes(1));
    expect(startVerwerking).toHaveBeenCalledWith(expect.objectContaining({
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      operationKey: expect.stringContaining('acquisitie:start-verwerking:selectie-1:'),
    }));
  });
});
