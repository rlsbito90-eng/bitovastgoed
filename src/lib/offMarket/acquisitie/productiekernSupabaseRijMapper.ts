import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  GeadresseerdeSnapshot,
  InhoudSnapshot,
  PrintbatchBriefContract,
  PrintbatchContract,
} from './productiekernContract';
import type { OperationeleWerkbak } from './operationeleWerkbak';

export class ProductiekernRijOngeldigError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_RIJ_ONGELDIG';

  constructor(entiteit: string, reden: string) {
    super(`${entiteit}-rij is ongeldig: ${reden}`);
    this.name = 'ProductiekernRijOngeldigError';
  }
}

type Rij = Record<string, unknown>;

const WERKBAKKEN = new Set<OperationeleWerkbak>([
  'nieuwe_selectie', 'eigenaar_achterhalen', 'brief_opstellen', 'printklaar',
  'geprint_posten', 'opvolgen', 'wachten', 'afgehandeld',
]);
const BRIEFSTATUSSEN = new Set(['concept', 'definitief', 'geannuleerd']);
const VERSIESTATUSSEN = new Set(['actief', 'vervallen', 'verzonden']);
const BATCHSTATUSSEN = new Set([
  'concept', 'documenten_gegenereerd', 'geprint', 'gedeeltelijk_gepost',
  'gepost', 'geannuleerd',
]);

function tekst(rij: Rij, veld: string, entiteit: string): string {
  const waarde = rij[veld];
  if (typeof waarde !== 'string' || !waarde.trim()) {
    throw new ProductiekernRijOngeldigError(entiteit, `${veld} ontbreekt`);
  }
  return waarde;
}
function nullableTekst(rij: Rij, veld: string, entiteit: string): string | null {
  const waarde = rij[veld];
  if (waarde === null || waarde === undefined) return null;
  if (typeof waarde !== 'string') {
    throw new ProductiekernRijOngeldigError(entiteit, `${veld} is geen tekst`);
  }
  return waarde;
}
function geheelGetal(rij: Rij, veld: string, entiteit: string): number {
  const waarde = rij[veld];
  if (typeof waarde !== 'number' || !Number.isInteger(waarde)) {
    throw new ProductiekernRijOngeldigError(entiteit, `${veld} is geen geheel getal`);
  }
  return waarde;
}
function nullableGeheelGetal(rij: Rij, veld: string, entiteit: string): number | null {
  if (rij[veld] === null || rij[veld] === undefined) return null;
  return geheelGetal(rij, veld, entiteit);
}
function object(rij: Rij, veld: string, entiteit: string): Record<string, unknown> {
  const waarde = rij[veld];
  if (!waarde || typeof waarde !== 'object' || Array.isArray(waarde)) {
    throw new ProductiekernRijOngeldigError(entiteit, `${veld} is geen object`);
  }
  return waarde as Record<string, unknown>;
}
function enumWaarde<T extends string>(
  rij: Rij,
  veld: string,
  toegestaan: ReadonlySet<string>,
  entiteit: string,
): T {
  const waarde = tekst(rij, veld, entiteit);
  if (!toegestaan.has(waarde)) {
    throw new ProductiekernRijOngeldigError(entiteit, `${veld} bevat een onbekende waarde`);
  }
  return waarde as T;
}

export function mapAcquisitiedossierRij(rij: Rij): AcquisitiedossierContract {
  return {
    selectieId: tekst(rij, 'selectie_id', 'Acquisitiedossier'),
    signaalId: tekst(rij, 'signaal_id', 'Acquisitiedossier'),
    objectId: nullableTekst(rij, 'object_id', 'Acquisitiedossier'),
    verwerkingGestartOp: nullableTekst(rij, 'verwerking_gestart_op', 'Acquisitiedossier'),
    verwerkingGestartDoor: nullableTekst(rij, 'verwerking_gestart_door', 'Acquisitiedossier'),
    primaireWerkbak: enumWaarde(rij, 'primaire_werkbak', WERKBAKKEN, 'Acquisitiedossier'),
    volgendeActieOp: nullableTekst(rij, 'volgende_actie_op', 'Acquisitiedossier'),
    volgendeActieOmschrijving: nullableTekst(rij, 'volgende_actie_omschrijving', 'Acquisitiedossier'),
  };
}

