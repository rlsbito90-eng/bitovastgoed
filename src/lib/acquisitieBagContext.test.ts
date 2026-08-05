import { describe, expect, it } from 'vitest';
import { bouwAcquisitieBagContext } from './acquisitieBagContext';

describe('bouwAcquisitieBagContext', () => {
  it('normaliseert een leeg dossier naar niet verrijkt', () => {
    const model = bouwAcquisitieBagContext({});
    expect(model.status).toBe('niet_verrijkt');
    expect(model.heeftGeldigeMatch).toBe(false);
    expect(model.vbos).toEqual([]);
    expect(model.kandidaten).toEqual([]);
  });

  it('vindt het doelobject en gebruikt de pandcontexttotalen', () => {
    const model = bouwAcquisitieBagContext({
      bag_status: 'verrijkt',
      bag_match_kwaliteit: 'exact',
      bag_geselecteerd_vbo_id: 'vbo-1',
      bag_pandcontext_aantal_vbo: 4,
      bag_pandcontext_totaal_opp_m2: 207,
      bag_vbos: [
        {
          nummeraanduiding_id: 'na-1',
          vbo_id: 'vbo-1',
          adres: 'Nepveustraat 37-H, Amsterdam',
          opp_m2: 57,
          gebruiksdoel: ['woonfunctie'],
          status: 'Verblijfsobject in gebruik',
          pandid: 'pand-1',
          pand_bouwjaar: 1937,
          pand_status: 'Pand in gebruik',
        },
      ],
    });

    expect(model.doelAdres).toBe('Nepveustraat 37-H, Amsterdam');
    expect(model.doelOppervlakteM2).toBe(57);
    expect(model.aantalVbos).toBe(4);
    expect(model.totaalOppervlakteM2).toBe(207);
    expect(model.bouwjaar).toBe(1937);
    expect(model.heeftGeldigeMatch).toBe(true);
  });

  it('blokkeert de Kadasterovergang bij een onzekere match', () => {
    const model = bouwAcquisitieBagContext({
      bag_status: 'meerdere_matches',
      bag_match_kwaliteit: 'onzeker',
      bag_match_kandidaten: [{ adres: 'Voorbeeldstraat 1' }],
    });

    expect(model.vereistMatchkeuze).toBe(true);
    expect(model.heeftGeldigeMatch).toBe(false);
    expect(model.kandidaten).toHaveLength(1);
  });

  it('geeft expliciete geselecteerde waarden voorrang boven VBO-fallbacks', () => {
    const model = bouwAcquisitieBagContext({
      bag_status: 'verrijkt',
      bag_geselecteerd_adres: 'Gekozen adres 2',
      bag_geselecteerd_opp_m2: 80,
      bag_geselecteerd_gebruiksdoel: ['kantoorfunctie'],
      bag_vbos: [{
        nummeraanduiding_id: 'na-2',
        vbo_id: 'vbo-2',
        adres: 'Fallback adres 2',
        opp_m2: 75,
        gebruiksdoel: ['woonfunctie'],
        status: null,
        is_doelobject: true,
      }],
    });

    expect(model.doelAdres).toBe('Gekozen adres 2');
    expect(model.doelOppervlakteM2).toBe(80);
    expect(model.doelGebruiksdoelen).toEqual(['kantoorfunctie']);
  });
});
