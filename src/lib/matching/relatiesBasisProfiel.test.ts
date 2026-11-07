import { describe, expect, it } from 'vitest';
import {
  getMatchesForRelatieFromData,
  maakRelatieBasisZoekprofiel,
  type ObjectVastgoed,
  type Relatie,
  type Zoekprofiel,
} from '@/data/mock-data';

const basis: Relatie = {
  id: 'koper-1',
  bedrijfsnaam: 'Test Belegger',
  contactpersoon: '',
  type: 'belegger',
  commercialRoles: null,
  partijprofiel: 'belegger',
  telefoon: '',
  email: '',
  regio: ['Gelderland'],
  assetClasses: ['wonen'],
  propertyTypeIds: [],
  budgetMin: 100000,
  budgetMax: 1000000,
  leadStatus: 'actief',
  ndaGetekend: false,
  laatsteContact: '',
};

const object = (prijs = 500000, status: ObjectVastgoed['status'] = 'beschikbaar'): ObjectVastgoed => ({
  id: 'object-1',
  titel: 'Testwoning Arnhem',
  plaats: 'Arnhem',
  provincie: 'Gelderland',
  type: 'wonen',
  status,
  vraagprijs: prijs,
  verhuurStatus: 'verhuurd',
  exclusief: false,
  anoniem: true,
} as ObjectVastgoed);

