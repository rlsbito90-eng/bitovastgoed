// V42 — BriefVoorbereidenDialog: PDF-adresvoorstel mag niet "blijven hangen"
// bij wissel van geadresseerde. Verifieert:
//  - na overnemen voor kandidaat A is verzendadres gevuld;
//  - wissel naar kandidaat B (zonder eigen adres) → veld wordt leeg en de
//    PDF-knop is weer zichtbaar;
//  - structured kandidaat-adres blijft werken;
//  - elk PDF-voorstel hoort bij één kandidaat.
//
// Alleen fictieve namen/adressen.
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

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ addTaak: vi.fn(), taken: [], getRelatieById: () => null }),
}));

vi.mock('@/hooks/useOffMarketBrieven', async () => {
  const actual: any = await vi.importActual('@/hooks/useOffMarketBrieven');
  return {
    ...actual,
    useOffMarketBrievenForSignaal: () => ({ data: [], isLoading: false }),
    useUpsertBrief: () => ({ mutateAsync: vi.fn(async () => ({ id: 'new-id' })) }),
    useMarkBriefVerstuurd: () => ({ mutateAsync: vi.fn() }),
  };
});

vi.mock('@/lib/offMarket/brief', async () => {
  const actual: any = await vi.importActual('@/lib/offMarket/brief');
  const kandidaten = [
    {
      label: 'Persoon A', naam: 'Persoon A', bedrijfsnaam: null,
      verzendadres: null, bron: 'kadaster',
    },
    {
      label: 'Persoon B', naam: 'Persoon B', bedrijfsnaam: null,
      verzendadres: null, bron: 'kadaster',
    },
    {
      label: 'Fictief BV', naam: null, bedrijfsnaam: 'Fictief BV',
      verzendadres: 'Bedrijfsweg 9\n9999 ZZ Voorbeeldstad', bron: 'kadaster',
    },
  ];
  return {
    ...actual,
    bouwBriefPrefill: () => ({
      eigenaarNaam: 'Persoon A',
      eigenaarBedrijfsnaam: '',
      verzendadres: '',
      objectadres: 'Objectweg 1, Voorbeeldstad',
      objectomschrijving: 'Objectweg 1, Voorbeeldstad',
      aanhef: 'Geachte heer/mevrouw,',
      onderwerp: 'Onderwerp test',
      brieftekst: 'Tekst',
      kandidaten,
    }),
  };
});

import BriefVoorbereidenDialog from '@/components/offmarket/BriefVoorbereidenDialog';

const DOC = {
  id: 'doc-1', signaal_id: 's1', object_id: null,
  kadaster_data_record_id: null, source: 'kadaster', product_codes: ['rechten'],
  zoekadres: {}, fetched_at: '2025-01-01T00:00:00Z',
  storage_bucket: 'b', storage_path: 'p', bestandsnaam: 'x.pdf',
  bestandsgrootte_bytes: 100, mime_type: 'application/pdf',
  intern_only: true, created_at: '2025-01-01T00:00:00Z',
};

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockDocs(docs: any[]) {
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
    // fallback voor andere queries die de dialog evt. opent
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
    };
  });
}

const signaal: any = {
  id: 's1', titel: 'X', status: 'nieuw_signaal', prioriteit: 'midden',
  assettype: 'wonen', signaaltype: 'overig', plaats: 'Voorbeeldstad',
};

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
  mockDocs([DOC]);
});

function getKandidaatSelect() {
  // Eerste Select in de dialog is de geadresseerde-keuze (komt vóór
  // verzendadres-Select). We zoeken via de labeltekst.
  const labels = screen.getAllByText('Geadresseerde kiezen');
  const groep = labels[0].parentElement!;
  return groep.querySelector('[role="combobox"]') as HTMLElement;
}

async function kiesKandidaat(label: string) {
  fireEvent.click(getKandidaatSelect());
  const opt = await screen.findByText(label);
  fireEvent.click(opt);
}

