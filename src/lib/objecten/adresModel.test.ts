import { describe, expect, it } from 'vitest';
import { resolveObjectAdressen, kanAdresOpKaart, type ObjectAdresRecord } from './adresModel';

const address = (id: string, value: string, hoofd = false): ObjectAdresRecord => ({
  id, objectId: 'object', adres: value, postcode: '1211 AB',
  plaats: 'Hilversum', isHoofdadres: hoofd,
});
describe('Toekomstig multi-adresmodel — read-only en backwards compatible', () => {
  it('laat bestaande dossieradressen intact zolang er geen gekoppelde adressen zijn', () => {
    const legacy = { id: 'object', adres: 'Geuzenweg 22A', plaats: 'Hilversum' };
    const result = resolveObjectAdressen(legacy);
    expect(result.bron).toBe('legacy');
    expect(result.adressen).toHaveLength(1);
    expect(result.hoofdadres?.adres).toBe('Geuzenweg 22A');
    expect(legacy.adres).toBe('Geuzenweg 22A');
  });
  it('kan Geuzenweg 22A en 22B onder één object tonen', () => {
    const result = resolveObjectAdressen({ id: 'object', adres: 'Geuzenweg 22A', plaats: 'Hilversum' },
      [address('a', 'Geuzenweg 22A', true), address('b', 'Geuzenweg 22B')]);
    expect(result.bron).toBe('gekoppeld');
    expect(result.adressen.map(a => a.adres)).toEqual(['Geuzenweg 22A', 'Geuzenweg 22B']);
    expect(result.hoofdadres?.id).toBe('a');
    expect(result.controlepunten).toEqual([]);
  });
  it('geeft drie Amsterdamse adressen weer zonder drie objectrecords te vereisen', () => {
    const a1={ ...address('a', 'Straat 1', true), plaats: 'Amsterdam' };
    const a2={ ...address('b', 'Straat 3'), plaats: 'Amsterdam' };
    const a3={ ...address('c', 'Straat 5'), plaats: 'Amsterdam' };
    const result = resolveObjectAdressen({ id: 'object' }, [a1,a2,a3]);
    expect(result.adressen).toHaveLength(3);
    expect(result.hoofdadres?.id).toBe('a');
  });
  it('vraagt controle bij ongeldige hoofdadressen, dubbelen en object-kruisverwijzingen', () => {
    const result = resolveObjectAdressen({ id: 'object' }, [
      address('a','Geuzenweg 22A',true), address('b','Geuzenweg 22A',true),
      { ...address('x','Andere straat 8'), objectId: 'ander-object' },
    ]);
    expect(result.bron).toBe('gekoppeld');
    expect(result.hoofdadres).toBeNull();
    expect(result.controlepunten.join(' ')).toMatch(/precies één/);
    expect(result.controlepunten.join(' ')).toMatch(/dubbel/i);
    expect(result.controlepunten.join(' ')).toMatch(/ander object/);
  });
  it('kan geen kaartlink voor een adres zonder echte locatie voorbereiden', () => {
    expect(kanAdresOpKaart(address('a','Straat 1'))).toBe(true);
    expect(kanAdresOpKaart({adres:'',plaats:'Amsterdam'})).toBe(false);
    expect(kanAdresOpKaart({adres:'Straat 1',plaats:null})).toBe(false);
  });
});
