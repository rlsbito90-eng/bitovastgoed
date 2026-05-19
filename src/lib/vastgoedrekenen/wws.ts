// Vereenvoudigde, indicatieve WWS-puntenberekening voor V1.
// LET OP: dit is bewust geen officiële WWS-calculator.
// Doel: globale segment-indicatie (sociaal/middenhuur/vrije sector).

import type { WwsUnit } from './types';
import { VR_DEFAULTS } from './defaults';

export type WwsResult = {
  punten: number;
  maxMonthlyRent: number;
  maxAnnualRent: number;
  segment: 'sociaal' | 'middenhuur' | 'vrije_sector';
};

const KEUKEN_BONUS = { eenvoudig: 0, standaard: 4, luxe: 12, maatwerk: 20 } as const;
const BADKAMER_BONUS = { eenvoudig: 0, standaard: 6, luxe: 14, maatwerk: 22 } as const;

function energielabelPunten(label: string | null | undefined): number {
  if (!label) return 0;
  const l = label.toUpperCase().trim();
  const map: Record<string, number> = {
    'A+++++': 52, 'A++++': 48, 'A+++': 44, 'A++': 40, 'A+': 36,
    'A': 32, 'B': 28, 'C': 22, 'D': 14, 'E': 8, 'F': 4, 'G': 0,
  };
  return map[l] ?? 0;
}

function wozPunten(woz: number | null | undefined, m2: number | null | undefined): number {
  if (!woz || !m2 || m2 <= 0) return 0;
  // Sterk vereenvoudigde benadering: ~ WOZ/€10.000 + WOZ/m² / €100, gecapt op 33% van totale punten.
  const baseWoz = woz / 10000;
  const wozPerM2 = (woz / m2) / 100;
  return Math.round(baseWoz + wozPerM2);
}

export function computeWwsPoints(u: WwsUnit, euroPerPoint = VR_DEFAULTS.wwsEuroPerPoint): WwsResult {
  const woon = Number(u.living_area_m2 ?? 0);
  const overig = Number(u.other_indoor_space_m2 ?? 0);
  const buiten = Number(u.outdoor_space_m2 ?? 0);
  const kamerBonus = Math.max(0, (Number(u.rooms ?? 0) - 1)) * 1;

  const opp = woon * 1 + overig * 0.75 + Math.min(buiten * 0.35, 15);
  const keuken = KEUKEN_BONUS[(u.kitchen_quality ?? 'standaard') as keyof typeof KEUKEN_BONUS] ?? 4;
  const badkamer = BADKAMER_BONUS[(u.bathroom_quality ?? 'standaard') as keyof typeof BADKAMER_BONUS] ?? 6;
  const label = energielabelPunten(u.energy_label);
  const woz = wozPunten(u.woz_value, woon);
  const monument = u.monument_status ? 10 : 0;
  const koeling = u.cooling ? 2 : 0;
  const berging = u.storage ? 2 : 0;
  const parking = u.parking ? 4 : 0;

  const punten = Math.max(0, Math.round(opp + kamerBonus + keuken + badkamer + label + woz + monument + koeling + berging + parking));
  const maxMonthly = Math.round(punten * euroPerPoint);
  const segment: WwsResult['segment'] =
    punten <= VR_DEFAULTS.wwsSocialMaxPoints ? 'sociaal'
      : punten <= VR_DEFAULTS.wwsMidMaxPoints ? 'middenhuur'
      : 'vrije_sector';

  return { punten, maxMonthlyRent: maxMonthly, maxAnnualRent: maxMonthly * 12, segment };
}
