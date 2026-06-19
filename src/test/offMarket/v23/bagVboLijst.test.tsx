// V2.3 — BagVboLijst rendert meerdere VBO's met oppervlak en gebruiksdoel.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  {
    nummeraanduiding_id: '0000200000000001',
    vbo_id: '0000010000000001',
    adres: 'Demostraat 12-A 1000 AA Voorbeeldstad',
    opp_m2: 52,
    gebruiksdoel: ['woonfunctie'],
    status: 'Verblijfsobject in gebruik',
  },
  {
    nummeraanduiding_id: '0000200000000002',
    vbo_id: '0000010000000002',
    adres: 'Demostraat 12-B 1000 AA Voorbeeldstad',
    opp_m2: 49,
    gebruiksdoel: ['woonfunctie'],
    status: 'Verblijfsobject in gebruik',
  },
];

describe('BagVboLijst', () => {
  it('toont leeg-melding zonder VBO\'s', () => {
    const { getByTestId } = render(<BagVboLijst vbos={[]} />);
    expect(getByTestId('bag-vbo-lijst-leeg')).toBeInTheDocument();
  });

  it('toont meerdere VBO\'s met oppervlak en gebruiksdoel', () => {
    const { getAllByTestId, getByText } = render(<BagVboLijst vbos={vbos} />);
    expect(getAllByTestId('bag-vbo-item')).toHaveLength(2);
    expect(getByText('52 m²')).toBeInTheDocument();
    expect(getByText('49 m²')).toBeInTheDocument();
  });
});
