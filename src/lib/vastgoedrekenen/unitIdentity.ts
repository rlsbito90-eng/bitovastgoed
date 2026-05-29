// Gedeelde helper voor unit-identiteit door de hele Vastgoedrekenen-module.
// Doel: overal hetzelfde label tonen voor dezelfde unit, of die nu in
// Componenten, WWS of Componentstrategie verschijnt.
//
// Standaardformaat: "01 — 92A · appartement · 85 m²"

export type UnitIdentitySource = {
  /** Vrije label zoals door de gebruiker ingevuld (bv. "92A"). */
  label?: string | null;
  /** Fallback naam (bv. WWS unit_name of component_name). */
  name?: string | null;
  /** Type of subtype (bv. "appartement", "winkelruimte"). */
  type?: string | null;
  /** Oppervlakte in m² (GBO/VVO/woonoppervlak). */
  surface?: number | null;
};

export type UnitIdentity = {
  /** Tweecijferige index, bv. "01". */
  indexStr: string;
  /** Hoofdlabel ("92A" of fallback). */
  primary: string;
  /** Meta-segmenten zoals ["appartement", "85 m²"]. */
  meta: string[];
  /** Volledig samengesteld label, bv. "01 — 92A · appartement · 85 m²". */
  full: string;
};

export function formatUnitIdentity(src: UnitIdentitySource, index: number): UnitIdentity {
  const indexStr = String(index + 1).padStart(2, '0');
  const primaryRaw = (src.label ?? '').toString().trim() || (src.name ?? '').toString().trim() || 'Unit';
  const meta: string[] = [];
  const type = (src.type ?? '').toString().trim();
  if (type) meta.push(type);
  if (src.surface && src.surface > 0) meta.push(`${src.surface} m²`);
  const right = [primaryRaw, ...meta].join(' · ');
  return { indexStr, primary: primaryRaw, meta, full: `${indexStr} — ${right}` };
}