describe('BriefVoorbereidenDialog — V42 PDF-adresvoorstel per kandidaat', () => {
  it('houdt een PDF-adresvoorstel niet vast bij wissel naar andere kandidaat', async () => {
    invokeMock.mockResolvedValue({
      data: {
        voorstellen: [{
          naam: 'Persoon A',
          verzendadres: 'Adres A 1\n1111 AA Voorbeeldstad',
          confidence: 'hoog',
          rolLabel: 'Eigendom (recht van)', aandeel: '1/1',
        }],
      },
      error: null,
    });
    render(wrap(
      <BriefVoorbereidenDialog
        open={true} onOpenChange={() => {}}
        signaal={signaal} kadasterRecords={[{ id: 'k1' } as any]}
        historischeBrieven={[]}
      />,
    ));

    // Startknop PDF-voorstel zichtbaar bij kandidaat A (geen adres).
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(screen.getByTestId('kpv-overnemen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kpv-overnemen'));

    const verzend = screen.getByLabelText('Verzendadres') as HTMLTextAreaElement;
    await waitFor(() => expect(verzend.value).toContain('Adres A 1'));

    // Wissel naar Persoon B (geen eigen adres).
    await kiesKandidaat('Persoon B');

    await waitFor(() => expect((screen.getByLabelText('Verzendadres') as HTMLTextAreaElement).value).toBe(''));
    // PDF-knop is weer zichtbaar.
    expect(await screen.findByTestId('kpv-start-knop')).toBeInTheDocument();
  });

  it('vult structured kandidaat-adres bij wissel naar kandidaat met eigen adres', async () => {
    render(wrap(
      <BriefVoorbereidenDialog
        open={true} onOpenChange={() => {}}
        signaal={signaal} kadasterRecords={[{ id: 'k1' } as any]}
        historischeBrieven={[]}
      />,
    ));

    await kiesKandidaat('Fictief BV');
    const verzend = screen.getByLabelText('Verzendadres') as HTMLTextAreaElement;
    await waitFor(() => expect(verzend.value).toContain('Bedrijfsweg 9'));
  });

  it('elk PDF-voorstel hoort bij eigen kandidaat — wissel terug toont niet meer het andere adres', async () => {
    // A → voorstel "Adres A 1", B → voorstel "Adres B 2".
    invokeMock
      .mockResolvedValueOnce({
        data: { voorstellen: [{
          naam: 'Persoon A', verzendadres: 'Adres A 1\n1111 AA Voorbeeldstad',
          confidence: 'hoog',
        }] }, error: null,
      })
      .mockResolvedValueOnce({
        data: { voorstellen: [{
          naam: 'Persoon B', verzendadres: 'Adres B 2\n2222 BB Voorbeeldstad',
          confidence: 'hoog',
        }] }, error: null,
      });
    render(wrap(
      <BriefVoorbereidenDialog
        open={true} onOpenChange={() => {}}
        signaal={signaal} kadasterRecords={[{ id: 'k1' } as any]}
        historischeBrieven={[]}
      />,
    ));

    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    fireEvent.click(await screen.findByTestId('kpv-overnemen'));
    await waitFor(() =>
      expect((screen.getByLabelText('Verzendadres') as HTMLTextAreaElement).value).toContain('Adres A 1'),
    );

    await kiesKandidaat('Persoon B');
    await waitFor(() =>
      expect((screen.getByLabelText('Verzendadres') as HTMLTextAreaElement).value).toBe(''),
    );

    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    fireEvent.click(await screen.findByTestId('kpv-overnemen'));
    await waitFor(() =>
      expect((screen.getByLabelText('Verzendadres') as HTMLTextAreaElement).value).toContain('Adres B 2'),
    );

    // Wissel terug naar A → mag NIET het adres van B tonen.
    await kiesKandidaat('Persoon A');
    await waitFor(() => {
      const v = (screen.getByLabelText('Verzendadres') as HTMLTextAreaElement).value;
      expect(v).not.toContain('Adres B 2');
    });
  });

  it('vraagt bevestiging voordat een handmatig adres bij wissel verloren gaat', async () => {
    render(wrap(
      <BriefVoorbereidenDialog
        open={true} onOpenChange={() => {}}
        signaal={signaal} kadasterRecords={[{ id: 'k1' } as any]}
        historischeBrieven={[]}
      />,
    ));
    const verzend = screen.getByLabelText('Verzendadres') as HTMLTextAreaElement;
    fireEvent.change(verzend, { target: { value: 'Handmatig 7\n1234 AB Plaats' } });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await kiesKandidaat('Persoon B');
    expect(confirmSpy).toHaveBeenCalled();
    // Wissel geannuleerd → adres blijft staan.
    expect((screen.getByLabelText('Verzendadres') as HTMLTextAreaElement).value)
      .toContain('Handmatig 7');
    confirmSpy.mockRestore();
  });
});
