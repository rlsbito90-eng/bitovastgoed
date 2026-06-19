// V2.4 — BagVboLijst toont "Zelfde huisnummercontext"-badge naast MATCH.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  {
    nummeraanduiding_id: 'n2', vbo_id: 'v2',
    adres: 'Govert Flinckstraat 330-2, 1074CE Amsterdam',
    opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik',
    is_doelobject: true, match_badge: 'MATCH · Doelobject',
  },
  {
    nummeraanduiding_id: 'n1', vbo_id: 'v1',
    adres: 'Govert Flinckstraat 330-1, 1074CE Amsterdam',
    opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'In gebruik',
    is_doelobject: false, match_badge: 'Zelfde huisnummercontext',
  },
];

describe('BagVboLijst — huisnummercontext-badge', () => {
  it('toont MATCH op gekozen VBO en huisnummercontext op andere', () => {
    const { getAllByTestId } = render(<BagVboLijst vbos={vbos} geselecteerdVboId="v2" />);
    const items = getAllByTestId('bag-vbo-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/MATCH/i);
    expect(items[1].textContent?.toLowerCase()).toMatch(/zelfde huisnummercontext/);
  });
});
