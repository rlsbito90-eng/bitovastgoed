import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BatchdocumentContract,
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from '@/lib/offMarket/acquisitie/productiekernContract';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwProductiekernPrintbatchModellen } from '@/lib/offMarket/acquisitie/productiekernPrintbatchOverzicht';
import type { AcquisitieProductiekernRepository } from '@/lib/offMarket/acquisitie/productiekernRepository';
import ProductiekernPrintbatchWerkbak from './ProductiekernPrintbatchWerkbak';

const OPEN_PRINTBATCHES_KEY = 'off-market-acq:open-printbatches';

const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081801', status: 'documenten_gegenereerd', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null, geannuleerdOp: null, annuleringsreden: null,
};
const brief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000005', signaalId: 'signaal-1', selectieId: 'selectie-1',
  objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief', vervangingVanBriefId: null,
  definitiefOp: '2026-08-18T01:00:00Z', vergrendeldOp: '2026-08-18T01:00:00Z', annuleringsreden: null,
};
const versie: BriefversieContract = {
  id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'actief',
  inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: 'Maasstraat 94-4', objectomschrijving: null, templateId: null, templateVersie: null },
  geadresseerde: {
    naam: 'Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM', bedrijfsnaam: null, aanhef: null,
    straatHuisnummer: 'Stroombaan 57', postcode: '1181VX', plaats: 'Amstelveen', land: 'Nederland',
    bron: 'kadaster', verificatiestatus: 'geverifieerd', relatieId: null,
  },
  bestandReferentie: null, createdAt: '2026-08-18T01:00:00Z', vervallenOp: null, verzondenOp: null,
};
const koppeling: PrintbatchBriefContract = {
  id: 'koppeling-1', batchId: 'batch-1', briefId: 'brief-1', briefVersieId: 'versie-1',
  verwijderdOp: null, afwijkingsstatus: null, afwijkingsreden: null,
};
const signaal = {
  id: 'signaal-1', adres: 'Maasstraat 94-4', plaats: 'Amsterdam',
} as OffMarketSignaal;

const modellen = bouwProductiekernPrintbatchModellen({
  batches: [batch], koppelingen: [koppeling], brieven: [brief], versies: [versie], signalen: [signaal],
});

const documenten: BatchdocumentContract[] = (
  ['batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels'] as const
).map((documenttype, index) => {
  const extensie = documenttype === 'adreslabels' ? 'csv' : 'pdf';
  const pad = `batches/${batch.id}/v${batch.documentversie}/${documenttype}.${extensie}`;
  return {
    id: `document-${index + 1}`,
    batchId: batch.id,
    documentversie: batch.documentversie,
    documenttype,
    bestandReferentie: `off-market-productie/${pad}`,
    status: 'actief',
    metadata: {
      bucket: 'off-market-productie',
      pad,
      bestandsnaam: `${batch.batchnummer}-${documenttype}.${extensie}`,
    },
    createdAt: '2026-08-18T01:00:00Z',
    vervallenOp: null,
  };
});

function renderWerkbak() {
  return render(
    <MemoryRouter>
      <ProductiekernPrintbatchWerkbak modellen={modellen} />
    </MemoryRouter>,
  );
}

describe('ProductiekernPrintbatchWerkbak', () => {
  beforeEach(() => sessionStorage.removeItem(OPEN_PRINTBATCHES_KEY));

  it('houdt batches standaard compact en toont BR/signaal pas na uitklappen', () => {
    expect(modellen).toHaveLength(1);
    expect(modellen[0]).toMatchObject({ aantalSignalen: 1 });
    expect(modellen[0].regels[0]).toMatchObject({
      briefnummer: 'BR2026000005',
      geadresseerde: 'E.S. Blok',
      objectLabel: 'Maasstraat 94-4 · Amsterdam',
    });

    renderWerkbak();

    const toggle = screen.getByTestId('productiekern-printbatch-toggle-BAT2026081801');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('BAT2026081801')).toBeInTheDocument();
    expect(screen.getByText('1 brief')).toBeInTheDocument();
    expect(screen.getByText('1 signaal')).toBeInTheDocument();
    expect(screen.getByText('versie 1')).toBeInTheDocument();
    expect(screen.getByTestId('productiekern-printbatch-status-BAT2026081801'))
      .toHaveTextContent('Printklaar');
    expect(screen.queryByText('BR2026000005')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('BR2026000005')).toBeInTheDocument();
    expect(screen.getByText('E.S. Blok')).toBeInTheDocument();
    expect(screen.queryByText(/Geboren/)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('BR2026000005')).not.toBeInTheDocument();
  });

  it('herstelt een geopende batch na detailnavigatie/remount binnen dezelfde sessie', () => {
    const eerste = renderWerkbak();
    fireEvent.click(screen.getByTestId('productiekern-printbatch-toggle-BAT2026081801'));
    expect(sessionStorage.getItem(OPEN_PRINTBATCHES_KEY)).toContain('batch-1');
    eerste.unmount();

    renderWerkbak();
    expect(screen.getByTestId('productiekern-printbatch-toggle-BAT2026081801')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('BR2026000005')).toBeInTheDocument();
  });

  it('vindt dezelfde batch op zowel BAT- als BR-nummer', () => {
    const eerste = render(
      <MemoryRouter>
        <ProductiekernPrintbatchWerkbak modellen={modellen} zoekterm="BAT2026081801" />
      </MemoryRouter>,
    );
    expect(screen.getByText('BAT2026081801')).toBeInTheDocument();
    eerste.unmount();

    render(
      <MemoryRouter>
        <ProductiekernPrintbatchWerkbak modellen={modellen} zoekterm="BR2026000005" />
      </MemoryRouter>,
    );
    expect(screen.getByText('BAT2026081801')).toBeInTheDocument();
  });

  it('biedt na uitklappen uitsluitend de geregistreerde batchbestanden opnieuw aan', async () => {
    const repository = {
      haalBatchdocumenten: vi.fn().mockResolvedValue(documenten),
    } as unknown as AcquisitieProductiekernRepository;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProductiekernPrintbatchWerkbak modellen={modellen} repository={repository} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('productiekern-printbatch-toggle-BAT2026081801'));

    expect(await screen.findByTestId('productiekern-productiebestanden-voorbereiden'))
      .toHaveTextContent('ZIP-download klaarzetten');
    expect(screen.getByTestId('productiekern-productiebestanden-voorbereiden'))
      .toHaveClass('w-full', 'min-w-0', 'whitespace-normal');
    expect(repository.haalBatchdocumenten).toHaveBeenCalledTimes(1);
    expect(repository.haalBatchdocumenten).toHaveBeenCalledWith('batch-1');
  });
});
