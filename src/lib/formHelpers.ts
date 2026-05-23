// Algemene helpers voor formulieren.
// Doel: app-breed consistent omgaan met lege/optionele invoer.

/** Sentinel-waarde voor "geen/leeg" in Select-componenten die geen lege string accepteren. */
export const NONE_VALUE = '__none__';

/** Parse een input-string naar number | undefined. Lege string = undefined. */
export function parseNumOrUndef(v: string): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Map een Select-waarde terug naar string | undefined (NONE_VALUE → undefined). */
export function selectValueOrUndef(v: string): string | undefined {
  return !v || v === NONE_VALUE ? undefined : v;
}

/** Toon waarde voor controlled input: undefined/null → '' . */
export function showVal<T extends string | number | undefined | null>(v: T): string {
  return v == null ? '' : String(v);
}
