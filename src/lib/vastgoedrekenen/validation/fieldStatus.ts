// Expliciete statusbepaling per veld om "stille nullen" te voorkomen.
// Onderscheidt leeg, bewust-nul, default-aanname, handmatig en ingevuld.
//
// Geen rekenlogica — alleen interpretatie van invoer.

export type FieldStatus = 'ingevuld' | 'leeg' | 'bewust_nul' | 'default' | 'handmatig';

export interface FieldStatusOptions {
  /** Veldnaam staat in een lijst van bewust-op-nul-gezette velden (uit assumptions_source). */
  hasManualZeroMarker?: boolean;
  /** Waarde komt uit een systeemdefault (profiel) en niet uit gebruikersinvoer. */
  defaultUsed?: boolean;
  /** Gebruiker heeft expliciet handmatig overschreven. */
  manualOverride?: boolean;
}

const isEmpty = (v: unknown): boolean => v == null || v === '' || (typeof v === 'string' && v.trim() === '');

export function fieldStatus(value: unknown, opts: FieldStatusOptions = {}): FieldStatus {
  if (isEmpty(value)) return 'leeg';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n) && n === 0) {
    if (opts.hasManualZeroMarker) return 'bewust_nul';
    // Stille nul — tellen als "leeg" zodat validatie kan waarschuwen.
    return 'leeg';
  }
  if (opts.manualOverride) return 'handmatig';
  if (opts.defaultUsed) return 'default';
  return 'ingevuld';
}

export function isFilled(status: FieldStatus): boolean {
  return status === 'ingevuld' || status === 'handmatig' || status === 'bewust_nul' || status === 'default';
}

export function isHardMissing(status: FieldStatus): boolean {
  return status === 'leeg';
}

/** Leest de lijst met bewust-op-nul markers uit scenario.assumptions_source (JSON). */
export function readManualZeroFields(assumptionsSource: unknown): Set<string> {
  if (!assumptionsSource || typeof assumptionsSource !== 'object') return new Set();
  const rec = assumptionsSource as Record<string, unknown>;
  const arr = rec.manual_zero_fields;
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.filter((x): x is string => typeof x === 'string'));
}

/** Label voor in de UI. */
export const FIELD_STATUS_LABEL: Record<FieldStatus, string> = {
  ingevuld: 'Ingevuld',
  leeg: 'Ontbreekt',
  bewust_nul: 'Bewust € 0',
  default: 'Systeemaanname',
  handmatig: 'Handmatig',
};
