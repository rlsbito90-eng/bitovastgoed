// Render-test die controleert dat de mobiele dossier-UX componenten
// aanwezig zijn op de Off-Market signaaldetailpagina en de zware
// desktop-equivalenten (KPI-bar + Signaal-Cockpit) verborgen zijn voor
// mobiel via een lg:hidden wrapper.
//
// V31 — mobiele tabs zijn nu 1-op-1 met desktop (6 dossier-tabs).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SignaalMobileHeader from '@/components/offmarket/mobile/SignaalMobileHeader';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import SignaalMobileActionBar from '@/components/offmarket/mobile/SignaalMobileActionBar';
import { maakTestSignaal } from './_fixture';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const MOBILE_TABS = ['Overzicht', 'Onderzoek', 'Kadaster', 'Brieven', 'Taken', 'Technisch'];

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OffMarketSignaalDetailPage mobiele shell', () => {
  it('toont mobiele cockpit, action bar en 6 mobiele tabs zonder desktop KPI-bar of cockpit', () => {
    const signaal = maakTestSignaal();
    render(
      wrap(
        <div className="lg:hidden space-y-3">
          <SignaalMobileHeader signaal={signaal} onEdit={() => {}} onArchive={() => {}} />
          <SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />
          <SignaalMobileActionBar signaal={signaal} />
          <Tabs defaultValue="overzicht">
            <TabsList data-testid="signaal-mobile-tabs">
              {MOBILE_TABS.map((label) => (
                <TabsTrigger key={label} value={label.toLowerCase()}>{label}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overzicht">overzicht-inhoud</TabsContent>
          </Tabs>
        </div>,
      ),
    );

    expect(screen.getByTestId('signaal-mobile-cockpit')).toBeInTheDocument();
    expect(screen.getByTestId('signaal-mobile-actionbar')).toBeInTheDocument();

    const tablist = screen.getByTestId('signaal-mobile-tabs');
    const triggers = tablist.querySelectorAll('[role="tab"]');
    expect(triggers.length).toBe(6);
    for (const label of MOBILE_TABS) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }

    expect(screen.queryByTestId('signaal-kpi-bar')).toBeNull();
    expect(screen.queryByTestId('signaal-cockpit')).toBeNull();
  });
});
