import { describe, it, expect } from 'vitest';
import {
  safeNumber,
  safeDivide,
  calculateMonthlyRent,
  calculateAnnualFromMonthly,
  calculatePricePerM2,
  calculateRentPerM2,
  calculateBAR,
  calculateFactor,
  calculateNAR,
  resolveDerived,
  resolveBAR,
  resolveNOI,
  resolveManual,
  resolveMaandhuur,
  resolvePricePerM2,
  getBerekenM2,
} from '@/lib/derivations/financial';

describe('financial — safeNumber / safeDivide', () => {
  it('filtert NaN, Infinity en niet-numerieke input', () => {
    expect(safeNumber(NaN)).toBeNull();
    expect(safeNumber(Infinity)).toBeNull();
    expect(safeNumber(-Infinity)).toBeNull();
    expect(safeNumber('abc')).toBeNull();
    expect(safeNumber(null)).toBeNull();
    expect(safeNumber(undefined)).toBeNull();
    expect(safeNumber('')).toBeNull();
    expect(safeNumber('12.5')).toBe(12.5);
    expect(safeNumber(0)).toBe(0);
  });

  it('safeDivide: deelt veilig, geen NaN/Infinity', () => {
    expect(safeDivide(10, 0)).toBeNull();
    expect(safeDivide(10, -1)).toBeNull();
    expect(safeDivide(null, 5)).toBeNull();
    expect(safeDivide(10, 2)).toBe(5);
  });
});

describe('financial — afleidingen', () => {
  it('maandhuur uit jaarhuur 72.000 = 6.000', () => {
    expect(calculateMonthlyRent(72000)).toBe(6000);
  });

  it('jaarhuur uit maandhuur 6.000 = 72.000', () => {
    expect(calculateAnnualFromMonthly(6000)).toBe(72000);
  });

  it('BAR: jaarhuur 60.000 / vraagprijs 1.000.000 = 6', () => {
    expect(calculateBAR(60000, 1_000_000)).toBe(6);
  });

  it('factor: vraagprijs 1.000.000 / jaarhuur 60.000 ≈ 16.6667', () => {
    const f = calculateFactor(1_000_000, 60000);
    expect(f).not.toBeNull();
    expect(f!).toBeCloseTo(16.6667, 3);
  });

  it('NAR: NOI 50.000 / vraagprijs 1.000.000 = 5', () => {
    expect(calculateNAR(50000, 1_000_000)).toBe(5);
  });

  it('huur/m² en €/m²', () => {
    expect(calculateRentPerM2(60000, 500)).toBe(120);
    expect(calculatePricePerM2(1_000_000, 500)).toBe(2000);
  });

  it('ontbrekende / 0 input geeft null, geen NaN/Infinity', () => {
    expect(calculateBAR(undefined, 1000)).toBeNull();
    expect(calculateBAR(1000, 0)).toBeNull();
    expect(calculateFactor(1000, 0)).toBeNull();
    expect(calculateMonthlyRent(0)).toBeNull();
    expect(calculateRentPerM2(60000, 0)).toBeNull();
    expect(calculatePricePerM2(1000, undefined)).toBeNull();
  });
});

describe('financial — resolveDerived (override-model)', () => {
  it('zonder override wint auto', () => {
    const r = resolveDerived(6, undefined);
    expect(r.value).toBe(6);
    expect(r.source).toBe('auto');
    expect(r.mismatch).toBe(false);
  });

  it('met override wint override en delta wordt berekend', () => {
    const r = resolveDerived(6, 6.5);
    expect(r.source).toBe('override');
    expect(r.value).toBe(6.5);
    expect(r.delta).toBeCloseTo(0.5, 6);
    expect(r.mismatch).toBe(true);
  });

  it('source=none als beide null', () => {
    const r = resolveDerived(null, null);
    expect(r.value).toBeNull();
    expect(r.source).toBe('none');
  });

  it('resolveBAR werkt als compositie', () => {
    const r = resolveBAR(60000, 1_000_000, undefined);
    expect(r.value).toBe(6);
    expect(r.source).toBe('auto');
  });

  it('resolveNOI: jaarhuur − servicekosten', () => {
    const r = resolveNOI(100000, 20000, undefined);
    expect(r.value).toBe(80000);
    const o = resolveNOI(100000, 20000, 75000);
    expect(o.source).toBe('override');
    expect(o.value).toBe(75000);
    expect(o.delta).toBe(-5000);
  });
});

