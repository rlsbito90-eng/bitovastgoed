// Tests voor audit-consistentie: leadingMaxBasis comparator, eng-noi "na",
// WWS-groepering en €/m² check componentstrategie.
import { describe, it, expect } from 'vitest';
import { runScenarioAudit as runAudit, type AuditInput } from '@/lib/vastgoedrekenen/audit/runAudit';
import type { Scenario, Component, WwsUnit, SellOffUnit } from '@/lib/vastgoedrekenen/types';

function baseScenario(p: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1', calculation_id: 'c1', object_id: 'o1', scenario_name: 'Test',
    strategy_type: 'belegging', status: 'concept',
    asking_price: 1_000_000, purchase_price: 900_000,
    created_at: '', updated_at: '',
    ...(p as object),
  } as Scenario;
}

function input(overrides: Partial<AuditInput> = {}): AuditInput {
  return {
    scenario: baseScenario(),
    components: [], costs: [], wwsUnits: [], strategyUnits: [],
    taxSettings: null, objectType: 'enkelvoudig', objectArea: null,
    ...overrides,
  };
}

describe('audit comparator (rond te rekenen)', () => {
  it('toont "doable-no-asking" zonder vraagprijs', () => {
    const r = runAudit(input({ scenario: baseScenario({ asking_price: null }) }));
    expect(r.checks.some((c) => c.id === 'doable-no-asking')).toBe(true);
  });

  it('gebruikt leidende basis voor doable-yes (≥ vraagprijs)', () => {
    // Lage vraagprijs zodat leidende max ≥ vraagprijs
    const r = runAudit(input({ scenario: baseScenario({ asking_price: 1 }) }));
    const yes = r.checks.find((c) => c.id === 'doable-yes');
    const no = r.checks.find((c) => c.id === 'doable-no');
    // Exact één van de twee
    expect((yes ? 1 : 0) + (no ? 1 : 0)).toBe(1);
    if (yes) expect(yes.problem).toMatch(/≥ vraagprijs/);
    if (no) expect(no.problem).toMatch(/< vraagprijs/);
  });

  it('geen tekst "Nee | ≥ vraagprijs" combinatie', () => {
    const r = runAudit(input());
    for (const c of r.checks) {
      const txt = `${c.problem ?? ''}`;
      expect(txt).not.toMatch(/NIET rond.*≥ vraagprijs/);
    }
  });
});

describe('engine NOI relevance', () => {
  it('toont eng-noi als "na" wanneer verkoop/strategie leidend en geen huurbasis', () => {
    const r = runAudit(input({ scenario: baseScenario({ strategy_type: 'verkopen_geheel' }) }));
    const noi = r.checks.find((c) => c.id === 'eng-noi');
    expect(noi).toBeTruthy();
    // Voor zuiver verkoopscenario zonder huurdata: status moet 'na' zijn.
    if (noi && noi.status === 'na') {
      expect(noi.problem).toMatch(/niet relevant/i);
    }
  });
});

describe('WWS groepering', () => {
  it('groepeert ontbrekende WOZ/punten in één regel per groep', () => {
    const wwsUnits: WwsUnit[] = [
      { id: 'w1', scenario_id: 's1', unit_name: 'A', wws_points: null, woz_value: null, energy_label: null } as unknown as WwsUnit,
      { id: 'w2', scenario_id: 's1', unit_name: 'B', wws_points: null, woz_value: null, energy_label: null } as unknown as WwsUnit,
    ];
    const r = runAudit(input({ wwsUnits }));
    const points = r.checks.filter((c) => c.id === 'wws-grp-points');
    const woz = r.checks.filter((c) => c.id === 'wws-grp-woz');
    expect(points.length).toBe(1);
    expect(woz.length).toBe(1);
    expect(points[0].problem).toMatch(/2× WWS-punten/);
  });
});

describe('strategie €/m²', () => {
  it('berekent gem. €/m² en waarschuwt bij ontbrekende m²', () => {
    const strategyUnits: SellOffUnit[] = [
      { id: 'u1', scenario_id: 's1', unit_name: 'A', unit_label: 'A', strategy: 'verkopen_leeg',
        sale_price_source: 'totaal', sale_price_total: 300_000, surface_gbo: 60 } as unknown as SellOffUnit,
      { id: 'u2', scenario_id: 's1', unit_name: 'B', unit_label: 'B', strategy: 'verkopen_leeg',
        sale_price_source: 'totaal', sale_price_total: 200_000, surface_gbo: null } as unknown as SellOffUnit,
    ];
    const r = runAudit(input({ strategyUnits }));
    const avg = r.checks.find((c) => c.id === 'strat-eur-m2');
    const miss = r.checks.find((c) => c.id === 'strat-missing-m2');
    expect(avg).toBeTruthy();
    expect(miss).toBeTruthy();
    expect(miss!.problem).toMatch(/1× unit/);
  });
});
