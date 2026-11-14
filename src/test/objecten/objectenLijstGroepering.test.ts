import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { groepeerObjectenLijst, zoektInPortefeuilleOnderdelen, indexeerPortefeuilleOnderdelen } from '@/lib/objecten/objectenLijstGroepering';

const item = (id: string, extra: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id, titel: id, plaats: 'Amsterdam', isPortefeuille: false,
  parentObjectId: undefined, ...extra,
} as ObjectVastgoed);

const root = item('root', { isPortefeuille: true, titel: 'Portefeuille drie appartementen' });
const a = item('a', { parentObjectId: 'root', adres: 'Eerste Straat 2' });
const b = item('b', { parentObjectId: 'root', adres: 'Tweede Straat 4', postcode: '1017 AB' });
const c = item('c', { parentObjectId: 'root', adres: 'Derde Straat 6' });

describe('Portfolio-structuur in Objectenlijst', () => {
  it('groepeert kinderen alleen wanneer de parent zichtbaar is', () => {
    expect(groepeerObjectenLijst([root,a,b,c], false).map(o=>o.id)).toEqual(['root']);
    expect(groepeerObjectenLijst([a,b], false).map(o=>o.id)).toEqual(['a','b']);
  });
  it('laat alle rijen zien wanneer de gebruiker dit kiest', () => {
    expect(groepeerObjectenLijst([root,a,b,c], true).map(o=>o.id)).toEqual(['root','a','b','c']);
  });
  it('vindt hoofddossier via adres of postcode van een kind', () => {
    const index=indexeerPortefeuilleOnderdelen([root,a,b,c]);
    expect(zoektInPortefeuilleOnderdelen(root, index.get('root')??[], 'Tweede Straat 4')).toBe(true);
    expect(zoektInPortefeuilleOnderdelen(root, index.get('root')??[], '1017AB')).toBe(true);
    expect(zoektInPortefeuilleOnderdelen(root, index.get('root')??[], 'Niet bestaand')).toBe(false);
  });
  it('leest bestaande gegevens zonder prijzen of koppelingen te veranderen', () => {
    const index=indexeerPortefeuilleOnderdelen([root,a,b,c]);
    expect(index.get('root')?.map(o=>o.id)).toEqual(['a','b','c']);
    expect(a.parentObjectId).toBe('root');
    expect(a.vraagprijs).toBeUndefined();
  });
});
