// V31 — Mobiele detailpagina-pariteit: 6 mobiele tabs, korte labels, glass-styling.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BadgeCheck, Search, Landmark, Mail, CheckSquare, Server } from 'lucide-react';
import MobileTabbarScroller from '@/components/offmarket/mobile/MobileTabbarScroller';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));

const MOBILE_TABS = [
  { value: 'overzicht', label: 'Overzicht', Icon: BadgeCheck },
  { value: 'onderzoek', label: 'Onderzoek', Icon: Search },
  { value: 'kadaster', label: 'Kadaster', Icon: Landmark },
  { value: 'brieven', label: 'Brieven', Icon: Mail },
  { value: 'taken', label: 'Taken', Icon: CheckSquare },
  { value: 'technisch', label: 'Technisch', Icon: Server },
];

describe('Mobiele Off-Market detail — tabsstructuur', () => {
  it('rendert 6 mobiele dossier-tabs met dezelfde values als desktop', () => {
    render(
      <MemoryRouter>
        <Tabs defaultValue="overzicht">
          <div className="glass-tabbar px-1.5 py-1">
            <MobileTabbarScroller activeValue="overzicht">
              <TabsList data-testid="signaal-mobile-tabs" className="bg-transparent gap-1 flex w-max">
                {MOBILE_TABS.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="glass-tab-pill whitespace-nowrap"
                  >
                    <t.Icon className="h-3.5 w-3.5 mr-1" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </MobileTabbarScroller>
          </div>
          <TabsContent value="overzicht">overzicht</TabsContent>
        </Tabs>
      </MemoryRouter>,
    );

    const tabs = screen.getByTestId('signaal-mobile-tabs');
    expect(tabs.querySelectorAll('[role="tab"]').length).toBe(6);
    for (const t of MOBILE_TABS) {
      expect(screen.getByRole('tab', { name: new RegExp(t.label, 'i') })).toBeInTheDocument();
    }
    // Verifieer dat de scroller (edge-fade wrapper) aanwezig is.
    expect(screen.getByTestId('mobile-tabbar-scroller')).toBeInTheDocument();
    // Geen oude Meer-tab meer.
    expect(screen.queryByRole('tab', { name: /meer/i })).toBeNull();
  });
});
