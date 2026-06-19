// V2.3 — KadasterPreCheckBanner toont BAG-cijfers, advies + reden.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import KadasterPreCheckBanner from '@/components/offmarket/bag/KadasterPreCheckBanner';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

// Geen externe queries nodig voor render — supabase niet aangeroepen.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

function fakeSignaal(extra: Partial<Record<string, unknown>> = {}): OffMarketSignaal {
  return {
    id: 's1',
    titel: 'Voorbeeldpand',
    ai_status: 'klaar', ai_score: 75,
    bag_status: 'verrijkt',
    bag_aantal_vbo: 2,
    bag_totaal_oppervlakte_m2: 101,
    bag_gebruiksdoelen: ['woonfunctie'],
    bag_match_kwaliteit: 'exact',
    potentiele_strategie: 'Splitsingspotentie',
    ...extra,
  } as unknown as OffMarketSignaal;
}

describe('KadasterPreCheckBanner', () => {
  it('toont BAG-cijfers en advies-reden bij verrijkt signaal', () => {
    const { getByTestId } = render(<KadasterPreCheckBanner signaal={fakeSignaal()} />);
    expect(getByTestId('kadaster-precheck-banner')).toBeInTheDocument();
    expect(getByTestId('precheck-bag-cijfers').textContent).toMatch(/2 VBO/);
    expect(getByTestId('precheck-bag-cijfers').textContent).toMatch(/101 m²/);
    expect(getByTestId('precheck-advies-reden')).toBeInTheDocument();
  });

  it('toont onzeker-waarschuwing bij meerdere matches', () => {
    const { container } = render(
      <KadasterPreCheckBanner signaal={fakeSignaal({ bag_status: 'meerdere_matches' })} />,
    );
    expect(container.textContent).toMatch(/onzeker|controleer/i);
  });

  it('toont muted-melding wanneer BAG niet verrijkt is', () => {
    const { container } = render(
      <KadasterPreCheckBanner signaal={fakeSignaal({ bag_status: 'niet_verrijkt' })} />,
    );
    expect(container.textContent).toMatch(/nog niet beschikbaar|nog niet verrijkt/i);
  });
});
