import { describe, expect, it } from 'vitest';
import {
  bepaalPrintPostGroep,
  isPrintPostFilter,
  matchtPrintPostFilter,
} from './printPostFilter';

describe('printPostFilter', () => {
  it('plaatst gereed voor print in Te printen', () => {
    expect(bepaalPrintPostGroep('gereed_voor_print')).toBe('te_printen');
    expect(matchtPrintPostFilter('gereed_voor_print', 'te_printen')).toBe(true);
    expect(matchtPrintPostFilter('gereed_voor_print', 'te_posten')).toBe(false);
  });

  it('plaatst geprint maar nog niet gepost in Te posten', () => {
    expect(bepaalPrintPostGroep('geprint_nog_posten')).toBe('te_posten');
    expect(matchtPrintPostFilter('geprint_nog_posten', 'te_posten')).toBe(true);
    expect(matchtPrintPostFilter('geprint_nog_posten', 'te_printen')).toBe(false);
  });

  it('laat Alles beide print/postgroepen tonen', () => {
    expect(matchtPrintPostFilter('gereed_voor_print', 'alles')).toBe(true);
    expect(matchtPrintPostFilter('geprint_nog_posten', 'alles')).toBe(true);
  });

  it('sluit niet-print/postcategorieën uit', () => {
    expect(bepaalPrintPostGroep('onderzoek')).toBeNull();
    expect(matchtPrintPostFilter('onderzoek', 'alles')).toBe(false);
    expect(matchtPrintPostFilter(null, 'alles')).toBe(false);
  });

  it('valideert uitsluitend bekende filters', () => {
    expect(isPrintPostFilter('alles')).toBe(true);
    expect(isPrintPostFilter('te_printen')).toBe(true);
    expect(isPrintPostFilter('te_posten')).toBe(true);
    expect(isPrintPostFilter('printen')).toBe(false);
    expect(isPrintPostFilter(null)).toBe(false);
  });
});
