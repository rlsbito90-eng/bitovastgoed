// V43 — KadasterPdfAdresVoorstelPanel kiest het Kadasterdocument dat hoort
// bij de geselecteerde kandidaat (kandidaatRecordId → kadaster_data_record_id).
// Geen echte Kadaster-aanroep; alleen Edge Function invoke wordt gemockt.
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

function maakDoc(id: string, recordId: string | null, fetchedAt: string) {
  return {
    id, signaal_id: 's1', object_id: null,
    kadaster_data_record_id: recordId, source: 'kadaster',
    product_codes: ['rechten'], zoekadres: {}, fetched_at: fetchedAt,
    storage_bucket: 'b', storage_path: 'p/' + id, bestandsnaam: id + '.pdf',
    bestandsgrootte_bytes: 100, mime_type: 'application/pdf',
    intern_only: true, created_at: fetchedAt,
  };
}
function maakRecord(id: string, fetchedAt: string) {
  return {
    id, signaal_id: 's1', object_id: null, product_code: 'rechten',
    fetched_at: fetchedAt, pdf_document_id: null,
  };
}

function setup(docs: any[], records: any[]) {
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

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
});

describe('KadasterPdfAdresVoorstelPanel · kandidaatRecordId-koppeling', () => {
  it('gebruikt document gekoppeld aan recordId (niet het recentste)', async () => {
    const docA = maakDoc('doc-A', 'rec-A', '2025-01-01T00:00:00Z');
    const docB = maakDoc('doc-B', 'rec-B', '2025-02-01T00:00:00Z');
    setup([docB, docA], [maakRecord('rec-A', '2025-01-01T00:00:00Z'), maakRecord('rec-B', '2025-02-01T00:00:00Z')]);
    invokeMock.mockResolvedValue({
      data: { voorstellen: [{ naam: 'X', verzendadres: 'Adres B 1', confidence: 'hoog' }] },
      error: null,
    });
    render(
      <KadasterPdfAdresVoorstelPanel
        signaalId="s1" huidigeNaam="X" huidigeBedrijfsnaam=""
        verzendadresIsLeeg bestaandVerzendadres=""
        kandidaatBron="kadaster" kandidaatRecordId="rec-A"
        onPick={vi.fn()}
      />,
      { wrapper: wrap() },
    );
    fireEvent.click(await screen.findByTestId('kpv-start-knop'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(invokeMock.mock.calls[0][1]).toEqual({ body: { document_id: 'doc-A' } });
    // Geen fallback-waarschuwing bij directe koppeling.
    expect(screen.queryByTestId('kpv-fallback-waarschuwing')).toBeNull();
  });

  it('valt terug op recentste rechten-doc + toont waarschuwing als geen koppeling bestaat', async () => {
    const docA = maakDoc('doc-A', null, '2025-01-01T00:00:00Z');
    const docB = maakDoc('doc-B', null, '2025-02-01T00:00:00Z');
    setup([docB, docA], [maakRecord('rec-X', '2025-06-01T00:00:00Z')]);
    invokeMock.mockResolvedValue({
      data: { voorstellen: [{ naam: 'X', verzendadres: 'Adres 1', confidence: 'hoog' }] },
      error: null,
    });
    render(
      <KadasterPdfAdresVoorstelPanel
        signaalId="s1" huidigeNaam="X" huidigeBedrijfsnaam=""
        verzendadresIsLeeg bestaandVerzendadres=""
        kandidaatBron="kadaster" kandidaatRecordId="rec-X"
        onPick={vi.fn()}
      />,
      { wrapper: wrap() },
    );
    await screen.findByTestId('kpv-fallback-waarschuwing');
    fireEvent.click(screen.getByTestId('kpv-start-knop'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(invokeMock.mock.calls[0][1]).toEqual({ body: { document_id: 'doc-B' } });
  });

  it('toont fallback-waarschuwing wanneer kandidaatRecordId ontbreekt', async () => {
    const docA = maakDoc('doc-A', 'rec-A', '2025-01-01T00:00:00Z');
    setup([docA], [maakRecord('rec-A', '2025-01-01T00:00:00Z')]);
    render(
      <KadasterPdfAdresVoorstelPanel
        signaalId="s1" huidigeNaam="X" huidigeBedrijfsnaam=""
        verzendadresIsLeeg bestaandVerzendadres=""
        kandidaatBron="kadaster" kandidaatRecordId={null}
        onPick={vi.fn()}
      />,
      { wrapper: wrap() },
    );
    await screen.findByTestId('kpv-fallback-waarschuwing');
  });
});
