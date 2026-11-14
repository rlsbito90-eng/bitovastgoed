import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import {
  portefeuilleOnderdelen, beschikbarePortefeuilleOnderdelen, portefeuilleAdresLabel,
} from '@/lib/objecten/portefeuilleOnderdelen';

const obj = (id: string, extra: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id, titel: id, adres: undefined, postcode: undefined, plaats: 'Amsterdam',
  provincie: 'Noord-Holland', type: 'wonen', isPortefeuille: false,
  status: 'beschikbaar', datumToegevoegd: '2026-11-14', anoniem: true,
  exclusief: false, verhuurStatus: 'verhuurd',
  ontwikkelPotentie: false, transformatiePotentie: false, asbestinventarisatieAanwezig: false,
  ...extra,
} as ObjectVastgoed);

describe('Portefeuille en zelfstandig object blijven gescheiden', () => {
  const root = obj('portefeuille', { isPortefeuille: true, vraagprijs: 900000 });
  const a = obj('app-a', { titel: 'A', parentObjectId: root.id, adres: 'Straat 2', huurinkomsten: 12000 });
  const b = obj('app-b', { titel: 'B', parentObjectId: root.id, adres: 'Straat 4' });
  const c = obj('extern', { titel: 'Extern', vraagprijs: 200000 });
  const andereRoot = obj('andere-portefeuille', { isPortefeuille: true });
  const deleted = obj('verwijderd', { softDeletedAt: '2026-11-14', parentObjectId: root.id });
  const objects = [root, a, b, c, andereRoot, deleted];

  it('toont alleen directe, niet-verwijderde onderdelen en sorteert stabiel', () => {
    expect(portefeuilleOnderdelen(objects, root.id).map(o => o.id)).toEqual(['app-a', 'app-b']);
  });
  it('wijzigt objectdata niet en verdeelt geen vraagprijs over onderliggende objecten', () => {
    const linked = portefeuilleOnderdelen(objects, root.id);
    expect(root.vraagprijs).toBe(900000);
    expect(linked.map(o => o.vraagprijs)).toEqual([undefined, undefined]);
    expect(a.huurinkomsten).toBe(12000);
  });
  it('laat uitsluitend ongekoppelde, zelfstandige, actieve objecten koppelen', () => {
    expect(beschikbarePortefeuilleOnderdelen(objects, root.id).map(o => o.id)).toEqual(['extern']);
  });
  it('behoudt afzonderlijke adressen voor doorklikken naar Maps', () => {
    expect(portefeuilleAdresLabel(a)).toBe('Straat 2, Amsterdam');
    expect(portefeuilleAdresLabel(obj('zonder-adres', { plaats: '', publiekeRegio: 'Randstad' }))).toBe('Randstad');
  });
});
