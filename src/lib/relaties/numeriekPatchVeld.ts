/** Partial PATCH semantics for nullable numeric columns.
 * Property absent => omit from SQL. Property present but empty => write NULL.
 * Avoids clearing an existing budget/rendement when editing unrelated fields.
 */
export function numeriekPatchVeld<T extends object,K extends keyof T>(
  wijzigingen:T, sleutel:K,
):T[K]|null|undefined {
  return Object.prototype.hasOwnProperty.call(wijzigingen,sleutel)
    ? (wijzigingen[sleutel] ?? null)
    : undefined;
}
