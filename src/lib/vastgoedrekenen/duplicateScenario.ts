type CloneableRow = Record<string, unknown>;

const DATABASE_IDENTITY_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
]);

/**
 * Maakt een veilige insert-payload van een bestaande database-row.
 * Database-identiteit en timestamps worden nooit overgenomen.
 */
export function stripCloneIdentity<T extends CloneableRow>(row: T): CloneableRow {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !DATABASE_IDENTITY_FIELDS.has(key)),
  );
}

/** Geeft een unieke, herkenbare naam voor een scenariokopie. */
export function nextScenarioCopyName(sourceName: string, existingNames: string[]): string {
  const trimmed = sourceName.trim() || 'Scenario';
  const base = trimmed.replace(/\s+\(kopie(?:\s+\d+)?\)$/i, '').trim() || 'Scenario';
  const used = new Set(existingNames.map((name) => name.trim().toLocaleLowerCase('nl-NL')));

  const first = `${base} (kopie)`;
  if (!used.has(first.toLocaleLowerCase('nl-NL'))) return first;

  let index = 2;
  while (used.has(`${base} (kopie ${index})`.toLocaleLowerCase('nl-NL'))) index += 1;
  return `${base} (kopie ${index})`;
}

/**
 * Bouwt een child-payload voor een nieuw scenario en zet een eventuele
 * componentkoppeling om naar het gekloonde component.
 */
export function buildScenarioChildClone(
  row: CloneableRow,
  newScenarioId: string,
  componentIdMap: ReadonlyMap<string, string> = new Map(),
): CloneableRow {
  const payload = stripCloneIdentity(row);
  payload.scenario_id = newScenarioId;

  const oldComponentId = typeof payload.component_id === 'string'
    ? payload.component_id
    : null;
  if (oldComponentId) payload.component_id = componentIdMap.get(oldComponentId) ?? null;

  return payload;
}
