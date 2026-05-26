// Vaste audit-testcase voor het object Hinthamerstraat (Den Bosch).
// Niet matchend → alle checks krijgen status 'na'.

import type { Component, SellOffUnit } from '../types';
import type { AuditCheck } from './types';

export interface HinthamerInput {
  objectTitle?: string | null;
  objectAddress?: string | null;
  components: Component[];
  strategyUnits: SellOffUnit[];
}

const SECTION = 'Testcase Hinthamerstraat';

function add(checks: AuditCheck[], c: Omit<AuditCheck, 'category'>) {
  checks.push({ ...c, category: 'hinthamerstraat' });
}

export function matchesHinthamerstraat(input: HinthamerInput): boolean {
  const hay = `${input.objectTitle ?? ''} ${input.objectAddress ?? ''}`.toLowerCase();
  return hay.includes('hinthamer');
}

export function runHinthamerCheck(input: HinthamerInput): AuditCheck[] {
  const checks: AuditCheck[] = [];

  if (!matchesHinthamerstraat(input)) {
    add(checks, {
      id: 'hint-na',
      status: 'na',
      section: SECTION,
      problem: 'Object is niet de Hinthamerstraat — testcase niet toegepast.',
    });
    return checks;
  }

  const comps = input.components;
  const woon = comps.filter((c) => ['woning', 'appartement'].includes((c.component_type ?? '').toLowerCase()));
  const commercieel = comps.filter((c) => ['winkel', 'winkelruimte', 'kantoor', 'kantoorruimte', 'bedrijfsruimte', 'horeca'].includes((c.component_type ?? '').toLowerCase()));

  add(checks, {
    id: 'hint-aantal',
    status: comps.length === 8 ? 'ok' : 'warning',
    section: SECTION,
    problem: `Verwacht: 8 componenten. Gevonden: ${comps.length}.`,
    advice: comps.length !== 8 ? 'Voeg ontbrekende componenten toe (2 winkels + 6 woningen).' : undefined,
  });
  add(checks, {
    id: 'hint-woon',
    status: woon.length === 6 ? 'ok' : 'warning',
    section: SECTION,
    problem: `Verwacht 6 wooncomponenten. Gevonden: ${woon.length}.`,
  });
  add(checks, {
    id: 'hint-commercieel',
    status: commercieel.length === 2 ? 'ok' : 'warning',
    section: SECTION,
    problem: `Verwacht 2 commerciële componenten. Gevonden: ${commercieel.length}.`,
  });

  // Strategie-mix
  const units = input.strategyUnits;
  if (units.length === 0) {
    add(checks, {
      id: 'hint-strategie',
      status: 'warning',
      section: SECTION,
      problem: 'Geen componentstrategie ingericht voor dit scenario.',
      advice: 'Importeer componenten in de componentstrategie (preset "Hybride": woningen verkopen, commercieel aanhouden).',
    });
  } else {
    const woonSell = units.filter((u) => {
      const r = u as unknown as Record<string, unknown>;
      const t = String(r.unit_type ?? '').toLowerCase();
      const st = String(r.strategy ?? '');
      return ['woning', 'appartement'].includes(t) && ['verkopen_leeg', 'verkopen_verhuurd', 'renoveren_verkopen', 'splitsen_verkopen', 'transformeren_verkopen'].includes(st);
    });
    const commHold = units.filter((u) => {
      const r = u as unknown as Record<string, unknown>;
      const t = String(r.unit_type ?? '').toLowerCase();
      const st = String(r.strategy ?? '');
      return ['winkel', 'winkelruimte', 'kantoor', 'kantoorruimte', 'bedrijfsruimte', 'horeca'].includes(t) && ['aanhouden', 'renoveren_aanhouden', 'transformeren_aanhouden'].includes(st);
    });
    add(checks, {
      id: 'hint-woningen-verkopen',
      status: woonSell.length === 6 ? 'ok' : 'warning',
      section: SECTION,
      problem: `Woningen op verkopen: ${woonSell.length}/6.`,
    });
    add(checks, {
      id: 'hint-winkels-aanhouden',
      status: commHold.length === 2 ? 'ok' : 'warning',
      section: SECTION,
      problem: `Winkels op aanhouden: ${commHold.length}/2.`,
    });

    // Vereiste input per unit
    for (const u of units) {
      const r = u as unknown as Record<string, unknown>;
      const label = String(r.unit_label ?? r.unit_name ?? 'Unit');
      const st = String(r.strategy ?? '');
      const isSale = ['verkopen_leeg', 'verkopen_verhuurd', 'renoveren_verkopen', 'splitsen_verkopen', 'transformeren_verkopen'].includes(st);
      const isHold = ['aanhouden', 'renoveren_aanhouden', 'transformeren_aanhouden'].includes(st);
      if (isSale && !Number(r.sale_price_total ?? 0) && !Number(r.sale_price_per_m2 ?? 0)) {
        add(checks, {
          id: `hint-saleprice-${u.id}`,
          status: 'error',
          section: SECTION,
          record: label,
          problem: 'Verkoopwaarde ontbreekt bij verkoopstrategie.',
          advice: 'Vul sale_price_total of sale_price_per_m2 in.',
        });
      }
      if (isHold && !Number(r.hold_annual_rent ?? 0) && !Number(r.hold_monthly_rent ?? 0)) {
        add(checks, {
          id: `hint-holdrent-${u.id}`,
          status: 'error',
          section: SECTION,
          record: label,
          problem: 'Huur ontbreekt bij aanhoud-strategie.',
        });
      }
    }
  }

  return checks;
}
