// V44 — KadasterPdfAdresVoorstelPanel: dropdownlabels per voorstel tonen
// volledige naam/bedrijfsnaam, geen adres. Geen automatische voorselectie
// bij meerdere voorstellen zonder unieke match. Verbeterde naam-matching.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

function mockDocs(docs: any[], records: any[] = []) {
  fromMock.mockImplementation((t: string) => {
    if (t === 'kadaster_documenten') {
      return { select: () => ({ eq: () => ({
        order: () => Promise.resolve({ data: docs, error: null }),
      }) }) };
    }
    if (t === 'kadaster_data_records') {
      return { select: () => ({ eq: () => ({
        order: () => Promise.resolve({ data: records, error: null }),
      }) }) };
    }
    throw new Error('onverwachte tabel ' + t);
  });
}

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const basis = {
  signaalId: 's1',
  huidigeBedrijfsnaam: '',
  verzendadresIsLeeg: true,
  bestaandVerzendadres: '',
  kandidaatBron: 'kadaster' as const,
};

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
  mockDocs([DOC]);
});

describe('KadasterPdfAdresVoorstelPanel · labels en matching', () => {
  it('toont vier volledige namen in labels zonder adres', async () => {
    invokeMock.mockResolvedValue({
      data: { voorstellen: [
        { naam: 'Alexandra Catharina Celine Achternaam', verzendadres: 'A 1', confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/4' },
        { naam: 'Berend Daniel Achternaam', verzendadres: 'B 2', confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/4' },
        { naam: 'Cornelis Edward Achternaam', verzendadres: 'C 3', confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/4' },
        { naam: 'Diana Femke Achternaam', verzendadres: 'D 4', confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/4' },
      ] },
      error: null,
    });
    render(<KadasterPdfAdresVoorstelPanel {...basis} huidigeNaam="Zoekt Iemand Anders" onPick={vi.fn()} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-keuze-trigger')).toBeInTheDocument());
    const items = [0, 1, 2, 3].map((i) => screen.getByTestId(`kpv-keuze-${i}`));
    expect(items[0].textContent).toContain('Alexandra Catharina Celine Achternaam');
    expect(items[1].textContent).toContain('Berend Daniel Achternaam');
    expect(items[2].textContent).toContain('Cornelis Edward Achternaam');
    expect(items[3].textContent).toContain('Diana Femke Achternaam');
    for (const it of items) {
      expect(it.textContent ?? '').not.toMatch(/\bA 1\b|\bB 2\b|\bC 3\b|\bD 4\b/);
    }
  });

  it('voegt "match" toe in label en preselecteert bij persoonsmatch via voorletters', async () => {
    invokeMock.mockResolvedValue({
      data: { voorstellen: [
        { naam: 'Berend Daniel Achternaam', verzendadres: 'B 2', confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/4' },
        { naam: 'Alexandra Catharina Celine Achternaam', verzendadres: 'A 1', confidence: 'hoog', rolLabel: 'Eigendom (recht van)', aandeel: '1/4' },
      ] },
      error: null,
    });
    const onPick = vi.fn();
    render(<KadasterPdfAdresVoorstelPanel {...basis} huidigeNaam="A.C.C. Achternaam" onPick={onPick} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-keuze-trigger')).toBeInTheDocument());
    expect(screen.getByTestId('kpv-keuze-1').textContent).toMatch(/match/);
    expect(screen.queryByTestId('kpv-meerdere-melding')).toBeNull();
    // Overnemen: nog steeds expliciete klik vereist.
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    expect(onPick).toHaveBeenCalledWith('A 1', 'Alexandra Catharina Celine Achternaam', null);
  });

  it('toont meldingsregel en blokkeert overnemen als geen unieke match', async () => {
    invokeMock.mockResolvedValue({
      data: { voorstellen: [
        { naam: 'Berend Daniel Achternaam', verzendadres: 'B 2', confidence: 'hoog', rolLabel: 'Eigendom', aandeel: '1/4' },
        { naam: 'Cornelis Edward Achternaam', verzendadres: 'C 3', confidence: 'hoog', rolLabel: 'Eigendom', aandeel: '1/4' },
      ] },
      error: null,
    });
    const onPick = vi.fn();
    render(<KadasterPdfAdresVoorstelPanel {...basis} huidigeNaam="Geen Match Naam" onPick={onPick} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await screen.findByTestId('kpv-meerdere-melding');
    const knop = screen.getByTestId('kpv-overnemen') as HTMLButtonElement;
    expect(knop.disabled).toBe(true);
    fireEvent.click(knop);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('herkent rechtspersoonmatch tussen "Voorbeeld BV" en "Voorbeeld B.V."', async () => {
    invokeMock.mockResolvedValue({
      data: { voorstellen: [
        { bedrijfsnaam: 'Andere Holding B.V.', verzendadres: 'X 9', confidence: 'hoog', rolLabel: 'Eigendom', aandeel: '1/2' },
        { bedrijfsnaam: 'Voorbeeld B.V.', verzendadres: 'Y 1', confidence: 'hoog', rolLabel: 'Eigendom', aandeel: '1/2' },
      ] },
      error: null,
    });
    const onPick = vi.fn();
    render(
      <KadasterPdfAdresVoorstelPanel
        {...basis}
        huidigeNaam=""
        huidigeBedrijfsnaam="Voorbeeld BV"
        onPick={onPick}
      />,
      { wrapper: wrap() },
    );
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-keuze-trigger')).toBeInTheDocument());
    expect(screen.getByTestId('kpv-keuze-1').textContent).toMatch(/match/);
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    expect(onPick).toHaveBeenCalledWith('Y 1', null, 'Voorbeeld B.V.');
  });

  it('preselecteert het enige voorstel maar wacht op expliciete klik', async () => {
    invokeMock.mockResolvedValue({
      data: { voorstellen: [
        { naam: 'Iemand Anders Achternaam', verzendadres: 'Z 9', confidence: 'hoog', rolLabel: 'Eigendom', aandeel: '1/1' },
      ] },
      error: null,
    });
    const onPick = vi.fn();
    render(<KadasterPdfAdresVoorstelPanel {...basis} huidigeNaam="Niet Matchend" onPick={onPick} />, { wrapper: wrap() });
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await screen.findByTestId('kpv-overnemen');
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('kpv-overnemen'));
    expect(onPick).toHaveBeenCalledWith('Z 9', 'Iemand Anders Achternaam', null);
  });
});
