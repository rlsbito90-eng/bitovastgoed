// V2.4 — BagVboLijst toont alle VBO's in BAG-pandcontext (Govert-Flinck-achtige fixture).
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  { nummeraanduiding_id: 'n1', vbo_id: 'v-330-1', adres: 'Govert Flinckstraat 330-1', opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'In gebruik' },
  { nummeraanduiding_id: 'n2', vbo_id: 'v-330-2', adres: 'Govert Flinckstraat 330-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik' },
];

describe('BagVboLijst — alle VBO\'s zichtbaar', () => {
  it('toont beide VBO\'s (56 m² + 47 m² = 103 m²)', () => {
    const { getAllByTestId } = render(<BagVboLijst vbos={vbos} geselecteerdVboId="v-330-1" />);
    const items = getAllByTestId('bag-vbo-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/330-1/);
    expect(items[0].textContent).toMatch(/56 m²/);
    expect(items[1].textContent).toMatch(/330-2/);
    expect(items[1].textContent).toMatch(/47 m²/);
  });

  it('markeert het gekozen doelobject', () => {
    const { getAllByTestId } = render(<BagVboLijst vbos={vbos} geselecteerdVboId="v-330-1" />);
    const items = getAllByTestId('bag-vbo-item');
    expect(items[0].getAttribute('data-gekozen')).toBe('true');
    expect(items[1].getAttribute('data-gekozen')).toBe('false');
  });

  it('toont "+N meer" wanneer meer dan maxItems VBO\'s', () => {
    const veel: BagVbo[] = Array.from({ length: 7 }, (_, i) => ({
      nummeraanduiding_id: `n${i}`,
      vbo_id: `v${i}`,
      adres: `Demostraat ${i}`,
      opp_m2: 50,
      gebruiksdoel: ['woonfunctie'],
      status: 'In gebruik',
    }));
    const { getAllByTestId, getByTestId } = render(<BagVboLijst vbos={veel} maxItems={5} />);
    expect(getAllByTestId('bag-vbo-item')).toHaveLength(5);
    expect(getByTestId('bag-vbo-meer-indicator').textContent).toMatch(/\+ 2 meer/);
  });
});
