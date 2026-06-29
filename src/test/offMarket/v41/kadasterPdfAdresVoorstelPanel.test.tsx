// V41 — KadasterPdfAdresVoorstelPanel: handmatige adresvoorstel-koppeling.
// Test verifieert: zichtbaarheid, ophalen, filteren op confidence,
// 1-voorstel / meerdere-voorstellen, confirm-overschrijven, lege en error
// states. Geen echte Edge Function call.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const invokeMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    functions: { invoke: (...a: any[]) => invokeMock(...a) },
    from: (t: string) => fromMock(t),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import KadasterPdfAdresVoorstelPanel from '@/components/offmarket/KadasterPdfAdresVoorstelPanel';

const DOC = {
  id: 'doc-1', signaal_id: 's1', object_id: null,
  kadaster_data_record_id: null, source: 'kadaster', product_codes: ['rechten'],
  zoekadres: {}, fetched_at: '2025-01-01T00:00:00Z',
  storage_bucket: 'b', storage_path: 'p', bestandsnaam: 'x.pdf',
  bestandsgrootte_bytes: 100, mime_type: 'application/pdf',
  intern_only: true, created_at: '2025-01-01T00:00:00Z',
};

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mockDocs(docs: any[], records: any[] = []) {
  fromMock.mockImplementation((t: string) => {
    if (t === 'kadaster_documenten') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: docs, error: null }),
          }),
        }),
      };
    }
    if (t === 'kadaster_data_records') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: records, error: null }),
          }),
        }),
      };
    }
    throw new Error('onverwachte tabel ' + t);
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
});

const defaultProps = {
  signaalId: 's1',
  huidigeNaam: 'Jan Voorbeeld',
  huidigeBedrijfsnaam: '',
  verzendadresIsLeeg: true,
  bestaandVerzendadres: '',
  kandidaatBron: 'kadaster' as const,
  onPick: vi.fn(),
};

describe('KadasterPdfAdresVoorstelPanel', () => {
  it('toont niets als kandidaat geen Kadaster is', () => {
    mockDocs([DOC]);
    const { container } = render(
      <KadasterPdfAdresVoorstelPanel {...defaultProps} kandidaatBron="signaal" />,
      { wrapper: wrap() },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('toont niets als verzendadres niet leeg is', () => {
    mockDocs([DOC]);
    const { container } = render(
      <KadasterPdfAdresVoorstelPanel {...defaultProps} verzendadresIsLeeg={false} />,
      { wrapper: wrap() },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('toont startknop wanneer Kadaster-kandidaat + leeg adres + opgeslagen PDF', async () => {
    mockDocs([DOC]);
    render(<KadasterPdfAdresVoorstelPanel {...defaultProps} />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByTestId('kpv-start-knop')).toBeInTheDocument());
  });

  it('haalt voorstellen op en neemt enige voorstel over', async () => {
    mockDocs([DOC]);
    invokeMock.mockResolvedValue({
      data: {
        voorstellen: [
          {
            naam: 'Jan Voorbeeld', verzendadres: 'Teststraat 1\n1234 AB Teststad',
            confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/1',
          },
        ],
      },
      error: null,
    });
    const onPick = vi.fn();
    render(<KadasterPdfAdresVoorstelPanel {...defaultProps} onPick={onPick} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-overnemen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    expect(onPick).toHaveBeenCalledWith('Teststraat 1\n1234 AB Teststad', 'Jan Voorbeeld', null);
  });

  it('toont keuze bij meerdere voorstellen en kiest match', async () => {
    mockDocs([DOC]);
    invokeMock.mockResolvedValue({
      data: {
        voorstellen: [
          {
            naam: 'Pieter Anders', verzendadres: 'Anderstraat 5',
            confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/2',
          },
          {
            naam: 'Jan Voorbeeld', verzendadres: 'Teststraat 1',
            confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/2',
          },
        ],
      },
      error: null,
    });
    const onPick = vi.fn();
    render(<KadasterPdfAdresVoorstelPanel {...defaultProps} onPick={onPick} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-keuze-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    // Voorkeursindex moet de match zijn (Jan Voorbeeld → index 1).
    expect(onPick).toHaveBeenCalledWith('Teststraat 1', 'Jan Voorbeeld', null);
  });

  it('filtert voorstellen met lage confidence of zonder adres weg', async () => {
    mockDocs([DOC]);
    invokeMock.mockResolvedValue({
      data: {
        voorstellen: [
          { naam: 'A', verzendadres: 'X 1', confidence: 'laag' },
          { naam: 'B', verzendadres: '', confidence: 'hoog' },
        ],
      },
      error: null,
    });
    render(<KadasterPdfAdresVoorstelPanel {...defaultProps} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-leeg')).toBeInTheDocument());
  });

  it('toont nette melding bij Edge Function fout (502)', async () => {
    mockDocs([DOC]);
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'fail', status: 502 },
    });
    render(<KadasterPdfAdresVoorstelPanel {...defaultProps} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-fout')).toBeInTheDocument());
    expect(screen.getByTestId('kpv-fout').textContent).toMatch(/tekstextractie/i);
  });

  it('vraagt bevestiging als bestaand verzendadres al ingevuld is', async () => {
    mockDocs([DOC]);
    invokeMock.mockResolvedValue({
      data: {
        voorstellen: [
          { naam: 'Jan Voorbeeld', verzendadres: 'Nieuw 1', confidence: 'hoog' },
        ],
      },
      error: null,
    });
    const onPick = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <KadasterPdfAdresVoorstelPanel
        {...defaultProps}
        bestaandVerzendadres="Bestaand adres 9"
        onPick={onPick}
      />,
      { wrapper: wrap() },
    );
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-overnemen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('toont panel voor rechtspersoon met bedrijfsnaam ook zonder Kadaster-kandidaat', async () => {
    mockDocs([DOC]);
    render(
      <KadasterPdfAdresVoorstelPanel
        {...defaultProps}
        huidigeNaam=""
        huidigeBedrijfsnaam="Marga Holding B.V."
        kandidaatBron="signaal"
      />,
      { wrapper: wrap() },
    );
    await waitFor(() => expect(screen.getByTestId('kpv-start-knop')).toBeInTheDocument());
  });

  it('matcht compacte BV-naam uit PDF op bestaande bedrijfsnaam', async () => {
    mockDocs([DOC]);
    invokeMock.mockResolvedValue({
      data: {
        voorstellen: [
          {
            naam: '', bedrijfsnaam: 'Andere Holding B.V.',
            verzendadres: 'Anderstraat 5\n1000 AA AMSTERDAM',
            confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/2',
          },
          {
            naam: '', bedrijfsnaam: 'MargaHoldingB.V.',
            verzendadres: 'Pontsteiger 103\n1014 ZP AMSTERDAM',
            confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/2',
          },
        ],
      },
      error: null,
    });
    const onPick = vi.fn();
    render(
      <KadasterPdfAdresVoorstelPanel
        {...defaultProps}
        huidigeNaam=""
        huidigeBedrijfsnaam="Marga Holding B.V."
        onPick={onPick}
      />,
      { wrapper: wrap() },
    );
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-keuze-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    expect(onPick).toHaveBeenCalledWith(
      'Pontsteiger 103\n1014 ZP AMSTERDAM', '', 'MargaHoldingB.V.',
    );
  });
});
