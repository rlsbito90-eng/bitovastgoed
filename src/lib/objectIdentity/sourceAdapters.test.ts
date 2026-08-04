import { describe, expect, it } from 'vitest';
import {
  OBJECT_IDENTITY_SOURCE_ADAPTERS,
  adapteerBronRijen,
  maakReadOnlySelectContract,
} from './sourceAdapters';

describe('Object-ID bronadapters', () => {
  it('dekt alle vijf centrale CRM-bronnen', () => {
    expect(Object.keys(OBJECT_IDENTITY_SOURCE_ADAPTERS).sort()).toEqual([
      'acquisitie_target',
      'deal',
      'object',
      'off_market_signaal',
      'vastgoedkans',
    ]);
  });

  it('maakt uitsluitend read-only selectcontracten', () => {
    for (const adapter of Object.values(OBJECT_IDENTITY_SOURCE_ADAPTERS)) {
      expect(maakReadOnlySelectContract(adapter)).toMatchObject({
        operation: 'select',
        readOnly: true,
        writes: 0,
      });
    }
  });

  it('geeft Objecten/Aanbod BAG-identiteit voorrang en behoudt adresfallback', () => {
    const records = adapteerBronRijen(OBJECT_IDENTITY_SOURCE_ADAPTERS.object, [{
      id: 'object-1',
      bag_verblijfsobject_id: '0363010000123456',
      bag_pand_id: '0363100012345678',
      adres: 'Damrak 1',
      postcode: '1012LG',
      plaats: 'Amsterdam',
      crm_objectregistratie_id: 'crm-1',
    }]);

    expect(records[0]).toEqual({
      sourceType: 'object',
      sourceId: 'object-1',
      bagVerblijfsobjectId: '0363010000123456',
      bagPandId: '0363100012345678',
      adres: 'Damrak 1',
      postcode: '1012LG',
      plaats: 'Amsterdam',
      bestaandObjectId: 'crm-1',
    });
  });

  it('rapporteert ontbrekende BAG-kolommen als null en verzint niets', () => {
    const [record] = adapteerBronRijen(OBJECT_IDENTITY_SOURCE_ADAPTERS.acquisitie_target, [{
      id: 'target-1',
      adres: 'Stationsstraat 1',
      postcode: '5061HE',
      plaats: 'Oisterwijk',
      object_id: 'legacy-object-1',
    }]);

    expect(record.bagVerblijfsobjectId).toBeNull();
    expect(record.bagPandId).toBeNull();
    expect(record.bestaandObjectId).toBe('legacy-object-1');
  });

  it('ondersteunt bekende alternatieve BAG-veldnamen zonder fuzzy matching', () => {
    const [record] = adapteerBronRijen(OBJECT_IDENTITY_SOURCE_ADAPTERS.vastgoedkans, [{
      id: 'kans-1',
      bag_vbo_id: '0363010000654321',
      bag_pand_id: '0363100098765432',
    }]);

    expect(record.bagVerblijfsobjectId).toBe('0363010000654321');
    expect(record.bagPandId).toBe('0363100098765432');
  });
});