export function mapBriefRij(rij: Rij): BriefContract {
  return {
    id: tekst(rij, 'id', 'Brief'),
    briefnummer: nullableTekst(rij, 'briefnummer', 'Brief'),
    signaalId: tekst(rij, 'signaal_id', 'Brief'),
    selectieId: nullableTekst(rij, 'selectie_id', 'Brief'),
    objectId: nullableTekst(rij, 'object_id', 'Brief'),
    relatieId: nullableTekst(rij, 'relatie_id', 'Brief'),
    actieveVersie: nullableGeheelGetal(rij, 'actieve_versie', 'Brief'),
    status: enumWaarde(rij, 'status', BRIEFSTATUSSEN, 'Brief'),
    vervangingVanBriefId: nullableTekst(rij, 'vervanging_van_brief_id', 'Brief'),
    definitiefOp: nullableTekst(rij, 'definitief_op', 'Brief'),
    vergrendeldOp: nullableTekst(rij, 'vergrendeld_op', 'Brief'),
    annuleringsreden: nullableTekst(rij, 'annuleringsreden', 'Brief'),
  };
}

export function mapBriefversieRij(rij: Rij): BriefversieContract {
  return {
    id: tekst(rij, 'id', 'Briefversie'),
    briefId: tekst(rij, 'brief_id', 'Briefversie'),
    versienummer: geheelGetal(rij, 'versienummer', 'Briefversie'),
    status: enumWaarde(rij, 'status', VERSIESTATUSSEN, 'Briefversie'),
    inhoud: object(rij, 'inhoud_snapshot', 'Briefversie') as unknown as InhoudSnapshot,
    geadresseerde: object(rij, 'geadresseerde_snapshot', 'Briefversie') as unknown as GeadresseerdeSnapshot,
    bestandReferentie: nullableTekst(rij, 'bestand_referentie', 'Briefversie'),
    createdAt: tekst(rij, 'created_at', 'Briefversie'),
    vervallenOp: nullableTekst(rij, 'vervallen_op', 'Briefversie'),
    verzondenOp: nullableTekst(rij, 'verzonden_op', 'Briefversie'),
  };
}

export function mapPrintbatchRij(rij: Rij): PrintbatchContract {
  return {
    id: tekst(rij, 'id', 'Printbatch'),
    batchnummer: tekst(rij, 'batchnummer', 'Printbatch'),
    status: enumWaarde(rij, 'status', BATCHSTATUSSEN, 'Printbatch'),
    documentversie: geheelGetal(rij, 'documentversie', 'Printbatch'),
    aanvullingOpBatchId: nullableTekst(rij, 'aanvulling_op_batch_id', 'Printbatch'),
    printdatum: nullableTekst(rij, 'printdatum', 'Printbatch'),
    verzenddatum: nullableTekst(rij, 'verzenddatum', 'Printbatch'),
    geannuleerdOp: nullableTekst(rij, 'geannuleerd_op', 'Printbatch'),
    annuleringsreden: nullableTekst(rij, 'annuleringsreden', 'Printbatch'),
  };
}

export function mapPrintbatchBriefRij(rij: Rij): PrintbatchBriefContract {
  return {
    id: tekst(rij, 'id', 'Printbatchbrief'),
    batchId: tekst(rij, 'batch_id', 'Printbatchbrief'),
    briefId: tekst(rij, 'brief_id', 'Printbatchbrief'),
    briefVersieId: tekst(rij, 'brief_versie_id', 'Printbatchbrief'),
    verwijderdOp: nullableTekst(rij, 'verwijderd_op', 'Printbatchbrief'),
    afwijkingsstatus: nullableTekst(rij, 'afwijkingsstatus', 'Printbatchbrief'),
    afwijkingsreden: nullableTekst(rij, 'afwijkingsreden', 'Printbatchbrief'),
  };
}
