// Fase 2B — Override/delta-weergave op read-only financiële metrics
//
// Deze tests borgen de invarianten waarop de ObjectDetailPage-UI de
// delta-regel toont: `source==='override' && auto!=null && override!=null`.
// NOI/NAR blijven bewust buiten scope: `resolveManual` heeft geen
// automatische basis, dus `auto` is altijd `null` en er kan nooit een
// delta-regel getoond worden.

import { describe, it, expect } from 'vitest';
import {
  resolveBAR,
  resolveDerived,
  resolveManual,
  resolveMaandhuur,
  resolvePricePerM2,
  calculateRentPerM2,
} from '@/lib/derivations/financial';

describe('Fase 2B — delta-weergave predicaten (BAR)', () => {
  it('BAR met override toont auto + finite delta', () => {
    const r = resolveBAR(60000, 1_000_000, 5.5); // auto=6, override=5.5
    expect(r.source).toBe('override');
    expect(r.auto).toBe(6);
    expect(r.override).toBe(5.5);
    expect(r.delta).not.toBeNull();
    expect(Number.isFinite(r.delta!)).toBe(true);
    expect(r.delta!).toBeCloseTo(-0.5, 6);
    expect(r.mismatch).toBe(true);
  });

  it('BAR zonder override (auto): geen delta-regel', () => {
    const r = resolveBAR(60000, 1_000_000, undefined);
    expect(r.source).toBe('auto');
    expect(r.delta).toBeNull();
  });

  it('BAR zonder auto en zonder override: source=none, geen delta', () => {
    const r = resolveBAR(undefined, undefined, undefined);
    expect(r.source).toBe('none');
    expect(r.delta).toBeNull();
  });

  it('BAR met override maar zonder auto (onvolledige input): geen delta-regel', () => {
    // Vraagprijs ontbreekt → auto=null; alleen override aanwezig.
    const r = resolveBAR(undefined, undefined, 5.5);
    expect(r.source).toBe('override');
    expect(r.auto).toBeNull();
    expect(r.override).toBe(5.5);
    expect(r.delta).toBeNull(); // predicaat guardt UI-regel
  });
});

describe('Fase 2B — delta-weergave predicaten (Huur / m²)', () => {
  it('huur/m² met override toont auto + finite delta', () => {
    const auto = calculateRentPerM2(60000, 500); // 120
    const r = resolveDerived(auto, 135);
    expect(r.source).toBe('override');
    expect(r.auto).toBe(120);
    expect(r.override).toBe(135);
    expect(r.delta).toBe(15);
    expect(Number.isFinite(r.delta!)).toBe(true);
    expect(r.mismatch).toBe(true);
  });

  it('huur/m² auto zonder override: geen delta-regel', () => {
    const auto = calculateRentPerM2(60000, 500);
    const r = resolveDerived(auto, undefined);
    expect(r.source).toBe('auto');
    expect(r.delta).toBeNull();
  });
});

describe('Fase 2B — NOI/NAR blijven buiten delta-weergave', () => {
  it('resolveManual (NOI) met opgeslagen waarde: source=override maar auto=null → geen delta', () => {
    const r = resolveManual(80000);
    expect(r.source).toBe('override');
    expect(r.auto).toBeNull();
    expect(r.delta).toBeNull();
    expect(r.mismatch).toBe(false);
  });

  it('resolveManual (NAR) met opgeslagen waarde: geen delta-regel', () => {
    const r = resolveManual(4.8);
    expect(r.auto).toBeNull();
    expect(r.delta).toBeNull();
  });

  it('resolveManual zonder waarde: source=none, geen delta', () => {
    const r = resolveManual(undefined);
    expect(r.source).toBe('none');
    expect(r.delta).toBeNull();
  });
});

describe('Fase 2B — metrics zonder override-model tonen nooit delta', () => {
  it('maandhuur (resolveMaandhuur) heeft altijd source=auto|none, geen override', () => {
    const r = resolveMaandhuur(72000);
    expect(r.source).toBe('auto');
    expect(r.override).toBeNull();
    expect(r.delta).toBeNull();
  });

  it('€/m² (resolvePricePerM2) heeft altijd source=auto|none, geen override', () => {
    const r = resolvePricePerM2(1_000_000, 500);
    expect(r.source).toBe('auto');
    expect(r.override).toBeNull();
    expect(r.delta).toBeNull();
  });
});

describe('Fase 2B — geen NaN/Infinity in delta-output', () => {
  it('delta blijft finite of null bij edge-inputs', () => {
    const cases = [
      resolveBAR(0, 1000, 5),
      resolveBAR(1000, 0, 5),
      resolveBAR(NaN as unknown as number, 1000, 5),
      resolveDerived(null, 5),
      resolveDerived(6, Infinity as unknown as number),
      resolveDerived(6, NaN as unknown as number),
    ];
    for (const r of cases) {
      if (r.delta !== null) expect(Number.isFinite(r.delta)).toBe(true);
      expect(r.value === null || Number.isFinite(r.value)).toBe(true);
    }
  });
});