describe('Relaties is het primaire investeringsprofiel', () => {
  it('genereert een virtueel basisprofiel zonder een rij in zoekprofielen', () => {
    const profiel = maakRelatieBasisZoekprofiel(basis);
    expect(profiel?.id).toBe('relatie:koper-1');
    expect(profiel?.prijsMax).toBe(1000000);
    expect(profiel?.regio).toEqual(['Gelderland']);
  });

  it('vindt een passend object zonder afzonderlijk zoekprofiel', () => {
    const resultaten = getMatchesForRelatieFromData(basis.id, [], [object()], basis);
    expect(resultaten).toHaveLength(1);
    expect(resultaten[0].zoekprofielId).toBe('relatie:koper-1');
  });

  it('respecteert de budgetgrens uit Relaties', () => {
    expect(getMatchesForRelatieFromData(basis.id, [], [object(1200000)], basis)).toHaveLength(0);
  });

  it('brede zoekcriteria kunnen ook zonder vastgoedtype een contactroute vormen', () => {
    expect(maakRelatieBasisZoekprofiel({...basis, assetClasses: [], propertyTypeIds: []})).not.toBeNull();
    expect(maakRelatieBasisZoekprofiel({
      ...basis,assetClasses:[],propertyTypeIds:[],regio:[],budgetMin:undefined,budgetMax:undefined,
    })).toBeNull();
  });

  it('behoudt extra profielen, maar toont niet twee keer hetzelfde object', () => {
    const extra: Zoekprofiel = {
      id: 'zoekprofiel-1', naam: 'Extra Arnhem', relatieId: basis.id,
      typeVastgoed: ['wonen'], regio: ['Gelderland'],
      prijsMin: 100000, prijsMax: 1000000,
      ontwikkelPotentie: false, transformatiePotentie: false,
      status: 'actief', prioriteit: 3,
    };
    const resultaten = getMatchesForRelatieFromData(basis.id, [extra], [object()], basis);
    expect(resultaten).toHaveLength(1);
  });

  it('vereist het objecttype bij relaties die alleen nieuwe vastgoedtypen hebben ingevuld', () => {
    const relatie: Relatie = {...basis, assetClasses: [], propertyTypeIds: ['type-wonen']};
    // Alleen een match op regio en budget is onvoldoende wanneer het object geen taxonomietype heeft.
    expect(getMatchesForRelatieFromData(relatie.id, [], [object()], relatie)).toHaveLength(0);
  });

  it('matcht het juiste nieuwe vastgoedtype wel als beide kanten dat expliciet kennen', () => {
    const relatie: Relatie = {...basis, assetClasses: [], propertyTypeIds: ['type-wonen']};
    const vastgoed: ObjectVastgoed = {...object(), propertyTypeId: 'type-wonen'};
    const resultaten = getMatchesForRelatieFromData(relatie.id, [], [vastgoed], relatie);
    expect(resultaten).toHaveLength(1);
    expect(resultaten[0].zoekprofielId).toBe('relatie:koper-1');
  });

  it('matcht landelijk zoekgebied ook buiten bestaande provinciale zoekfilters', () => {
    const landelijk: Relatie = {...basis, regio: ['Heel Nederland']};
    const friesland: ObjectVastgoed = {...object(), provincie: 'Friesland', plaats: 'Leeuwarden'};
    expect(getMatchesForRelatieFromData(landelijk.id, [], [friesland], landelijk)).toHaveLength(1);
  });

  it('wijst een afwijkend nieuw vastgoedtype af', () => {
    const relatie: Relatie = {...basis, assetClasses: [], propertyTypeIds: ['type-wonen']};
    const vastgoed: ObjectVastgoed = {...object(), propertyTypeId: 'type-kantoren'};
    expect(getMatchesForRelatieFromData(relatie.id, [], [vastgoed], relatie)).toHaveLength(0);
  });

  it('behandelt een expliciet vastgoedeigenaarprofiel niet als koper ondanks oud standaardtype belegger', () => {
    const eigenaar: Relatie = {...basis, partijprofiel: 'vastgoedeigenaar', commercialRoles: null};
    expect(maakRelatieBasisZoekprofiel(eigenaar)).toBeNull();
  });

  it('behoudt makelaars/bemiddelaars als directe contactroute zonder hen eindkoper te noemen', () => {
    const bemiddelaar: Relatie = {...basis, partijprofiel: 'bemiddelaar', commercialRoles: null};
    expect(maakRelatieBasisZoekprofiel(bemiddelaar)).not.toBeNull();
    expect(maakRelatieBasisZoekprofiel({...bemiddelaar,commercialRoles:['bemiddelaar']})).not.toBeNull();
  });

  it('past geen basismatching toe zonder kooprol', () => {
    const verkoper: Relatie = {...basis, commercialRoles: ['verkoper']};
    expect(maakRelatieBasisZoekprofiel(verkoper)).toBeNull();
    expect(getMatchesForRelatieFromData(verkoper.id, [], [object()], verkoper)).toHaveLength(0);
  });

  it('bewaart gemeenten en steden als echte gestructureerde criteria', () => {
    const r: Relatie={...basis,zoekGemeenten:['Oisterwijk'],zoekPlaatsen:['Haaren']};
    const p=maakRelatieBasisZoekprofiel(r);
    expect(p?.steden).toEqual(['gemeente:Oisterwijk','Haaren']);
  });

  it('wijst objecten buiten de bekende provincie van een gezochte gemeente af', () => {
    const r: Relatie={...basis,regio:['Noord-Brabant'],zoekGemeenten:['Oisterwijk']};
    expect(getMatchesForRelatieFromData(r.id,[],[object()],r)).toHaveLength(0);
  });

  it('neemt objecten in de juiste provincie alleen ter verificatie mee', () => {
    const r: Relatie={...basis,regio:['Noord-Brabant'],zoekGemeenten:['Oisterwijk']};
    const o={...object(),plaats:'Oisterwijk',provincie:'Noord-Brabant'};
    const matches=getMatchesForRelatieFromData(r.id,[],[o],r);
    expect(matches).toHaveLength(1);
    expect(matches[0].ontbrekendeData).toContain('regio');
  });

  it('verbergt gearchiveerde en soft-deleted objecten uit de relatiekaart', () => {
    expect(getMatchesForRelatieFromData(basis.id, [], [{...object(), isArchived:true}], basis)).toHaveLength(0);
    expect(getMatchesForRelatieFromData(basis.id, [], [{...object(), softDeletedAt:'2026-11-07T10:00:00Z'}], basis)).toHaveLength(0);
  });

  it('biedt geen objecten aan die niet beschikbaar zijn', () => {
    expect(getMatchesForRelatieFromData(basis.id, [], [object(500000, 'verkocht')], basis)).toHaveLength(0);
  });
});
