// V2.4 — Govert Flinck adrescontext fixture: 56 + 47 = 103 m², 2 VBO's.
import { describe, it, expect } from 'vitest';
import { mergeBagContext } from '@/lib/offMarket/bag/contextMerge';

describe('mergeBagContext — Govert Flinck adrescontext', () => {
  it('telt 2 VBOs en 103 m² totaal', () => {
    const res = mergeBagContext({
      pandidVbos: [],
      huisnummerVbos: [
        { vbo_id: 'v1', nummeraanduiding_id: 'n1', adres: 'Govert Flinckstraat 330-1, 1074CE Amsterdam', opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'In gebruik', pandid: 'p1' },
        { vbo_id: 'v2', nummeraanduiding_id: 'n2', adres: 'Govert Flinckstraat 330-2, 1074CE Amsterdam', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik', pandid: 'p1' },
      ],
      selected: { vbo_id: 'v2', nummeraanduiding_id: 'n2', pandid: 'p1', adres: 'Govert Flinckstraat 330-2' },
    });
    expect(res.aantal).toBe(2);
    expect(res.totaalOpp).toBe(103);
    const doel = res.vbos.find((v) => v.is_doelobject)!;
    expect(doel.adres).toMatch(/330-2/);
    expect(doel.match_badge).toMatch(/MATCH/);
    const ander = res.vbos.find((v) => !v.is_doelobject)!;
    expect(ander.adres).toMatch(/330-1/);
    expect(ander.match_badge).toMatch(/Zelfde BAG-pand|Zelfde huisnummercontext/);
    expect(res.gebruiksdoelen).toContain('woonfunctie');
  });
});
