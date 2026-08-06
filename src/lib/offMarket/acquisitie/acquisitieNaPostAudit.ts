import type { AcquisitieNaPostHerstelUitkomst } from './acquisitieNaPostHerstelUitvoerder';
import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';

export type AcquisitieNaPostAuditType =
  | 'na_post_verwerkt'
  | 'postregistratie_onvolledig'
  | 'opvolging_onvolledig'
  | 'dossierbijwerking_mislukt'
  | 'herstel_uitgevoerd'
  | 'handmatige_interventie_nodig';

export interface AcquisitieNaPostAuditRecord {
  type: AcquisitieNaPostAuditType;
  selectieId: string;
  batchId: string;
  actorId: string;
  operationKey: string;
  geregistreerdOp: string;
  kenmerken: Readonly<Record<string, string | number | boolean | null>>;
}

function verplichtVeld(waarde: string, naam: string, maximum = 200): string {
  const schoon = waarde.trim();
  if (!schoon) throw new Error(`${naam} is verplicht voor het auditrecord.`);
  if (schoon.length > maximum) throw new Error(`${naam} mag maximaal ${maximum} tekens bevatten.`);
  if (/[\u0000-\u001f\u007f]/.test(schoon)) throw new Error(`${naam} bevat ongeldige controletekens.`);
  return schoon;
}

function canoniekUtc(waarde: string): string {
  const tijd = Date.parse(waarde);
  if (!Number.isFinite(tijd) || new Date(tijd).toISOString() !== waarde) {
    throw new Error('Auditregistratietijd moet canoniek UTC zijn.');
  }
  return waarde;
}

/**
 * Maakt één privacyveilig auditrecord van de volledige na-post-use-case.
 * Vrije foutmeldingen, adresgegevens en briefinhoud worden bewust niet opgenomen.
 */
export function bouwAcquisitieNaPostAuditRecord(input: {
  selectieId: string;
  actorId: string;
  geregistreerdOp: string;
  resultaat: AcquisitieNaPostUseCaseResultaat;
}): AcquisitieNaPostAuditRecord {
  const selectieId = verplichtVeld(input.selectieId, 'Selectie-ID');
  const actorId = verplichtVeld(input.actorId, 'Actor-ID');
  const geregistreerdOp = canoniekUtc(input.geregistreerdOp);
  const batchId = verplichtVeld(input.resultaat.orchestratie.postregistratie.batchId, 'Batch-ID');
  const operationKey = verplichtVeld(input.resultaat.dossierCommando.operationKey, 'Operation key');

  const postMislukt = input.resultaat.orchestratie.postregistratie.mislukteCommandos.length;
  const opvolgMislukt = input.resultaat.orchestratie.opvolgUitkomst?.misluktAantal ?? 0;

  const type: AcquisitieNaPostAuditType = postMislukt > 0
    ? 'postregistratie_onvolledig'
    : opvolgMislukt > 0
      ? 'opvolging_onvolledig'
      : !input.resultaat.dossierUitkomst.geslaagd
        ? 'dossierbijwerking_mislukt'
        : 'na_post_verwerkt';

  return Object.freeze({
    type,
    selectieId,
    batchId,
    actorId,
    operationKey,
    geregistreerdOp,
    kenmerken: Object.freeze({
      succesvolGepost: input.resultaat.projectie.succesvolGepost,
      postregistratieMislukt: postMislukt,
      opvolgtakenGeslaagd: input.resultaat.projectie.opvolgtakenGeslaagd,
      opvolgtakenMislukt: opvolgMislukt,
      dossierBijgewerkt: input.resultaat.dossierUitkomst.geslaagd,
      werkbak: input.resultaat.projectie.werkbak,
      opvolgenOp: input.resultaat.projectie.opvolgenOp,
    }),
  });
}

/** Bouwt een aanvullend auditrecord voor een herstelpoging of escalatie. */
export function bouwAcquisitieNaPostHerstelAuditRecord(input: {
  selectieId: string;
  batchId: string;
  actorId: string;
  operationKey: string;
  geregistreerdOp: string;
  uitkomst: AcquisitieNaPostHerstelUitkomst;
}): AcquisitieNaPostAuditRecord {
  const type: AcquisitieNaPostAuditType = input.uitkomst.actie === 'handmatige_interventie'
    ? 'handmatige_interventie_nodig'
    : 'herstel_uitgevoerd';

  return Object.freeze({
    type,
    selectieId: verplichtVeld(input.selectieId, 'Selectie-ID'),
    batchId: verplichtVeld(input.batchId, 'Batch-ID'),
    actorId: verplichtVeld(input.actorId, 'Actor-ID'),
    operationKey: verplichtVeld(input.operationKey, 'Operation key'),
    geregistreerdOp: canoniekUtc(input.geregistreerdOp),
    kenmerken: Object.freeze({
      herstelactie: input.uitkomst.actie,
      uitgevoerd: input.uitkomst.uitgevoerd,
      postregistratieMislukt: input.uitkomst.postregistratie?.mislukteCommandos.length ?? 0,
      opvolgtakenMislukt: input.uitkomst.opvolging?.misluktAantal ?? 0,
      dossierBijgewerkt: input.uitkomst.dossier?.geslaagd ?? null,
    }),
  });
}
