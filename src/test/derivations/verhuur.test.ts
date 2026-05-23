import { describe, it, expect } from 'vitest';
import { deriveVerhuurMetrics, hasRentMismatch } from '@/lib/derivations/verhuur';

describe('verhuur — huurder-rijen leidend', () => {
  it('telt 2 huurders en sommeert jaarhuur', () => {
    const m = deriveVerhuurMetrics(
      { huurinkomsten: 60000, aantalHuurders: 2 },
      [{ jaarhuur: 30000 }, { jaarhuur: 30000 }],
    );
    expect(m.aantalHuurders).toBe(2);
    expect(m.totaleJaarhuur).toBe(60000);
    expect(m.source).toBe('huurders');
    expect(m.warnings.rentMismatch).toBe(false);
    expect(m.warnings.tenantCountMismatch).toBe(false);
  });

  it('signaleert rent mismatch bij >1% verschil', () => {
    const m = deriveVerhuurMetrics(
      { huurinkomsten: 60000 },
      [{ jaarhuur: 35000 }, { jaarhuur: 30000 }], // 65000, +8.3%
    );
    expect(m.warnings.rentMismatch).toBe(true);
    expect(hasRentMismatch({ huurinkomsten: 60000 }, [{ jaarhuur: 65000 }])).toBe(true);
  });

  it('geeft GEEN rent mismatch bij delta ≤ 1%', () => {
    const m = deriveVerhuurMetrics(
      { huurinkomsten: 60000 },
      [{ jaarhuur: 30200 }, { jaarhuur: 30000 }], // 60200, +0.33%
    );
    expect(m.warnings.rentMismatch).toBe(false);
  });

  it('signaleert tenantCountMismatch', () => {
    const m = deriveVerhuurMetrics(
      { aantalHuurders: 3 },
      [{ jaarhuur: 1 }, { jaarhuur: 1 }],
    );
    expect(m.warnings.tenantCountMismatch).toBe(true);
  });
});

describe('verhuur — fallback naar object', () => {
  it('gebruikt object-velden zonder huurder-rijen', () => {
    const m = deriveVerhuurMetrics(
      { aantalHuurders: 4, huurinkomsten: 80000, leegstandPct: 5 },
      [],
    );
    expect(m.source).toBe('object');
    expect(m.aantalHuurders).toBe(4);
    expect(m.totaleJaarhuur).toBe(80000);
    expect(m.leegstandPct).toBe(5);
    expect(m.waltJaren).toBeNull();
    expect(m.walbJaren).toBeNull();
  });

  it('source=none als niets bekend is', () => {
    const m = deriveVerhuurMetrics({}, []);
    expect(m.source).toBe('none');
    expect(m.aantalHuurders).toBeNull();
    expect(m.totaleJaarhuur).toBeNull();
  });
});

describe('verhuur — WALT/WALB huur-gewogen', () => {
  it('berekent huur-gewogen WALT', () => {
    const today = new Date('2026-01-01T00:00:00Z');
    const inYears = (years: number) => {
      const d = new Date(today);
      d.setUTCFullYear(d.getUTCFullYear() + years);
      return d.toISOString();
    };
    // Huurder A: 30k @ 2 jaar; Huurder B: 90k @ 6 jaar
    // Gewogen: (30*2 + 90*6) / 120 = 600/120 = 5
    const m = deriveVerhuurMetrics(
      {},
      [
        { jaarhuur: 30000, einddatum: inYears(2) },
        { jaarhuur: 90000, einddatum: inYears(6) },
      ],
      { today },
    );
    expect(m.waltJaren).not.toBeNull();
    expect(m.waltJaren!).toBeCloseTo(5, 1);
  });

  it('returnt null als er geen huurders met einddatum + jaarhuur zijn', () => {
    const m = deriveVerhuurMetrics({}, [{ jaarhuur: 1000 }]);
    expect(m.waltJaren).toBeNull();
    expect(m.walbJaren).toBeNull();
  });
});
