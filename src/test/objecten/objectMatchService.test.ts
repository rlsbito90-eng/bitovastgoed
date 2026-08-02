import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { vindObjectMatches } from '@/lib/objecten/objectMatchService';

const basis = (id:string, patch:Partial<ObjectVastgoed>={}):ObjectVastgoed => ({ id, titel:id, anoniem:false, plaats:'Tilburg', provincie:'Noord-Brabant', adres:'Markt 1', postcode:'5038 AB', type:'winkels', status:'te_beoordelen', exclusief:false, verhuurStatus:'leeg', ontwikkelPotentie:false, transformatiePotentie:false, isPortefeuille:false, documentenBeschikbaar:false, datumToegevoegd:'2026-08-02', ...patch });

describe('read-only objectmatching', () => {
  it('matcht equivalent geschreven volledige adressen', () => {
    const result = vindObjectMatches({ adres:'Markt-1', postcode:'5038ab', plaats:'tilburg' }, [basis('1')]);
    expect(result[0]?.redenen).toContain('volledig_adres');
  });
  it('geeft CRM-objectnummer de hoogste zekerheid', () => {
    const result = vindObjectMatches({ crmObjectnummer:'OBJ-000033' }, [basis('1',{crmObjectnummer:'OBJ-000033'}), basis('2')]);
    expect(result[0]?.object.id).toBe('1'); expect(result[0]?.score).toBe(100);
  });
  it('muteert geen objecten', () => {
    const object = basis('1'); const before = JSON.stringify(object); vindObjectMatches({adres:'Markt 1',postcode:'5038 AB',plaats:'Tilburg'},[object]); expect(JSON.stringify(object)).toBe(before);
  });
});
