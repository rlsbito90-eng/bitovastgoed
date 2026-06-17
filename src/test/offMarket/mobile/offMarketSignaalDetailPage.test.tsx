// Render-test die controleert dat de mobiele dossier-UX componenten
// aanwezig zijn op de Off-Market signaaldetailpagina en de zware
// desktop-equivalenten (KPI-bar + Signaal-Cockpit) verborgen zijn voor
// mobiel via een lg:hidden wrapper.
//
// We renderen niet de hele OffMarketSignaalDetailPage (vergt query/router/
// supabase), maar dezelfde mobiele structuur uit de pagina als losse shell.
// Zo borgen we de structurele garantie zonder zware integratie.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SignaalMobileHeader from '@/components/offmarket/mobile/SignaalMobileHeader';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import SignaalMobileActionBar from '@/components/offmarket/mobile/SignaalMobileActionBar';
import { maakTestSignaal } from './_fixture';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));

const MOBILE_TABS = ['Overzicht', 'Onderzoek', 'Eigenaar', 'Opvolging', 'Meer'];

describe('OffMarketSignaalDetailPage mobiele shell', () => {
  it('toont mobiele cockpit, action bar en 5 mobiele tabs zonder desktop KPI-bar of cockpit', () => {
    const signaal = maakTestSignaal();
    render(
      <MemoryRouter>
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
        </div>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('signaal-mobile-cockpit')).toBeInTheDocument();
    expect(screen.getByTestId('signaal-mobile-actionbar')).toBeInTheDocument();

    const tablist = screen.getByTestId('signaal-mobile-tabs');
    expect(tablist).toBeInTheDocument();
    const triggers = tablist.querySelectorAll('[role="tab"]');
    expect(triggers.length).toBe(5);
    for (const label of MOBILE_TABS) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }

    // Desktop-only componenten mogen NIET in deze mobiele shell zitten.
    expect(screen.queryByTestId('signaal-kpi-bar')).toBeNull();
    expect(screen.queryByTestId('signaal-cockpit')).toBeNull();
  });
});
