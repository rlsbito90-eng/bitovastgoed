// V2.3 — BagOverzichtKaart rendert stats, handmatige knoppen en advies-reden.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    })),
  },
}));

function fakeSignaal(extra: Partial<Record<string, unknown>> = {}): OffMarketSignaal {
  return {
    id: 's1',
    titel: 'Voorbeeldpand',
    ai_status: 'klaar', ai_score: 80,
    bag_status: 'verrijkt',
    bag_aantal_vbo: 2,
    bag_aantal_panden: 1,
    bag_totaal_oppervlakte_m2: 220,
    bag_bouwjaar: 1906,
    bag_gebruiksdoelen: ['woonfunctie'],
    bag_match_kwaliteit: 'exact',
    bag_vbos: [
      { nummeraanduiding_id: '1', vbo_id: 'v1', adres: 'Demostraat 12-A', opp_m2: 110, gebruiksdoel: ['woonfunctie'], status: 'In gebruik' },
      { nummeraanduiding_id: '2', vbo_id: 'v2', adres: 'Demostraat 12-B', opp_m2: 110, gebruiksdoel: ['woonfunctie'], status: 'In gebruik' },
    ],
    potentiele_strategie: 'Splitsingspotentie',
    ...extra,
  } as unknown as OffMarketSignaal;
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('BagOverzichtKaart', () => {
  it('toont totaal m², aantal VBO\'s en gebruiksdoelen', () => {
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={fakeSignaal()} />);
    expect(getByTestId('bag-overzicht-kaart')).toBeInTheDocument();
    expect(getByTestId('bag-stat-opp').textContent).toContain('220');
    expect(getByTestId('bag-stat-vbo').textContent).toContain('2');
    expect(getByTestId('bag-gebruiksdoelen').textContent).toMatch(/woonfunctie/);
  });

  it('toont handmatige BAG- en Kadaster-knoppen', () => {
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={fakeSignaal()} />);
    expect(getByTestId('bag-verrijken-knop')).toBeInTheDocument();
    expect(getByTestId('ai-opnieuw-verrijken-knop')).toBeInTheDocument();
    const k = getByTestId('kadaster-ophalen-knop') as HTMLButtonElement;
    expect(k).toBeInTheDocument();
    expect(k.disabled).toBe(false);
  });

  it('toont KadasteradviesBadge', () => {
    const { getByTestId } = wrap(<BagOverzichtKaart signaal={fakeSignaal()} />);
    const badge = getByTestId('kadasteradvies-badge');
    expect(badge.getAttribute('data-niveau')).not.toBe('onbekend');
  });
});
