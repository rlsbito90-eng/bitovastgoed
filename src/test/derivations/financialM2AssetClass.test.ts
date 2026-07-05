import { describe, it, expect } from 'vitest';
import { getBerekenM2, getBerekenM2Bron } from '@/lib/derivations/financial';

const full = { oppervlakteVvo: 500, oppervlakteGbo: 400, oppervlakte: 300 };

describe('getBerekenM2 — backwards compatibility (geen assetClass)', () => {
  it('gedraagt zich als Fase 2A: VVO → GBO → oppervlakte', () => {
    expect(getBerekenM2(full)).toBe(500);
    expect(getBerekenM2({ oppervlakteGbo: 400, oppervlakte: 300 })).toBe(400);
    expect(getBerekenM2({ oppervlakte: 300 })).toBe(300);
    expect(getBerekenM2({})).toBeNull();
    expect(getBerekenM2(null)).toBeNull();
  });

  it('getBerekenM2Bron(object) zonder assetClass = Fase 2A-volgorde', () => {
    expect(getBerekenM2Bron(full).bron).toBe('vvo');
    expect(getBerekenM2Bron(full).fallback).toBe(false);
    expect(getBerekenM2Bron({ oppervlakteGbo: 400 }).bron).toBe('gbo');
    expect(getBerekenM2Bron({ oppervlakteGbo: 400 }).fallback).toBe(true);
    expect(getBerekenM2Bron({ oppervlakte: 300 }).bron).toBe('oppervlakte');
  });

  it('undefined/null assetClass valt terug op Fase 2A-volgorde', () => {
    expect(getBerekenM2Bron(full, undefined).bron).toBe('vvo');
    expect(getBerekenM2Bron(full, null).bron).toBe('vvo');
  });

  it('onbekende assetClass-string valt terug op Fase 2A-volgorde', () => {
    expect(getBerekenM2Bron(full, 'iets_onbekends').bron).toBe('vvo');
    expect(getBerekenM2Bron({ oppervlakteGbo: 400 }, 'foobar').bron).toBe('gbo');
  });
});

describe('getBerekenM2Bron — wonen: GBO-first', () => {
  it('kiest GBO als beschikbaar', () => {
    const r = getBerekenM2Bron(full, 'wonen');
    expect(r.m2).toBe(400);
    expect(r.bron).toBe('gbo');
    expect(r.fallback).toBe(false);
    expect(r.label).toBe('GBO gebruikt');
  });
  it('valt terug op VVO als GBO ontbreekt', () => {
    const r = getBerekenM2Bron({ oppervlakteVvo: 500, oppervlakte: 300 }, 'wonen');
    expect(r.m2).toBe(500);
    expect(r.bron).toBe('vvo');
    expect(r.fallback).toBe(true);
  });
  it('valt terug op oppervlakte als GBO en VVO ontbreken', () => {
    const r = getBerekenM2Bron({ oppervlakte: 300 }, 'wonen');
    expect(r.m2).toBe(300);
    expect(r.bron).toBe('oppervlakte');
    expect(r.fallback).toBe(true);
  });
});

describe('getBerekenM2Bron — commercieel: VVO-first', () => {
  const cases = ['kantoren', 'winkels', 'bedrijfshallen', 'logistiek', 'industrieel'] as const;
  it.each(cases)('%s kiest VVO first', (ac) => {
    const r = getBerekenM2Bron(full, ac);
    expect(r.bron).toBe('vvo');
    expect(r.m2).toBe(500);
    expect(r.fallback).toBe(false);
    expect(r.label).toBe('VVO gebruikt');
  });
  it.each(cases)('%s valt terug op GBO en dan oppervlakte', (ac) => {
    expect(getBerekenM2Bron({ oppervlakteGbo: 400, oppervlakte: 300 }, ac).bron).toBe('gbo');
    expect(getBerekenM2Bron({ oppervlakte: 300 }, ac).bron).toBe('oppervlakte');
  });
});

