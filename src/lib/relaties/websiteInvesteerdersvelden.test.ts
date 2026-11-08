import { describe,it,expect } from 'vitest';
import {
  WEBSITE_INVESTEERDERSVELDEN,
  websiteVeldLabel,websiteVeldWaarde,isWebsiteBronmetadata,
} from './websiteInvesteerdersvelden';

const origineleFormulierkeys = [
  'your-name','company','your-email','telephone',
  'party-type','asset-types','strategy','investment-size','search-area',
  'object-size','situation','return-target','purchase-term',
  'financing','financing-status','decision-speed','hard-criteria',
  'dealbreakers','notes','privacy','mc4wp_checkbox',
  'bito_herkomst_bron','bito_herkomst_medium','bito_herkomst_campagne',
  'bito_herkomst_verwijzer','bito_herkomst_toestemming',
  'bito_herkomst_landingspagina','bito_herkomst_formulierpagina',
];

describe('Fase 3C — volledige dekking website-investeringsformulier',()=>{
  it('heeft een herkenbaar CRM-label voor elk veld dat in de live proefinzending stond',()=>{
    expect(origineleFormulierkeys).toHaveLength(28);
    for(const key of origineleFormulierkeys){
      expect(WEBSITE_INVESTEERDERSVELDEN[key]).toBeTruthy();
      expect(websiteVeldLabel(key)).not.toBe(key);
    }
  });
  it('behoudt alle aangevinkte budget- en rendementsbanden letterlijk',()=>{
    expect(websiteVeldWaarde(['€500.000 – €1.000.000','€1.000.000 – €2.500.000']))
      .toBe('€500.000 – €1.000.000, €1.000.000 – €2.500.000');
    expect(websiteVeldWaarde(['4–6%','6–8%','8–10%','>10%']))
      .toBe('4–6%, 6–8%, 8–10%, >10%');
    expect(websiteVeldWaarde([])).toBe('Niet ingevuld');
    expect(websiteVeldWaarde('')).toBe('Niet ingevuld');
  });
  it('scheidt historische toestemming en herkomst van matchbare investeringscriteria',()=>{
    expect(isWebsiteBronmetadata('privacy')).toBe(true);
    expect(isWebsiteBronmetadata('mc4wp_checkbox')).toBe(true);
    expect(isWebsiteBronmetadata('bito_herkomst_bron')).toBe(true);
    expect(isWebsiteBronmetadata('bito_herkomst_toestemming')).toBe(true);
    for(const key of ['asset-types','investment-size','return-target','financing','notes']){
      expect(isWebsiteBronmetadata(key)).toBe(false);
    }
  });
});
