// V2.4 — Doelobject card heeft theme-safe styling (geen onleesbare lichte fill in dark mode).
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BagVboLijst from '@/components/offmarket/bag/BagVboLijst';
import type { BagVbo } from '@/lib/offMarket/bag/types';

const vbos: BagVbo[] = [
  {
    nummeraanduiding_id: 'n1',
    vbo_id: 'v1',
    adres: 'Govert Flinckstraat 330-1',
    opp_m2: 56,
    gebruiksdoel: ['woonfunctie'],
    status: 'Verblijfsobject in gebruik',
    is_doelobject: true,
    match_badge: 'MATCH · Doelobject',
    pandid: 'p1',
    pand_bouwjaar: 1881,
    pand_status: 'Pand in gebruik',
  },
  {
    nummeraanduiding_id: 'n2',
    vbo_id: 'v2',
    adres: 'Govert Flinckstraat 330-2',
    opp_m2: 47,
    gebruiksdoel: ['woonfunctie'],
    status: 'Verblijfsobject in gebruik',
    is_doelobject: false,
    match_badge: 'Zelfde BAG-pand',
    pandid: 'p1',
  },
];

describe('BagVboLijst — doelobject card dark-mode-contrast', () => {
  it('doelobject card heeft data-variant=doelobject + theme-safe markering', () => {
    const { getAllByTestId } = render(<BagVboLijst vbos={vbos} />);
    const items = getAllByTestId('bag-vbo-item');
    const doel = items.find((el) => el.getAttribute('data-doelobject') === 'true')!;
    expect(doel).toBeDefined();
    expect(doel.getAttribute('data-variant')).toBe('doelobject');
    expect(doel.getAttribute('data-theme-safe')).toBe('true');
  });

  it('doelobject card gebruikt geen grote lichtgroene fill (bg-emerald-50/60)', () => {
    const { getAllByTestId } = render(<BagVboLijst vbos={vbos} />);
    const doel = getAllByTestId('bag-vbo-item').find((el) => el.getAttribute('data-doelobject') === 'true')!;
    const cls = doel.className;
    expect(cls).not.toMatch(/bg-emerald-50\/60/);
    expect(cls).not.toMatch(/bg-emerald-100\b/);
    // moet wel een subtiele emerald accent hebben
    expect(cls).toMatch(/emerald/);
  });

  it('MATCH-badge zichtbaar', () => {
    const { getByTestId } = render(<BagVboLijst vbos={vbos} />);
    expect(getByTestId('bag-vbo-badge-doelobject').textContent).toMatch(/MATCH/);
  });
});
