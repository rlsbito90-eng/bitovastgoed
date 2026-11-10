import { describe,it,expect } from 'vitest';
import {
  beoordeelCriteriumRegels,toetsCriterium,valideerCriteriumRegels,
  type CriteriumRegel,type CriteriumObject,
} from './criteriumRegels';

const r=(veld:CriteriumRegel['veld'],waarde:CriteriumRegel['waarde'],
  sterkte:CriteriumRegel['sterkte'],id=veld+':'+String(waarde)):CriteriumRegel=>
  ({id,veld,waarde,sterkte});
const o=(extra:Partial<CriteriumObject>={}):CriteriumObject=>
  ({provincie:'Noord-Brabant',plaats:'Breda',propertyTypeId:'wonen',vraagprijs:525000,...extra});

describe('Matching 3.0 — per criterium harde eis, voorkeur en uitsluiting',()=>{
  it('twee harde woonplaatsen zijn alternatieven, geen optelsom van verplichtingen',()=>{
    const regels=[r('plaats','Breda','hard'),r('plaats','Tilburg','hard')];
    expect(beoordeelCriteriumRegels(regels,o()).kwalificatie).toBe('passend');
    expect(beoordeelCriteriumRegels(regels,o({plaats:'Eindhoven'})).kwalificatie).toBe('afwijkend');
  });
  it('voorkeur buiten provincie mag een object nooit automatisch uitsluiten',()=>{
    const regels=[r('provincie','Noord-Brabant','voorkeur')];
    const rsl=beoordeelCriteriumRegels(regels,o({provincie:'Gelderland'}));
    expect(rsl.kwalificatie).toBe('passend');
    expect(rsl.voorkeurenAfwijkend).toHaveLength(1);
    expect(rsl.voorkeurScore).toEqual({behaald:0,getoetst:1});
  });
  it('expliciet uitgesloten plaats wint van aantrekkelijke prijs en objecttype',()=>{
    const regels=[
      r('plaats','Breda','uitsluiten'),
      r('koopprijs_max',800000,'hard'),
      r('vastgoedtype','wonen','hard'),
    ];
    const rsl=beoordeelCriteriumRegels(regels,o());
    expect(rsl.kwalificatie).toBe('afwijkend');
    expect(rsl.uitsluitingen).toHaveLength(1);
  });
  it('uitgesloten gemeente wordt nooit afgeleid uit identieke woonplaatsnaam',()=>{
    const regels=[r('gemeente','Breda','uitsluiten')];
    const rsl=beoordeelCriteriumRegels(regels,o({gemeente:undefined}));
    expect(rsl.kwalificatie).toBe('te_verifieren');
    expect(rsl.uitsluitingen).toEqual([]);
    expect(rsl.teControleren[0]).toMatch(/Uitsluiting niet te controleren/);
    expect(beoordeelCriteriumRegels(regels,o({gemeente:'Breda'})).kwalificatie).toBe('afwijkend');
  });
  it('harde eis met ontbrekende data geeft verificatie, niet afwijzing',()=>{
    const regels=[r('bar_min',8,'hard')];
    expect(beoordeelCriteriumRegels(regels,o({bar:null})).kwalificatie).toBe('te_verifieren');
    expect(beoordeelCriteriumRegels(regels,o({bar:7.5})).kwalificatie).toBe('afwijkend');
    expect(beoordeelCriteriumRegels(regels,o({bar:8.1})).kwalificatie).toBe('passend');
  });
  it('een budgetvoorkeur is niet automatisch een harde afkap',()=>{
    const regels=[r('koopprijs_max',500000,'voorkeur'),r('vastgoedtype','wonen','hard')];
    const rsl=beoordeelCriteriumRegels(regels,o({vraagprijs:600000}));
    expect(rsl.kwalificatie).toBe('passend');
    expect(rsl.voorkeurenAfwijkend).toHaveLength(1);
  });
  it('bekende provincie-uitzondering en geselecteerd zoekgebied blijven zelfstandig',()=>{
    const regels=[
      r('provincie','Noord-Brabant','hard'),
      r('plaats','Tilburg','voorkeur'),
      r('gemeente','Breda','uitsluiten'),
    ];
    const rsl=beoordeelCriteriumRegels(regels,o({plaats:'Tilburg',gemeente:'Tilburg'}));
    expect(rsl.kwalificatie).toBe('passend');
    expect(rsl.voorkeurScore).toEqual({behaald:1,getoetst:1});
  });
  it('bevestigt alleen geverifieerde vastgoedtypen, onbekende type is niet passend',()=>{
    expect(toetsCriterium(r('vastgoedtype','wonen','hard'),o({propertyTypeId:null}))).toBe('onbekend');
  });
  it('een numerieke grens kan niet als losse negatieve categorie worden gecodeerd',()=>{
    expect(valideerCriteriumRegels([r('koopprijs_max',1000000,'uitsluiten')])).toHaveLength(1);
  });
  it('identieke waarden met andere schrijfwijze worden niet dubbel toegelaten',()=>{
    const regels=[r('plaats','Breda','hard','a'),r('plaats','breda','voorkeur','b')];
    expect(valideerCriteriumRegels(regels)).toContain('Dubbele criteriumwaarde bij plaats');
  });
});
