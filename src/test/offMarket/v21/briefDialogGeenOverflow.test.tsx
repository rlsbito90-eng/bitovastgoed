// V2.1 — BriefVoorbereidenDialog footer heeft wrap-class i.p.v. nowrap-only,
// zodat knoppen niet horizontaal scrollen.
// We testen alleen het styling-contract (className), niet de browser layout.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
    }),
  },
}));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ addTaak: vi.fn(), taken: [], getRelatieById: () => null }),
}));

import BriefVoorbereidenDialog from '@/components/offmarket/BriefVoorbereidenDialog';

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const signaal: any = {
  id: 's1', titel: 'X', status: 'nieuw_signaal', prioriteit: 'midden',
  assettype: 'wonen', signaaltype: 'overig',
};

describe('BriefVoorbereidenDialog footer — geen horizontale scroll', () => {
  it('actiebalk heeft flex-wrap class en sticky bottom', () => {
    render(wrap(
      <BriefVoorbereidenDialog
        open={true}
        onOpenChange={() => {}}
        signaal={signaal}
        kadasterRecords={[]}
        historischeBrieven={[]}
      />,
    ));
    const footer = document.body.querySelector('[data-modal-action-bar]') as HTMLElement | null;
    expect(footer).not.toBeNull();
    expect(footer!.className).toMatch(/flex-wrap/);
    expect(footer!.className).toMatch(/sticky/);
    expect(footer!.className).toMatch(/bottom-0/);
    expect(footer!.className).not.toMatch(/overflow-x-auto/);
  });
});

