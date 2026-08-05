import { describe, expect, it } from 'vitest';
import { offMarketSignaalNaarBagContext, vastgoedkansNaarBagContext } from './acquisitieBagAdapters';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';

const vbo = {
  nummeraanduiding_id: '0363200000123456',
  vbo_id: '0363010000123456',
  adres: 'Voorbeeldstraat 10, 1011 AB Amsterdam',
  opp_m2: 245,
  gebruiksdoel: ['kantoorfunctie'],
  status: 'Verblijfsobject in gebruik',
  pandid: '0363100000123456',
  pand_bouwjaar: 1928,
  pand_status: 'Pand in gebruik',
  is_doelobject: true,
};

describe('acquisitieBagAdapters', () => {
  it('behoudt de bestaande Off-Market BAG-context zonder betekenisverlies', () => {
    const signaal = {
      id: 'signaal-1',
      bag_status: 'verrijkt',
      bag_match_kwaliteit: 'exact',
      bag_vbos: [vbo],
      bag_geselecteerd_vbo_id: vbo.vbo_id,
      bag_geselecteerd_nummeraanduiding_id: vbo.nummeraanduiding_id,
      bag_geselecteerd_adres: vbo.adres,
      bag_pandcontext_aantal_vbo: 3,
      bag_pandcontext_totaal_opp_m2: 610,
      bag_aantal_panden: 1,
    } as unknown as OffMarketSignaal;

    const context = offMarketSignaalNaarBagContext(signaal);

    expect(context.status).toBe('verrijkt');
    expect(context.matchKwaliteit).toBe('exact');
    expect(context.doelVboId).toBe(vbo.vbo_id);
    expect(context.doelPandId).toBe(vbo.pandid);
    expect(context.doelOppervlakteM2).toBe(245);
    expect(context.aantalVbos).toBe(3);
    expect(context.totaalOppervlakteM2).toBe(610);
    expect(context.heeftGeldigeMatch).toBe(true);
  });

  it('maakt van een Vastgoedkans met BAG-ID een beperkte read-only context', () => {
    const kans = {
      adres: 'Voorbeeldstraat 10',
      postcode: '1011 AB',
      plaats: 'Amsterdam',
      bagPandId: '0363100000123456',
      bagVerblijfsobjectId: '0363010000123456',
    } as Pick<Vastgoedkans, 'adres' | 'postcode' | 'plaats' | 'bagPandId' | 'bagVerblijfsobjectId'>;

    const context = vastgoedkansNaarBagContext(kans);

    expect(context.status).toBe('verrijkt');
    expect(context.matchKwaliteit).toBe('bestaande_koppeling');
    expect(context.doelAdres).toBe('Voorbeeldstraat 10, 1011 AB, Amsterdam');
    expect(context.doelPandId).toBe('0363100000123456');
    expect(context.doelVboId).toBe('0363010000123456');
    expect(context.vbos).toEqual([]);
  });

  it('claimt zonder BAG-ID geen verrijkte Vastgoedkans', () => {
    const context = vastgoedkansNaarBagContext({
      adres: 'Voorbeeldstraat 10',
      postcode: '1011 AB',
      plaats: 'Amsterdam',
      bagPandId: null,
      bagVerblijfsobjectId: null,
    });

    expect(context.status).toBe('niet_verrijkt');
    expect(context.heeftGeldigeMatch).toBe(false);
    expect(context.doelPandId).toBeNull();
    expect(context.doelVboId).toBeNull();
  });
});
