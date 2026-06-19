// V2.4 — Merge pandid-context en exact postcode+huisnummer-context.
import { describe, it, expect } from 'vitest';
import { mergeBagContext } from '@/lib/offMarket/bag/contextMerge';

describe('mergeBagContext — pandid + exact-house merge', () => {
  it('merget en dedupe op vbo_id; voegt 330-1 toe vanuit huisnummercontext', () => {
    const selected = { vbo_id: 'v2', nummeraanduiding_id: 'n2', pandid: 'p1', adres: 'Govert Flinckstraat 330-2' };
    const pandidVbos = [
      { vbo_id: 'v2', nummeraanduiding_id: 'n2', adres: 'Govert Flinckstraat 330-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik', pandid: 'p1' },
    ];
    const huisnummerVbos = [
      { vbo_id: 'v1', nummeraanduiding_id: 'n1', adres: 'Govert Flinckstraat 330-1', opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: 'In gebruik', pandid: 'p1' },
      { vbo_id: 'v2', nummeraanduiding_id: 'n2', adres: 'Govert Flinckstraat 330-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: 'In gebruik', pandid: 'p1' },
    ];
    const res = mergeBagContext({ pandidVbos, huisnummerVbos, selected });
    expect(res.vbos).toHaveLength(2);
    expect(res.vbos[0].is_doelobject).toBe(true);
    expect(res.vbos[0].match_badge).toMatch(/MATCH/);
    expect(res.vbos[1].is_doelobject).toBe(false);
    // Pandid gelijk → "Zelfde BAG-pand"
    expect(res.vbos[1].match_badge).toMatch(/Zelfde BAG-pand/);
    expect(res.bron).toBe('gemengd');
  });

  it('zonder pandid-overlap markeert overige als "Zelfde huisnummercontext"', () => {
    const selected = { vbo_id: 'v2', nummeraanduiding_id: 'n2', pandid: null, adres: 'Govert Flinckstraat 330-2' };
    const res = mergeBagContext({
      pandidVbos: [],
      huisnummerVbos: [
        { vbo_id: 'v1', nummeraanduiding_id: 'n1', adres: 'Govert Flinckstraat 330-1', opp_m2: 56, gebruiksdoel: ['woonfunctie'], status: null, pandid: null },
        { vbo_id: 'v2', nummeraanduiding_id: 'n2', adres: 'Govert Flinckstraat 330-2', opp_m2: 47, gebruiksdoel: ['woonfunctie'], status: null, pandid: null },
      ],
      selected,
    });
    expect(res.vbos).toHaveLength(2);
    expect(res.bron).toBe('huisnummer');
    const ander = res.vbos.find((v) => !v.is_doelobject)!;
    expect(ander.match_badge).toMatch(/Zelfde huisnummercontext/);
  });
});
