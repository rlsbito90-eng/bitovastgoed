// V2.5 — BagOverzichtKaart: Kadaster-knop disabled bij meerdere_matches,
// adviesbadge en adviesblok verborgen; blokkade-tekst zichtbaar.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function fixt(bag_status: string): OffMarketSignaal {
  return {
    id: 's1',
    titel: 'Testpand 44-H',
    adres: 'Teststraat 44-H',
    postcode: null,
    ai_status: 'klaar',
    ai_score: 75,
    bag_status,
    bag_match_kwaliteit: bag_status === 'verrijkt' ? 'exact' : 'onzeker',
    bag_aantal_vbo: 3,
    bag_aantal_panden: 1,
    bag_totaal_oppervlakte_m2: 180,
    bag_gebruiksdoelen: ['woonfunctie'],
    bag_pandcontext_aantal_vbo: 3,
    bag_pandcontext_totaal_opp_m2: 180,
    bag_match_kandidaten: bag_status === 'meerdere_matches'
      ? [
          {
            adres: 'Teststraat 44-H',
            vbo_id: 'v44h',
            nummeraanduiding_id: 'n44h',
            huisnummer: '44',
            huisnummertoevoeging: 'H',
            match_type: 'zelfde_huisnummer',
          },
        ]
      : null,
  } as unknown as OffMarketSignaal;
}

describe('V2.5 BagOverzichtKaart — Kadaster/advies gating', () => {
  it('bij meerdere_matches: knop disabled, advies verborgen, blokkade-tekst zichtbaar', async () => {
    const onOpen = vi.fn();
    const { getByTestId, queryByTestId } = wrap(
      <BagOverzichtKaart signaal={fixt('meerdere_matches')} onOpenKadaster={onOpen} />,
    );
    const knop = getByTestId('kadaster-ophalen-knop') as HTMLButtonElement;
    expect(knop).toBeDisabled();
    expect(knop.getAttribute('title') ?? '').toMatch(/BAG-match/i);
    expect(queryByTestId('kadasteradvies-badge')).toBeNull();
    expect(queryByTestId('bag-advies-reden')).toBeNull();
    expect(getByTestId('bag-advies-blokkade').textContent).toMatch(/Kadasteradvies/i);

    const user = userEvent.setup();
    await user.click(knop).catch(() => {});
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('bij verrijkt: knop enabled en advies zichtbaar', async () => {
    const onOpen = vi.fn();
    const { getByTestId, queryByTestId } = wrap(
      <BagOverzichtKaart signaal={fixt('verrijkt')} onOpenKadaster={onOpen} />,
    );
    const knop = getByTestId('kadaster-ophalen-knop') as HTMLButtonElement;
    expect(knop).not.toBeDisabled();
    expect(queryByTestId('bag-advies-blokkade')).toBeNull();
    const user = userEvent.setup();
    await user.click(knop);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
