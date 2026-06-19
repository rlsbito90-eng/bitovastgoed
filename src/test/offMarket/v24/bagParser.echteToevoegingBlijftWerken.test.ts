// V2.4 — echte toevoegingen/huisletters blijven werken.
import { describe, it, expect } from 'vitest';
import { parseSignaalAdres } from '@/lib/offMarket/bag/validateDoelobject';

describe('parseSignaalAdres — echte toevoeging blijft werken', () => {
  it('Apollolaan 33-H Amsterdam → letter H', () => {
    const p = parseSignaalAdres({ adres: 'Apollolaan 33-H Amsterdam', titel: null, postcode: null });
    expect(p.huisnummer).toBe('33');
    expect(p.huisletter).toBe('H');
  });
  it('Apollolaan 33H Amsterdam → letter H (glued)', () => {
    const p = parseSignaalAdres({ adres: 'Apollolaan 33H Amsterdam', titel: null, postcode: null });
    expect(p.huisnummer).toBe('33');
    expect(p.huisletter).toBe('H');
  });
  it('Apollolaan 33-1 Amsterdam → toevoeging 1', () => {
    const p = parseSignaalAdres({ adres: 'Apollolaan 33-1 Amsterdam', titel: null, postcode: null });
    expect(p.huisnummer).toBe('33');
    expect(p.toevoeging).toBe('1');
  });
  it('Taksteeg 11-3A Amsterdam → toevoeging 3A', () => {
    const p = parseSignaalAdres({ adres: 'Taksteeg 11-3A Amsterdam', titel: null, postcode: null });
    expect(p.huisnummer).toBe('11');
    expect(p.toevoeging).toBe('3A');
  });
  it('Govert Flinckstraat 330-1 Amsterdam → toevoeging 1', () => {
    const p = parseSignaalAdres({ adres: 'Govert Flinckstraat 330-1 Amsterdam', titel: null, postcode: null });
    expect(p.huisnummer).toBe('330');
    expect(p.toevoeging).toBe('1');
  });
});
