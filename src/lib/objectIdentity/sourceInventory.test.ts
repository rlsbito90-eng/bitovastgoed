import { describe, expect, it } from 'vitest';
import {
  inventariseerObjectIdentityBronnen,
  normaliseerObjectIdentitySourceRecord,
  type ObjectIdentitySourceRecord,
} from './sourceInventory';

function record(
  overrides: Partial<ObjectIdentitySourceRecord> = {},
): ObjectIdentitySourceRecord {
  return {
    sourceType: 'vastgoedkans',
    sourceId: '11111111-1111-1111-1111-111111111111',
    bagVerblijfsobjectId: null,
    bagPandId: '0363100012345678',
    adres: 'Damrak 1',
    postcode: '1012 lg',
    plaats: 'Amsterdam',
    bestaandObjectId: null,
    ...overrides,
  };
}

describe('Object-ID broninventarisatie', () => {
  it('normaliseert uitsluitend technische invoervormen', () => {
    expect(normaliseerObjectIdentitySourceRecord(record())).toMatchObject({
      postcode: '1012LG',
      bagPandId: '0363100012345678',
    });
  });

  it('accepteert een geldige BAG-ID als primaire identiteit', () => {
    const report = inventariseerObjectIdentityBronnen([record()]);
    expect(report.status).toBe('inventory_ready');
    expect(report.automaticWrites).toBe(0);
    expect(report.matchVolgorde).toEqual([
      'bag_verblijfsobject',
      'bag_pand',
      'adres',
      'handmatig',
    ]);
    expect(report.summaries.find(item => item.sourceType === 'vastgoedkans')).toMatchObject({
      totaal: 1,
      metBagPandId: 1,
      viaBagKoppelbaar: 1,
      viaAdresFallbackKoppelbaar: 0,
      koppelbaar: 1,
      handmatigBeoordelen: 0,
    });
  });

  it('blokkeert ongeldige BAG-ID ook wanneer een adres aanwezig is', () => {
    const report = inventariseerObjectIdentityBronnen([
      record({ sourceType: 'object', bagPandId: '0363-ongeldig' }),
    ]);
    expect(report.status).toBe('inventory_blocked');
    expect(report.issues.map(issue => issue.code)).toContain('ongeldig_bag_pand_id');
  });

  it('staat een volledig adres toe wanneer BAG-ID ontbreekt', () => {
    const report = inventariseerObjectIdentityBronnen([
      record({ sourceType: 'off_market_signaal', bagPandId: null }),
    ]);
    expect(report.status).toBe('inventory_ready');
    expect(report.summaries.find(item => item.sourceType === 'off_market_signaal')).toMatchObject({
      metVolledigAdres: 1,
      viaAdresFallbackKoppelbaar: 1,
      koppelbaar: 1,
    });
  });

  it('rapporteert Objecten/Aanbod zonder BAG-ID als BAG-verrijking nodig', () => {
    const report = inventariseerObjectIdentityBronnen([
      record({ sourceType: 'object', bagPandId: null, bagVerblijfsobjectId: null }),
    ]);
    expect(report.status).toBe('inventory_ready');
    expect(report.summaries.find(item => item.sourceType === 'object')).toMatchObject({
      viaAdresFallbackKoppelbaar: 1,
      bagVerrijkingNodig: 1,
    });
  });

  it('blokkeert gedeeltelijke adressen en ontbrekende identiteit', () => {
    const report = inventariseerObjectIdentityBronnen([
      record({
        sourceType: 'acquisitie_target',
        bagPandId: null,
        adres: 'Stationsstraat 1',
        postcode: null,
        plaats: 'Oisterwijk',
      }),
    ]);
    expect(report.status).toBe('inventory_blocked');
    expect(report.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['onvolledig_adres', 'ontbrekende_identiteit']),
    );
  });

  it('vertrouwt een bestaand object_id niet zonder onafhankelijke identiteit', () => {
    const report = inventariseerObjectIdentityBronnen([
      record({
        sourceType: 'deal',
        bagPandId: null,
        adres: null,
        postcode: null,
        plaats: null,
        bestaandObjectId: '22222222-2222-2222-2222-222222222222',
      }),
    ]);
    expect(report.status).toBe('inventory_blocked');
    expect(report.issues.map(issue => issue.code)).toContain(
      'bestaand_object_id_zonder_identiteit',
    );
  });
});
