import { describe, it, expect } from 'vitest';
import { valideerZoekprofielCriteria as check } from './zoekprofielCriteria';

describe('Breed zoekprofiel zonder verplicht mandaat of vastgoedtype', () => {
  it('laat regio alleen toe', () => {
    expect(check({regio:['Heel Nederland']})).toEqual({ok:true});
  });
  it('laat stad alleen toe', () => {
    expect(check({steden:['Breda']})).toEqual({ok:true});
  });
  it('laat alleen prijsmaximum toe', () => {
    expect(check({prijsMax:2_000_000})).toEqual({ok:true});
  });
  it('laat alleen type of dealtype toe', () => {
    expect(check({propertyTypeIds:['pt1']})).toEqual({ok:true});
    expect(check({dealTypeIds:['dt1']})).toEqual({ok:true});
  });
  it('houdt volledig lege zoekcriteria tegen', () => {
    expect(check({}).ok).toBe(false);
    expect(check({regio:['   '],steden:[]}).ok).toBe(false);
  });
  it('weigert negatieve of ongeldige budgetten', () => {
    expect(check({prijsMin:-1}).ok).toBe(false);
    expect(check({prijsMax:NaN}).ok).toBe(false);
    expect(check({prijsMin:Infinity}).ok).toBe(false);
  });
  it('weigert omgekeerde budgetgrenzen', () => {
    expect(check({prijsMin:800_000,prijsMax:400_000}).ok).toBe(false);
  });
  it('laat enkele of beide geldige budgetten toe', () => {
    expect(check({prijsMin:500_000,prijsMax:500_000})).toEqual({ok:true});
    expect(check({prijsMin:0,prijsMax:100_000})).toEqual({ok:true});
  });
});
