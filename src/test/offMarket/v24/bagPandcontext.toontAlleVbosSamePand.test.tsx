// V2.4 — BagVboLijst toont alle VBO's in dezelfde BAG-pandcontext incl. MATCH-badge.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  {
    nummeraanduiding_id: 'n1', vbo_id: 'v1',
    adres: 'Govert Flinckstraat 330-1, 1074CE Amsterdam',
    opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'In gebruik',
    is_doelobject: true, match_badge: 'MATCH · Doelobject',
  },
  {
    nummeraanduiding_id: 'n2', vbo_id: 'v2',
    adres: 'Govert Flinckstraat 330-2, 1074CE Amsterdam',
    opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik',
    is_doelobject: false, match_badge: 'Zelfde BAG-pand',
  },
];

describe('BAG-pandcontext — alle VBOs zichtbaar', () => {
  it('toont beide VBOs met juiste badges', () => {
    const { getAllByTestId, queryByTestId } = render(
      <BagVboLijst vbos={vbos} geselecteerdVboId="v1" />,
    );
    const items = getAllByTestId('bag-vbo-item');
    expect(items).toHaveLength(2);
    // Doelobject eerst (sortering)
    expect(items[0].getAttribute('data-doelobject')).toBe('true');
    expect(items[0].textContent).toMatch(/330-1/);
    expect(items[0].textContent).toMatch(/MATCH/i);
    expect(items[0].textContent).toMatch(/56 m²/);
    expect(items[1].getAttribute('data-doelobject')).toBe('false');
    expect(items[1].textContent).toMatch(/330-2/);
    expect(items[1].textContent?.toLowerCase()).toMatch(/zelfde bag-pand/);
    expect(items[1].textContent).toMatch(/47 m²/);
    expect(queryByTestId('bag-vbo-lijst-leeg')).toBeNull();
  });
});
