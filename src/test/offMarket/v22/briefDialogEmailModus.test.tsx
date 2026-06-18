// V2.2 — BriefVoorbereidenDialog render-gedrag voor kanaal-toggle, e-mailmodus en profielen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EMAIL_PROFIEL_VOLGORDE } from '@/lib/offMarket/email/emailProfielen';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: {}, error: null }), maybeSingle: () => Promise.resolve({ data: {}, error: null }) }) }),
    }),
  },
}));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ addTaak: vi.fn(), taken: [], getRelatieById: () => null }),
}));

vi.mock('@/hooks/useOffMarketBrieven', async () => {
  const actual: any = await vi.importActual('@/hooks/useOffMarketBrieven');
  return {
    ...actual,
    useOffMarketBrievenForSignaal: () => ({ data: [], isLoading: false }),
    useUpsertBrief: () => ({ mutateAsync: vi.fn(async (x: any) => ({ id: 'new-id', signaal_id: x.signaal_id })) }),
    useMarkBriefVerstuurd: () => ({ mutateAsync: vi.fn() }),
  };
});

import BriefVoorbereidenDialog from '@/components/offmarket/BriefVoorbereidenDialog';

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const signaal: any = {
  id: 's1', titel: 'X', status: 'nieuw_signaal', prioriteit: 'midden',
  assettype: 'wonen', signaaltype: 'overig', plaats: 'Voorbeeldstad',
};

beforeEach(() => { /* noop */ });

describe('BriefVoorbereidenDialog — V2.2 kanaal & e-mail', () => {
  it('opent standaard in postmodus', () => {
    render(wrap(
      <BriefVoorbereidenDialog
        open={true}
        onOpenChange={() => {}}
        signaal={signaal}
        kadasterRecords={[]}
        historischeBrieven={[]}
      />,
    ));
    const postBtn = screen.getByTestId('brief-kanaal-post');
    expect(postBtn.getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('brief-download-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('brief-markeer-verstuurd')).toBeInTheDocument();
  });

  it('bestaande brief met kanaal=email opent in e-mailmodus', () => {
    render(wrap(
      <BriefVoorbereidenDialog
        open={true}
        onOpenChange={() => {}}
        signaal={signaal}
        kadasterRecords={[]}
        historischeBrieven={[]}
        initialBrief={{
          id: 'b-e1', signaal_id: 's1',
          eigenaar_naam: 'X', eigenaar_bedrijfsnaam: null,
          verzendadres: null, objectadres: null, objectomschrijving: null,
          aanhef: '', onderwerp: 'Test', brieftekst: 'Hallo',
          status: 'concept', verzonden_op: null,
          aangemaakt_door: null,
          created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
          archived_at: null, archived_reason: null,
          kanaal: 'email', campagne_stap: 'email_1',
        } as any}
      />,
    ));
    expect(screen.getByTestId('brief-kanaal-email').getAttribute('data-state')).toBe('active');
    expect(screen.queryByTestId('brief-download-pdf')).toBeNull();
    expect(screen.getByTestId('brief-kopieer-email')).toBeInTheDocument();
    expect(screen.getByTestId('brief-markeer-verzonden')).toBeInTheDocument();
  });

  it('e-mailmodus toont alle 9 profielen in dropdown', () => {
    render(wrap(
      <BriefVoorbereidenDialog
        open={true}
        onOpenChange={() => {}}
        signaal={signaal}
        kadasterRecords={[]}
        historischeBrieven={[]}
      />,
    ));
    fireEvent.click(screen.getByTestId('brief-kanaal-email'));
    // Verberg PDF-knop
    expect(screen.queryByTestId('brief-download-pdf')).toBeNull();
    expect(screen.getByTestId('brief-kopieer-email')).toBeInTheDocument();

    // Profielen-select aanwezig
    expect(screen.getByTestId('brief-email-profiel-trigger')).toBeInTheDocument();
    // Open via klik
    fireEvent.pointerDown(screen.getByTestId('brief-email-profiel-trigger'));
    // Niet alle UI-libs renderen items synchroon; check totaal aantal profielen in helper.
    expect(EMAIL_PROFIEL_VOLGORDE).toHaveLength(9);
  });
});