describe('getBerekenM2Bron — hotels: VVO → oppervlakte (geen GBO-tussenstap)', () => {
  it('kiest VVO', () => {
    expect(getBerekenM2Bron(full, 'hotels').bron).toBe('vvo');
  });
  it('slaat GBO over en valt terug op oppervlakte', () => {
    const r = getBerekenM2Bron({ oppervlakteGbo: 400, oppervlakte: 300 }, 'hotels');
    expect(r.bron).toBe('oppervlakte');
    expect(r.m2).toBe(300);
    expect(r.fallback).toBe(true);
  });
  it('geen bronnen → none', () => {
    expect(getBerekenM2Bron({}, 'hotels').bron).toBe('none');
  });
});

describe('getBerekenM2Bron — zorgvastgoed & mixed_use', () => {
  it('zorgvastgoed: VVO-first', () => {
    const r = getBerekenM2Bron(full, 'zorgvastgoed');
    expect(r.bron).toBe('vvo');
    expect(r.label).toBe('VVO gebruikt');
  });
  it('mixed_use: VVO-first', () => {
    const r = getBerekenM2Bron(full, 'mixed_use');
    expect(r.bron).toBe('vvo');
    expect(r.label).toBe('VVO gebruikt');
  });
});

describe('getBerekenM2Bron — ontwikkellocatie: geen automatische rekenbron', () => {
  it('retourneert bron=none, m2=null, ook als alle oppervlaktes bekend zijn', () => {
    const r = getBerekenM2Bron(full, 'ontwikkellocatie');
    expect(r.m2).toBeNull();
    expect(r.bron).toBe('none');
    expect(r.fallback).toBe(false);
    expect(r.label).toBe('Onvoldoende gegevens voor m²-berekening');
  });
  it('getBerekenM2 wrapper geeft null', () => {
    expect(getBerekenM2(full, 'ontwikkellocatie')).toBeNull();
  });
});

describe('getBerekenM2Bron — BVO wordt nooit meegenomen', () => {
  it('BVO wordt genegeerd als andere geldige m²-bronnen bestaan', () => {
    // BVO is niet eens onderdeel van de interface, maar zelfs als het per
    // ongeluk in het object zit: het mag de keuze niet beïnvloeden.
    const obj = { oppervlakteVvo: 500, oppervlakteBvo: 900 } as any;
    expect(getBerekenM2Bron(obj, 'kantoren').bron).toBe('vvo');
    expect(getBerekenM2Bron(obj, 'kantoren').m2).toBe(500);
  });
  it('alleen BVO bekend → bron=none, label=onvoldoende', () => {
    const obj = { oppervlakteBvo: 900 } as any;
    const r = getBerekenM2Bron(obj, 'kantoren');
    expect(r.m2).toBeNull();
    expect(r.bron).toBe('none');
    expect(r.label).toBe('Onvoldoende gegevens voor m²-berekening');
  });
  it('alleen BVO bekend, wonen → bron=none', () => {
    const obj = { oppervlakteBvo: 900 } as any;
    expect(getBerekenM2Bron(obj, 'wonen').bron).toBe('none');
  });
  it('alleen BVO bekend, geen assetClass → bron=none (BC-pad negeert BVO)', () => {
    const obj = { oppervlakteBvo: 900 } as any;
    expect(getBerekenM2Bron(obj).bron).toBe('none');
    expect(getBerekenM2(obj)).toBeNull();
  });
});

describe('getBerekenM2Bron — invalide waarden worden genegeerd (geen NaN/Infinity/0/negatief)', () => {
  it('0, negatief, NaN, Infinity vallen door naar volgende bron', () => {
    const obj = {
      oppervlakteVvo: 0,
      oppervlakteGbo: -10,
      oppervlakte: 300,
    };
    expect(getBerekenM2Bron(obj, 'kantoren').bron).toBe('oppervlakte');
    expect(getBerekenM2Bron(obj, 'kantoren').m2).toBe(300);
    expect(getBerekenM2Bron(obj, 'kantoren').fallback).toBe(true);
  });
  it('alle waarden ongeldig → bron=none', () => {
    const obj = {
      oppervlakteVvo: NaN,
      oppervlakteGbo: Infinity,
      oppervlakte: 0,
    };
    expect(getBerekenM2Bron(obj, 'wonen').bron).toBe('none');
    expect(getBerekenM2Bron(obj).m2).toBeNull();
  });
});
