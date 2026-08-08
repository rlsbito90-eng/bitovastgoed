import type { AcquisitieNaPostUseCaseMetAuditResultaat } from './acquisitieNaPostUseCaseMetAudit';

export type AcquisitieNaPostActie =
  | 'geen'
  | 'postregistratie_herstellen'
  | 'opvolging_herstellen'
  | 'dossierbijwerking_herstellen'
  | 'audit_herstellen';

export interface AcquisitieNaPostActiestatus {
  actie: AcquisitieNaPostActie;
  titel: string;
  toelichting: string;
  werkbak: string;
  bedrijfsverwerkingGereed: boolean;
  volledigAfgerond: boolean;
  blokkeertVervolg: boolean;
  aantalMislukt: number;
  operationKey: string | null;
}

/**
 * Vertaalt de technische na-postuitkomst naar één privacyveilige,
 * gebruikersgerichte actiestatus. De bronvolgorde blijft strikt: posten,
 * opvolging, dossierbijwerking en pas daarna audit. Daardoor wordt nooit een
 * secundaire fout getoond terwijl een eerdere bedrijfsstap nog onvolledig is.
 */
export function projecteerAcquisitieNaPostActiestatus(
  input: AcquisitieNaPostUseCaseMetAuditResultaat,
): AcquisitieNaPostActiestatus {
  const postMislukt = input.resultaat.orchestratie.postregistratie.mislukteCommandos.length;
  if (postMislukt > 0) {
    return Object.freeze({
      actie: 'postregistratie_herstellen',
      titel: 'Postregistratie afronden',
      toelichting: 'Niet alle expliciet geposte brieven zijn administratief verwerkt.',
      werkbak: input.resultaat.projectie.werkbak,
      bedrijfsverwerkingGereed: false,
      volledigAfgerond: false,
      blokkeertVervolg: true,
      aantalMislukt: postMislukt,
      operationKey: null,
    });
  }

  const opvolgMislukt = input.resultaat.orchestratie.opvolgUitkomst?.misluktAantal ?? 0;
  if (opvolgMislukt > 0) {
    return Object.freeze({
      actie: 'opvolging_herstellen',
      titel: 'Opvolgtaken afronden',
      toelichting: 'Eén of meer opvolgtaken zijn nog niet aangemaakt.',
      werkbak: input.resultaat.projectie.werkbak,
      bedrijfsverwerkingGereed: false,
      volledigAfgerond: false,
      blokkeertVervolg: true,
      aantalMislukt: opvolgMislukt,
      operationKey: null,
    });
  }

  if (!input.resultaat.dossierUitkomst.geslaagd) {
    return Object.freeze({
      actie: 'dossierbijwerking_herstellen',
      titel: 'Dossierstatus bijwerken',
      toelichting: 'De verzending en opvolging zijn verwerkt, maar de dossierprojectie ontbreekt.',
      werkbak: input.resultaat.projectie.werkbak,
      bedrijfsverwerkingGereed: false,
      volledigAfgerond: false,
      blokkeertVervolg: true,
      aantalMislukt: 1,
      operationKey: input.resultaat.dossierCommando.operationKey,
    });
  }

  if (!input.audit.geslaagd) {
    return Object.freeze({
      actie: 'audit_herstellen',
      titel: 'Auditregistratie herstellen',
      toelichting: 'De bedrijfsverwerking is afgerond; alleen de auditregistratie moet opnieuw.',
      werkbak: input.resultaat.projectie.werkbak,
      bedrijfsverwerkingGereed: true,
      volledigAfgerond: false,
      blokkeertVervolg: false,
      aantalMislukt: 1,
      operationKey: input.auditRecord.operationKey,
    });
  }

  return Object.freeze({
    actie: 'geen',
    titel: 'Verzending verwerkt',
    toelichting: 'Postregistratie, opvolging, dossierbijwerking en audit zijn afgerond.',
    werkbak: input.resultaat.projectie.werkbak,
    bedrijfsverwerkingGereed: true,
    volledigAfgerond: true,
    blokkeertVervolg: false,
    aantalMislukt: 0,
    operationKey: null,
  });
}
