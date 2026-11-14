import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import {
  portefeuilleOnderdelen, beschikbarePortefeuilleOnderdelen, portefeuilleAdresLabel,
  inventariseerPortefeuilleOnderdelen, individueleOppervlakte,
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

describe('Automatische portefeuille-inventarisatie zonder extra invoer',()=>{
  const root = obj('pakket', {isPortefeuille:true, vraagprijs:900000, huurinkomsten: 30000});
  const a = obj('a', {parentObjectId:root.id,adres:'Geuzenweg 22A',oppervlakteGbo:75,huurinkomsten:12500});
  const b = obj('b', {parentObjectId:root.id,adres:'Geuzenweg 22B',oppervlakteGbo:64,huurinkomsten:14000});
  it('hergebruikt alle bestaande oppervlaktes op dezelfde meetbasis, zonder pakketprijs te verdelen',()=>{
    const items=portefeuilleOnderdelen([root,a,b],root.id);
    const summary=inventariseerPortefeuilleOnderdelen(items);
    expect(summary).toMatchObject({aantal:2,metVolledigAdres:2,metJaarhuur:2,metEigenPrijs:0});
    expect(summary.oppervlakte).toMatchObject({meetbasis:'gbo',m2:139,van:2});
    expect(root.vraagprijs).toBe(900000);
    expect(root.huurinkomsten).toBe(30000);
    expect(items.map(x=>x.vraagprijs)).toEqual([undefined,undefined]);
  });
  it('maakt geen optelsom van gemengde GBO-/VVO-metingen',()=>{
    const x=inventariseerPortefeuilleOnderdelen([
      obj('bedrijf',{oppervlakteVvo:750}),
      obj('woning',{oppervlakteGbo:125}),
    ]);
    expect(x.oppervlakte.m2).toBeNull();
    expect(x.oppervlakte.meetbasis).toBeNull();
    expect(x.oppervlakte.van).toBe(1);
  });
  it('onvolledige records maken ontbrekende gegevens niet nul',()=>{
    const x=inventariseerPortefeuilleOnderdelen([a,obj('zonder',{adres:undefined,huurinkomsten:undefined})]);
    expect(x.metVolledigAdres).toBe(1);
    expect(x.metJaarhuur).toBe(1);
    expect(x.oppervlakte.m2).toBeNull();
  });
  it('herkent een afzonderlijk BVO alleen als informatieve meetbasis',()=>{
    expect(individueleOppervlakte(obj('test',{oppervlakteBvo:900}))).toEqual({meetbasis:'bvo',m2:900});
    expect(individueleOppervlakte(obj('test',{oppervlakte:900}))).toBeNull();
  });
  it('berekent nooit een fictief totaal als geen gekoppelde objecten bestaan',()=>{
    const x=inventariseerPortefeuilleOnderdelen([]);
    expect(x.aantal).toBe(0);
    expect(x.oppervlakte.m2).toBeNull();
  });
});
