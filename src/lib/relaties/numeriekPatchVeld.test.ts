import { describe,expect,it } from 'vitest';
import { numeriekPatchVeld } from './numeriekPatchVeld';
import type { Relatie } from '@/data/mock-data';

describe('Gedeeltelijke relatie-updates: behoud numerieke waarden',()=>{
  it('geeft undefined voor niet-genoemde budget- en rendementsvelden',()=>{
    const patch:Partial<Relatie>={partijprofiel:'fonds'};
    for(const veld of ['budgetMin','budgetMax','rendementseis','eigenVermogenPct'] as const){
      expect(numeriekPatchVeld(patch,veld)).toBeUndefined();
    }
  });
  it('behoudt een expliciet budget van 0 of 500000',()=>{
    expect(numeriekPatchVeld({budgetMin:0} as Partial<Relatie>,'budgetMin')).toBe(0);
    expect(numeriekPatchVeld({budgetMax:500000} as Partial<Relatie>,'budgetMax')).toBe(500000);
  });
  it('schrijft NULL alleen bij expliciet geleegde waarden',()=>{
    expect(numeriekPatchVeld({budgetMin:undefined} as Partial<Relatie>,'budgetMin')).toBeNull();
    expect(numeriekPatchVeld({rendementseis:null} as unknown as Partial<Relatie>,'rendementseis')).toBeNull();
  });
});
