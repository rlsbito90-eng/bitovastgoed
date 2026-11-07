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

  it('vereist expliciete vastgoedvoorkeuren voor automatische basismatching', () => {
    expect(maakRelatieBasisZoekprofiel({...basis, assetClasses: [], propertyTypeIds: []})).toBeNull();
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

  it('biedt geen objecten aan die niet beschikbaar zijn', () => {
    expect(getMatchesForRelatieFromData(basis.id, [], [object(500000, 'verkocht')], basis)).toHaveLength(0);
  });
});
