// Bron- / status-helpers voor WWS-units.
//
// Geen rekenlogica: deze module bepaalt alleen WAAR de huidige
// wws_points vandaan komen (berekend / handmatig overschreven / ontbreekt),
// welk stelsel actief is, welke beleidsversie de huidige V1-berekening
// vertegenwoordigt en welke velden ontbreken voor een betrouwbare
// indicatie. Bedoeld voor transparantie in de UI en de audit.

import type { WwsUnit } from '../types';
import { computeWwsPoints } from '../wws';
import { VR_DEFAULTS } from '../defaults';

/**
 * Beleidsversie van de huidige (vereenvoudigde) WWS-berekening.
 * Verhoog dit label zodra de WWS-formule fundamenteel wijzigt.
 */
export const WWS_POLICY_VERSION = 'V1 indicatief (intern, januari 2026)';

export type WwsPointSource =
  | 'berekend'           // wws_points == computeWwsPoints(unit) (binnen tolerantie)
  | 'handmatig'          // wws_points != berekening (gebruiker overschreef)
  | 'geimporteerd'       // unit komt uit component-import (component_id gevuld) maar nog nooit handmatig
  | 'ontbreekt';         // wws_points is null

export type WwsScheme = 'zelfstandig' | 'onzelfstandig' | 'onbekend';

export type WwsReliability =
  | 'volledig'   // area + woz + label + huur + stelsel + punten allemaal aanwezig
  | 'indicatief' // punten aanwezig maar 1+ ondersteunende velden ontbreken
  | 'ontbrekend';// geen punten

export type WwsMissingField =
  | 'woon_oppervlakte'
  | 'woz'
  | 'energielabel'
  | 'huur'
  | 'stelsel'
  | 'punten';

export interface WwsUnitStatus {
  source: WwsPointSource;
  scheme: WwsScheme;
  policyVersion: string;
  reliability: WwsReliability;
  missing: WwsMissingField[];
  /** Bij handmatige overschrijving: wat de V1-berekening zou opleveren. */
  computedPoints: number | null;
}

const num = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export function getWwsUnitStatus(
  unit: WwsUnit,
  opts?: { euroPerPoint?: number },
): WwsUnitStatus {
  const r = unit as unknown as Record<string, unknown>;
  const hasArea = num(unit.living_area_m2) > 0;
  const hasWoz = num(unit.woz_value) > 0;
  const hasLabel = !!unit.energy_label && String(unit.energy_label).trim() !== '';
  const hasRent =
    num(unit.current_monthly_rent) > 0 ||
    num((r.corrected_monthly_rent as number | null) ?? 0) > 0;

  const independent = r.independent_unit as boolean | null | undefined;
  const scheme: WwsScheme =
    independent === true ? 'zelfstandig' : independent === false ? 'onzelfstandig' : 'onbekend';

  const storedPoints = unit.wws_points;
  const computed = computeWwsPoints(unit, opts?.euroPerPoint ?? VR_DEFAULTS.wwsEuroPerPoint);
  const computedPoints = computed.punten;

  let source: WwsPointSource;
  if (storedPoints == null) {
    source = 'ontbreekt';
  } else if (Math.abs(Number(storedPoints) - computedPoints) <= 1) {
    // Binnen 1 punt tolerantie = beschouwen als door CRM berekend.
    source = (r.component_id ?? null) ? 'geimporteerd' : 'berekend';
  } else {
    source = 'handmatig';
  }

  const missing: WwsMissingField[] = [];
  if (!hasArea) missing.push('woon_oppervlakte');
  if (!hasWoz) missing.push('woz');
  if (!hasLabel) missing.push('energielabel');
  if (!hasRent) missing.push('huur');
  if (scheme === 'onbekend') missing.push('stelsel');
  if (storedPoints == null) missing.push('punten');

  const reliability: WwsReliability =
    storedPoints == null
      ? 'ontbrekend'
      : missing.length === 0
        ? 'volledig'
        : 'indicatief';

  return {
    source,
    scheme,
    policyVersion: WWS_POLICY_VERSION,
    reliability,
    missing,
    computedPoints,
  };
}

export const WWS_SOURCE_LABEL: Record<WwsPointSource, string> = {
  berekend: 'Berekend door CRM (V1, indicatief)',
  handmatig: 'Handmatig overschreven',
  geimporteerd: 'Berekend uit geïmporteerde component',
  ontbreekt: 'Ontbreekt — geen punten opgeslagen',
};

export const WWS_SCHEME_LABEL: Record<WwsScheme, string> = {
  zelfstandig: 'Zelfstandige woonruimte',
  onzelfstandig: 'Onzelfstandige woonruimte (kamer)',
  onbekend: 'Stelsel niet gekozen',
};

/** Korte status voor tabellen en chips; dezelfde termen als in detailweergave. */
export const WWS_RELIABILITY_SHORT_LABEL: Record<WwsReliability, string> = {
  volledig: 'Volledig',
  indicatief: 'Indicatief',
  ontbrekend: 'Incompleet',
};

export const WWS_RELIABILITY_LABEL: Record<WwsReliability, string> = {
  volledig: 'Volledig — alle ondersteunende velden ingevuld',
  indicatief: 'Indicatief — punten aanwezig, maar onderbouwing niet compleet',
  ontbrekend: 'Incompleet — WWS-punten ontbreken',
};

export const WWS_MISSING_LABEL: Record<WwsMissingField, string> = {
  woon_oppervlakte: 'Woonoppervlakte (m²)',
  woz: 'WOZ-waarde',
  energielabel: 'Energielabel',
  huur: 'Huur',
  stelsel: 'Zelfstandig/onzelfstandig',
  punten: 'WWS-punten',
};