describe('financial — getBerekenM2 (Fase 2A)', () => {
  it('kiest VVO als eerste prioriteit', () => {
    expect(getBerekenM2({ oppervlakteVvo: 500, oppervlakteGbo: 400, oppervlakte: 300 })).toBe(500);
  });
  it('valt terug op GBO als VVO ontbreekt', () => {
    expect(getBerekenM2({ oppervlakteVvo: null, oppervlakteGbo: 400, oppervlakte: 300 })).toBe(400);
  });
  it('valt terug op oppervlakte als VVO en GBO ontbreken', () => {
    expect(getBerekenM2({ oppervlakte: 300 })).toBe(300);
  });
  it('retourneert null bij lege of ongeldige waarden — geen NaN', () => {
    expect(getBerekenM2({})).toBeNull();
    expect(getBerekenM2(null)).toBeNull();
    expect(getBerekenM2({ oppervlakteVvo: 0, oppervlakteGbo: -1, oppervlakte: null })).toBeNull();
  });
});

describe('financial — resolvePricePerM2 / resolveMaandhuur (Fase 2A)', () => {
  it('resolvePricePerM2: auto bij geldige input', () => {
    const r = resolvePricePerM2(1_000_000, 500);
    expect(r.value).toBe(2000);
    expect(r.source).toBe('auto');
  });
  it('resolvePricePerM2: none bij ontbrekende m²', () => {
    const r = resolvePricePerM2(1_000_000, null);
    expect(r.value).toBeNull();
    expect(r.source).toBe('none');
  });
  it('resolvePricePerM2: geen NaN bij 0/undefined', () => {
    expect(resolvePricePerM2(0, 0).value).toBeNull();
    expect(resolvePricePerM2(undefined, undefined).value).toBeNull();
  });
  it('resolveMaandhuur: auto bij geldige jaarhuur', () => {
    const r = resolveMaandhuur(72000);
    expect(r.value).toBe(6000);
    expect(r.source).toBe('auto');
  });
  it('resolveMaandhuur: none zonder jaarhuur', () => {
    expect(resolveMaandhuur(null).source).toBe('none');
    expect(resolveMaandhuur(0).source).toBe('none');
  });
});

describe('financial — resolveManual voor NOI/NAR (Fase 2A definitiecorrectie)', () => {
  it('NOI: aanwezig object.noi → source=override (handmatig)', () => {
    const r = resolveManual(80000);
    expect(r.value).toBe(80000);
    expect(r.source).toBe('override');
  });
  it('NOI: ontbrekend → source=none (onvoldoende gegevens)', () => {
    expect(resolveManual(null).source).toBe('none');
    expect(resolveManual(undefined).source).toBe('none');
    expect(resolveManual('').source).toBe('none');
  });
  it('NAR: aanwezig nettoAanvangsrendement → source=override', () => {
    expect(resolveManual(4.8).source).toBe('override');
  });
  it('NAR: ontbrekend → source=none, waarde null, geen automatische afleiding op vraagprijs', () => {
    const r = resolveManual(undefined);
    expect(r.value).toBeNull();
    expect(r.source).toBe('none');
    expect(r.auto).toBeNull();
  });
  it('servicekostenJaar wordt NIET als exploitatiekosten gebruikt in resolveManual (NOI)', () => {
    // resolveManual krijgt alleen object.noi mee; servicekosten spelen geen rol.
    const r = resolveManual(undefined);
    expect(r.value).toBeNull();
  });
});

describe('financial — BAR/huurPerM2 met handmatige override behouden waarde', () => {
  it('BAR: opgeslagen override wint over auto', () => {
    const r = resolveBAR(60000, 1_000_000, 5.5);
    expect(r.value).toBe(5.5);
    expect(r.source).toBe('override');
    expect(r.auto).toBe(6);
  });
  it('huur/m² met override via resolveDerived', () => {
    const auto = calculateRentPerM2(60000, 500); // 120
    const r = resolveDerived(auto, 135);
    expect(r.value).toBe(135);
    expect(r.source).toBe('override');
  });
});

describe('financial — prijsindicatie mag nooit input zijn voor rendementen', () => {
  it('BAR met prijsindicatie-string als "vraagprijs" → null', () => {
    // Een tekstuele prijsindicatie ("vanaf 1,2 mln") mag niet als getal
    // worden geïnterpreteerd voor rendementsberekening.
    expect(calculateBAR(60000, 'vanaf 1,2 mln')).toBeNull();
    expect(calculateFactor('op aanvraag', 60000)).toBeNull();
    expect(calculateNAR(50000, 'nader te bepalen')).toBeNull();
  });
});
