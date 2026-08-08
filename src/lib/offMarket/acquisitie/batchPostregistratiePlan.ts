import type { PrintbatchContract } from './productiekernContract';

export interface BatchPostregistratieItem {
  briefId: string;
  briefVersieId: string;
  gepost: boolean;
  verzenddatum: string | null;
}

export interface BatchPostregistratieCommando {
  briefId: string;
  briefVersieId: string;
  batchId: string;
  actorId: string;
  operationKey: string;
  verzenddatum: string;
}

export interface BatchPostregistratiePlan {
  batchId: string;
  commandos: BatchPostregistratieCommando[];
  overgeslagenBriefVersieIds: string[];
  gedeeltelijkGepost: boolean;
  volledigGepost: boolean;
}

/**
 * Bouwt expliciete postcommando’s per briefversie. Geprint impliceert nooit
 * gepost; alleen aangevinkte items met een verzenddatum leveren een commando op.
 */
export function bouwBatchPostregistratiePlan(input: {
  batch: PrintbatchContract;
  items: readonly BatchPostregistratieItem[];
  actorId: string;
  operationKeyPrefix: string;
}): BatchPostregistratiePlan {
  if (input.batch.status !== 'geprint' && input.batch.status !== 'gedeeltelijk_gepost') {
    throw new Error('Postregistratie vereist een geprinte of gedeeltelijk geposte batch.');
  }
  if (!input.batch.printdatum) throw new Error('Postregistratie vereist een vastgelegde printdatum.');
  if (!input.actorId.trim()) throw new Error('Actor is verplicht voor postregistratie.');
  if (!input.operationKeyPrefix.trim()) throw new Error('Operation-keyprefix is verplicht.');
  if (input.items.length === 0) throw new Error('Postregistratie vereist minimaal één briefversie.');

  const briefIds = new Set<string>();
  const versieIds = new Set<string>();
  const commandos: BatchPostregistratieCommando[] = [];
  const overgeslagenBriefVersieIds: string[] = [];

  input.items.forEach((item, index) => {
    if (!item.briefId.trim() || !item.briefVersieId.trim()) {
      throw new Error('Brief-ID en briefversie-ID zijn verplicht voor postregistratie.');
    }
    if (briefIds.has(item.briefId)) throw new Error(`Brief dubbel in postregistratie: ${item.briefId}.`);
    if (versieIds.has(item.briefVersieId)) throw new Error(`Briefversie dubbel in postregistratie: ${item.briefVersieId}.`);
    briefIds.add(item.briefId);
    versieIds.add(item.briefVersieId);

    if (!item.gepost) {
      if (item.verzenddatum !== null) throw new Error(`Niet-geposte briefversie ${item.briefVersieId} heeft toch een verzenddatum.`);
      overgeslagenBriefVersieIds.push(item.briefVersieId);
      return;
    }
    if (!item.verzenddatum) throw new Error(`Geposte briefversie ${item.briefVersieId} mist een verzenddatum.`);
    const verzendMs = Date.parse(item.verzenddatum);
    const printMs = Date.parse(input.batch.printdatum!);
    if (!Number.isFinite(verzendMs) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(item.verzenddatum)) {
      throw new Error(`Verzenddatum van ${item.briefVersieId} is ongeldig.`);
    }
    if (verzendMs < printMs) throw new Error(`Verzenddatum van ${item.briefVersieId} ligt vóór de printdatum.`);

    commandos.push({
      briefId: item.briefId,
      briefVersieId: item.briefVersieId,
      batchId: input.batch.id,
      actorId: input.actorId.trim(),
      operationKey: `${input.operationKeyPrefix.trim()}:${index + 1}:${item.briefVersieId}`,
      verzenddatum: item.verzenddatum,
    });
  });

  return {
    batchId: input.batch.id,
    commandos,
    overgeslagenBriefVersieIds,
    gedeeltelijkGepost: commandos.length > 0 && overgeslagenBriefVersieIds.length > 0,
    volledigGepost: commandos.length === input.items.length,
  };
}
