// Centrale, herbruikbare logica voor het toevoegen van een pipelinekandidaat.
//
// Achtergrond: `object_pipeline` heeft een UNIQUE (object_id, relatie_id) en
// verwijderen gebeurt via `soft_deleted_at`. Een nieuwe INSERT voor dezelfde
// combinatie botst dan op 23505. Daarom: eerst reactiveren, anders invoegen.

export type PipelineDbRij = { id: string; soft_deleted_at?: string | null };

/**
 * Bouw de payload voor het reactiveren van een soft-deleted rij.
 * Null/undefined-waarden worden weggelaten zodat bestaande historie
 * (notities, datums, bedragen) niet destructief wordt gewist.
 */
export function bouwReactivatiePayload(dbPayload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dbPayload ?? {})) {
    if (value === null || value === undefined) continue;
    out[key] = value;
  }
  out.soft_deleted_at = null;
  return out;
}

/** Fout die door `beschrijfKandidaatFout` als duplicaat wordt herkend. */
export function maakDuplicaatFout(): Error {
  return Object.assign(
    new Error('duplicate key value violates unique constraint on object_pipeline'),
    { code: '23505' },
  );
}

export type KandidaatToevoegDeps<TRow> = {
  /** Zoek een bestaande rij (actief óf soft-deleted) voor exact deze combinatie. */
  vindBestaande: () => Promise<PipelineDbRij | null>;
  /** Herstel de soft-deleted rij en geef de bijgewerkte rij terug. */
  reactiveer: (id: string) => Promise<TRow>;
  /** Voeg een nieuwe rij toe. */
  insert: () => Promise<TRow>;
};

export type KandidaatToevoegResultaat<TRow> = { rij: TRow; gereactiveerd: boolean };

/**
 * Race-safe volgorde: bestaande rij opzoeken → actief = duplicaat,
 * soft-deleted = reactiveren, anders insert. Een gelijktijdig unique-conflict
 * komt via de insert alsnog als 23505 terug.
 */
export async function voerKandidaatToevoegingUit<TRow>(
  deps: KandidaatToevoegDeps<TRow>,
): Promise<KandidaatToevoegResultaat<TRow>> {
  const bestaande = await deps.vindBestaande();
  if (bestaande) {
    if (!bestaande.soft_deleted_at) throw maakDuplicaatFout();
    return { rij: await deps.reactiveer(bestaande.id), gereactiveerd: true };
  }
  return { rij: await deps.insert(), gereactiveerd: false };
}

/** Voeg de kandidaat toe aan de lokale state zonder dubbele entry. */
export function mergeKandidaatInState<T extends { id: string; objectId: string; relatieId: string }>(
  prev: T[],
  nieuw: T,
): T[] {
  const zonder = prev.filter(
    x => x.id !== nieuw.id && !(x.objectId === nieuw.objectId && x.relatieId === nieuw.relatieId),
  );
  return [nieuw, ...zonder];
}
