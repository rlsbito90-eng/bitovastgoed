// V2.4 — BagVboLijst toont per VBO gebruiksdoel, oppervlakte, VBO-ID, Pand-ID, bouwjaar en pandstatus.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  {
    nummeraanduiding_id: 'NA_FAKE_001', vbo_id: 'VBO_FAKE_DOEL',
    adres: 'Teststraat 10-2, 1000AA Teststad',
    opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'Verblijfsobject in gebruik',
    pandid: 'PAND_FAKE_001', pand_bouwjaar: 1881, pand_status: 'Pand in gebruik',
    is_doelobject: true, match_badge: 'MATCH · Doelobject',
  },
  {
    nummeraanduiding_id: 'NA_FAKE_002', vbo_id: 'VBO_FAKE_OTHER',
    adres: 'Teststraat 10-1, 1000AA Teststad',
    opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'Verblijfsobject in gebruik',
    pandid: 'PAND_FAKE_001', pand_bouwjaar: 1881, pand_status: 'Pand in gebruik',
    is_doelobject: false, match_badge: 'Zelfde huisnummercontext',
  },
];

describe('BagVboLijst — toont BAG-detailinformatie', () => {
  it('rendert gebruiksdoel, oppervlakte, VBO-ID, pand-ID, bouwjaar en pandstatus', () => {
    const { getAllByTestId } = render(<BagVboLijst vbos={vbos} geselecteerdVboId="VBO_FAKE_DOEL" />);
    const items = getAllByTestId('bag-vbo-item');
    expect(items).toHaveLength(2);

    const doel = items[0];
    expect(doel.textContent).toMatch(/Woonfunctie/);
    expect(doel.textContent).toMatch(/47 m²/);
    expect(doel.textContent).toMatch(/1881/);
    expect(doel.textContent).toMatch(/Pand in gebruik/);
    // VBO-ID en Pand-ID worden verkort weergegeven (volledige id in title-attr).
    const vboIdEl = doel.querySelector('[data-testid="bag-vbo-vboid"]') as HTMLElement;
    expect(vboIdEl?.getAttribute('title')).toBe('VBO_FAKE_DOEL');
    const pandIdEl = doel.querySelector('[data-testid="bag-vbo-pandid"]') as HTMLElement;
    expect(pandIdEl?.getAttribute('title')).toBe('PAND_FAKE_001');

    const ander = items[1];
    expect(ander.textContent).toMatch(/56 m²/);
    expect(ander.textContent).toMatch(/Woonfunctie/);
  });
});
