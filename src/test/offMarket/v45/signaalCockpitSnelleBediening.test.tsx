// V45 — Snelle acquisitiebediening in Signaal-Cockpit:
// inline prioriteit + eigenaarstatus dropdowns, briefstatus-scrollknop.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

beforeAll(() => {
  if (!(HTMLElement.prototype as any).hasPointerCapture) {
    (HTMLElement.prototype as any).hasPointerCapture = () => false;
    (HTMLElement.prototype as any).releasePointerCapture = () => {};
    (HTMLElement.prototype as any).setPointerCapture = () => {};
  }
  if (!(HTMLElement.prototype as any).scrollIntoView) {
    (HTMLElement.prototype as any).scrollIntoView = () => {};
  }
});

const updateMock = vi.fn(async (_args: any) => ({ id: 'sig-x' }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: (patch: any) => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              await updateMock({ patch });
              return { data: { id: 'sig-x', ...patch }, error: null };
            },
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useOffMarketBrieven', () => ({
  useOffMarketBrievenForSignaal: () => ({ data: [] }),
}));

import SignaalCockpit from '@/components/offmarket/SignaalCockpit';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const sig: OffMarketSignaal = {
  id: 'sig-x',
  titel: 'Fictief object',
  adres: 'Fictiefstraat 1',
  postcode: null,
  status: 'nieuw_signaal',
  prioriteit: 'midden',
  assettype: 'wonen',
  ai_status: 'klaar',
  ai_score: 50,
  bag_status: 'verrijkt',
  eigenaarstatus: 'onbekend',
} as unknown as OffMarketSignaal;

describe('V45 SignaalCockpit — snelle acquisitiebediening', () => {
  it('rendert status, prioriteit, eigenaarstatus en briefstatus', () => {
    wrap(<SignaalCockpit signaal={sig} taken={[]} briefStatus="geen" />);
    expect(screen.getByTestId('signaal-cockpit')).toBeInTheDocument();
    expect(screen.getByTestId('status-wijzig-compact')).toBeInTheDocument();
    expect(screen.getByTestId('prioriteit-wijzig-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('eigenaarstatus-wijzig-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('briefstatus-scroll-knop')).toBeInTheDocument();
  });

  it('prioriteit-dropdown wijzigt naar urgent', async () => {
    updateMock.mockClear();
    const user = userEvent.setup();
    wrap(<SignaalCockpit signaal={sig} taken={[]} briefStatus="geen" />);
    await user.click(screen.getByTestId('prioriteit-wijzig-dropdown'));
    const opt = await screen.findByTestId('prioriteit-optie-urgent');
    await user.click(opt);
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      expect(updateMock.mock.calls.some((c) => c[0]?.patch?.prioriteit === 'urgent')).toBe(true);
    });
  });

  it('eigenaarstatus-dropdown wijzigt naar benaderd', async () => {
    updateMock.mockClear();
    const user = userEvent.setup();
    wrap(<SignaalCockpit signaal={sig} taken={[]} briefStatus="geen" />);
    await user.click(screen.getByTestId('eigenaarstatus-wijzig-dropdown'));
    const opt = await screen.findByTestId('eigenaarstatus-optie-benaderd');
    await user.click(opt);
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      expect(updateMock.mock.calls.some((c) => c[0]?.patch?.eigenaarstatus === 'benaderd')).toBe(true);
    });
  });

  it('briefstatus-badge triggert scroll, geen signaal-update', async () => {
    updateMock.mockClear();
    const scrollSpy = vi.fn();
    (HTMLElement.prototype as any).scrollIntoView = scrollSpy;
    const host = document.createElement('div');
    host.id = 'brieven-sectie';
    document.body.appendChild(host);

    const user = userEvent.setup();
    wrap(<SignaalCockpit signaal={sig} taken={[]} briefStatus="geen" />);
    await user.click(screen.getByTestId('briefstatus-scroll-knop'));
    expect(scrollSpy).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    document.body.removeChild(host);
  });

  it('briefstatus-klik crasht niet wanneer brieven-sectie ontbreekt', async () => {
    const user = userEvent.setup();
    wrap(<SignaalCockpit signaal={sig} taken={[]} briefStatus="geen" />);
    await user.click(screen.getByTestId('briefstatus-scroll-knop'));
    expect(screen.getByTestId('briefstatus-scroll-knop')).toBeInTheDocument();
  });
});
