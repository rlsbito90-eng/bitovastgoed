// V2.4 — Banner toont waarschuwing bij onzekere match; Kadasterknop niet geblokkeerd.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import KadasterPreCheckBanner from '@/components/offmarket/bag/KadasterPreCheckBanner';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: () => ({}) },
}));

function s(extra: Record<string, unknown> = {}): OffMarketSignaal {
  return {
    id: 's1', titel: 't',
    ai_status: 'klaar', ai_score: 80,
    bag_status: 'meerdere_matches',
    bag_match_kwaliteit: 'onzeker',
    ...extra,
  } as unknown as OffMarketSignaal;
}

describe('KadasterPreCheckBanner — waarschuwing', () => {
  it('toont waarschuwingsblok bij onzekere/meerdere match', () => {
    const { getByTestId } = render(<KadasterPreCheckBanner signaal={s()} />);
    const w = getByTestId('precheck-onzeker-waarschuwing');
    expect(w).toBeInTheDocument();
    expect(w.textContent?.toLowerCase()).toMatch(/onzeker|kies eerst/);
  });

  it('toont pandcontext + doelobject bij verrijkt', () => {
    const { getByTestId } = render(<KadasterPreCheckBanner signaal={s({
      bag_status: 'verrijkt',
      bag_match_kwaliteit: 'exact',
      bag_pandcontext_aantal_vbo: 2,
      bag_pandcontext_totaal_opp_m2: 103,
      bag_gebruiksdoelen: ['woonfunctie'],
      bag_geselecteerd_adres: 'Govert Flinckstraat 330-1',
      bag_geselecteerd_opp_m2: 56,
    })} />);
    expect(getByTestId('precheck-bag-cijfers').textContent).toMatch(/2 VBO/);
    expect(getByTestId('precheck-bag-cijfers').textContent).toMatch(/103/);
    expect(getByTestId('precheck-doelobject').textContent).toMatch(/330-1/);
  });
});
