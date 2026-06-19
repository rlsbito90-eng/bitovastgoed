// V2.4 fix — VBO-ID en Pand-ID worden volledig getoond, zonder ellipsis.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  {
    nummeraanduiding_id: 'NA_FULL_001', vbo_id: '0363010000649405',
    adres: 'Teststraat 10-2',
    opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'Verblijfsobject in gebruik',
    pandid: '0363100012162738', pand_bouwjaar: 1881, pand_status: 'Pand in gebruik',
    is_doelobject: true,
  },
];

describe('BagVboLijst — volledige BAG-IDs', () => {
  it('toont VBO-ID en Pand-ID volledig, zonder ellipsis', () => {
    const { getByTestId } = render(
      <BagVboLijst vbos={vbos} geselecteerdVboId="0363010000649405" />,
    );
    const vboEl = getByTestId('bag-vbo-vboid');
    const pandEl = getByTestId('bag-vbo-pandid');
    expect(vboEl.textContent).toBe('0363010000649405');
    expect(pandEl.textContent).toBe('0363100012162738');
    expect(vboEl.textContent).not.toMatch(/…|\.\.\./);
    expect(pandEl.textContent).not.toMatch(/…|\.\.\./);
  });
});
