import type {
  BatchPostregistratieCommando,
  BatchPostregistratiePlan,
} from './batchPostregistratiePlan';

export interface BatchPostregistratieUitkomst {
  operationKey: string;
  geslaagd: boolean;
  foutcode: string | null;
}

export interface BatchPostregistratieResultaat {
  batchId: string;
  geslaagdeCommandos: BatchPostregistratieCommando[];
  mislukteCommandos: BatchPostregistratieCommando[];
  retryCommandos: BatchPostregistratieCommando[];
  volgendeBatchstatus: 'geprint' | 'gedeeltelijk_gepost' | 'gepost';
  volledigVerwerkt: boolean;
}

/**
 * Verzoent uitsluitend uitkomsten met de vooraf gebouwde commando's. Onbekende,
 * dubbele of ontbrekende uitkomsten worden fail-closed geweigerd.
 */
export function verzoenBatchPostregistratieResultaat(input: {
  plan: BatchPostregistratiePlan;
  uitkomsten: readonly BatchPostregistratieUitkomst[];
}): BatchPostregistratieResultaat {
  const commandos = new Map(input.plan.commandos.map((commando) => [commando.operationKey, commando]));
  const gezien = new Set<string>();
  const geslaagdeCommandos: BatchPostregistratieCommando[] = [];
  const mislukteCommandos: BatchPostregistratieCommando[] = [];

  for (const uitkomst of input.uitkomsten) {
    if (!uitkomst.operationKey.trim()) throw new Error('Postuitkomst mist een operation key.');
    if (gezien.has(uitkomst.operationKey)) {
      throw new Error(`Dubbele postuitkomst voor ${uitkomst.operationKey}.`);
    }
    gezien.add(uitkomst.operationKey);
    const commando = commandos.get(uitkomst.operationKey);
    if (!commando) throw new Error(`Onbekende postuitkomst voor ${uitkomst.operationKey}.`);
    if (uitkomst.geslaagd && uitkomst.foutcode !== null) {
      throw new Error(`Geslaagde postuitkomst ${uitkomst.operationKey} bevat een foutcode.`);
    }
    if (!uitkomst.geslaagd && !uitkomst.foutcode?.trim()) {
      throw new Error(`Mislukte postuitkomst ${uitkomst.operationKey} mist een foutcode.`);
    }
    (uitkomst.geslaagd ? geslaagdeCommandos : mislukteCommandos).push(commando);
  }

  if (gezien.size !== commandos.size) {
    const ontbrekend = [...commandos.keys()].filter((key) => !gezien.has(key));
    throw new Error(`Postuitkomsten ontbreken voor: ${ontbrekend.join(', ')}.`);
  }

  const totaalItems = input.plan.commandos.length + input.plan.overgeslagenBriefVersieIds.length;
  const volledigGepost = totaalItems > 0 && geslaagdeCommandos.length === totaalItems;
  const deelsGepost = geslaagdeCommandos.length > 0 && !volledigGepost;

  return {
    batchId: input.plan.batchId,
    geslaagdeCommandos,
    mislukteCommandos,
    retryCommandos: [...mislukteCommandos],
    volgendeBatchstatus: volledigGepost
      ? 'gepost'
      : deelsGepost
        ? 'gedeeltelijk_gepost'
        : 'geprint',
    volledigVerwerkt: mislukteCommandos.length === 0 && input.plan.overgeslagenBriefVersieIds.length === 0,
  };
}
