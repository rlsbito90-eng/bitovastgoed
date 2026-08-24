import type { OperationeleWerkbak } from './operationeleWerkbak';
import { parseProductieNummer } from './productieIdentiteit';

export type ProductieBronType = 'off_market_radar' | 'pandenverkenner';
export type Briefstatus = 'concept' | 'definitief' | 'geannuleerd';
export type Briefversiestatus = 'actief' | 'vervallen' | 'verzonden';
export type Printbatchstatus =
  | 'concept'
  | 'documenten_gegenereerd'
  | 'geprint'
  | 'gedeeltelijk_gepost'
  | 'gepost'
  | 'geannuleerd';
export type Batchdocumenttype = 'brieven_pdf' | 'adreslabels' | 'controlelijst' | 'batchvoorblad';
export type Batchdocumentstatus = 'actief' | 'vervallen';

export interface GeadresseerdeSnapshot {
  naam: string | null;
  bedrijfsnaam: string | null;
  geadresseerdeLabel?: string | null;
  adresseerwijze?: 'eigenaar_bekend' | 'eigenaar_objectadres' | null;
  aanhef: string | null;
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
  land: string;
  bron: string | null;
  verificatiestatus: 'onbekend' | 'handmatig_gecontroleerd' | 'geverifieerd';
  relatieId: string | null;
}

export interface InhoudSnapshot {
  onderwerp: string | null;
  brieftekst: string;
  objectadres: string | null;
  objectomschrijving: string | null;
  templateId: string | null;
  templateVersie: string | null;
}

export interface AcquisitiedossierContract {
  selectieId: string;
  signaalId: string | null;
  vastgoedkansId?: string | null;
  objectId: string | null;
  verwerkingGestartOp: string | null;
  verwerkingGestartDoor: string | null;
  primaireWerkbak: OperationeleWerkbak;
  volgendeActieOp: string | null;
  volgendeActieOmschrijving: string | null;
}

export interface BriefContract {
  id: string;
  briefnummer: string | null;
  signaalId: string | null;
  vastgoedkansId?: string | null;
  selectieId: string | null;
  objectId: string | null;
  relatieId: string | null;
  actieveVersie: number | null;
  status: Briefstatus;
  vervangingVanBriefId: string | null;
  definitiefOp: string | null;
  vergrendeldOp: string | null;
  annuleringsreden: string | null;
}

export interface BriefversieContract {
  id: string;
  briefId: string;
  versienummer: number;
  status: Briefversiestatus;
  inhoud: InhoudSnapshot;
  geadresseerde: GeadresseerdeSnapshot;
  bestandReferentie: string | null;
  createdAt: string;
  vervallenOp: string | null;
  verzondenOp: string | null;
}

export interface PrintbatchContract {
  id: string;
  batchnummer: string;
  /** Oude Radar-fixtures zonder veld blijven compatibel; persistente batches hebben dit altijd. */
  bronType?: ProductieBronType;
  status: Printbatchstatus;
  documentversie: number;
  aanvullingOpBatchId: string | null;
  printdatum: string | null;
  verzenddatum: string | null;
  geannuleerdOp: string | null;
  annuleringsreden: string | null;
}

export interface PrintbatchBriefContract { id:string; batchId:string; briefId:string; briefVersieId:string; verwijderdOp:string|null; afwijkingsstatus:string|null; afwijkingsreden:string|null; }
export interface BatchdocumentContract { id:string; batchId:string; documentversie:number; documenttype:Batchdocumenttype; bestandReferentie:string; status:Batchdocumentstatus; metadata:Record<string,unknown>; createdAt:string; vervallenOp:string|null; }

const BATCH_OVERGANGEN:Record<Printbatchstatus,readonly Printbatchstatus[]>={concept:['documenten_gegenereerd','geannuleerd'],documenten_gegenereerd:['concept','geprint','geannuleerd'],geprint:['gedeeltelijk_gepost','gepost'],gedeeltelijk_gepost:['gepost'],gepost:[],geannuleerd:[]};
export function isGeldigeBatchovergang(van:Printbatchstatus,naar:Printbatchstatus):boolean{return van===naar||BATCH_OVERGANGEN[van].includes(naar)}
export function valideerDossierbron(input:{signaalId?:string|null;vastgoedkansId?:string|null}):string[]{return Number(Boolean(input.signaalId?.trim()))+Number(Boolean(input.vastgoedkansId?.trim()))===1?[]:['Exact één dossierbron (Radar-signaal of Vastgoedkans) is verplicht.']}
export function valideerGeadresseerdeSnapshot(snapshot:GeadresseerdeSnapshot):string[]{const fouten:string[]=[];const objectpost=snapshot.adresseerwijze==='eigenaar_objectadres';if(objectpost){if(!snapshot.geadresseerdeLabel?.trim())fouten.push('Geadresseerdelabel is verplicht bij eigenaar-objectadres.')}else if(!snapshot.naam?.trim()&&!snapshot.bedrijfsnaam?.trim()){fouten.push('Naam of bedrijfsnaam is verplicht.')}if(!snapshot.straatHuisnummer.trim())fouten.push('Straat en huisnummer zijn verplicht.');if(!snapshot.postcode.trim())fouten.push('Postcode is verplicht.');if(!snapshot.plaats.trim())fouten.push('Plaats is verplicht.');if(!snapshot.land.trim())fouten.push('Land is verplicht.');return fouten}
export function valideerBriefcontract(brief:BriefContract):string[]{const fouten:string[]=[...valideerDossierbron(brief)];if(brief.briefnummer){const parsed=parseProductieNummer(brief.briefnummer);if(!parsed||parsed.type!=='brief')fouten.push('Briefnummer is ongeldig.')}if(brief.actieveVersie!==null&&(!Number.isInteger(brief.actieveVersie)||brief.actieveVersie<1))fouten.push('Actieve versie moet minimaal 1 zijn.');if(brief.status==='definitief'&&!brief.briefnummer)fouten.push('Een definitieve brief vereist een briefnummer.');if(brief.status==='geannuleerd'&&!brief.annuleringsreden?.trim())fouten.push('Een geannuleerde brief vereist een reden.');if(brief.vergrendeldOp&&brief.status==='concept')fouten.push('Een vergrendelde brief kan geen conceptstatus hebben.');return fouten}
export function valideerBriefversie(versie:BriefversieContract):string[]{const fouten=valideerGeadresseerdeSnapshot(versie.geadresseerde);if(!Number.isInteger(versie.versienummer)||versie.versienummer<1)fouten.push('Versienummer moet minimaal 1 zijn.');if(!versie.inhoud.brieftekst.trim())fouten.push('Brieftekst is verplicht.');if(versie.status==='verzonden'&&!versie.verzondenOp)fouten.push('Een verzonden briefversie vereist een verzenddatum.');if(versie.status==='vervallen'&&!versie.vervallenOp)fouten.push('Een vervallen briefversie vereist een vervaldatum.');if(versie.status==='actief'&&(versie.vervallenOp||versie.verzondenOp))fouten.push('Een actieve briefversie mag niet vervallen of verzonden zijn.');return fouten}
export function valideerPrintbatch(batch:PrintbatchContract):string[]{const fouten:string[]=[];const parsed=parseProductieNummer(batch.batchnummer);if(!parsed||parsed.type!=='batch')fouten.push('Batchnummer is ongeldig.');if(batch.bronType&&!['off_market_radar','pandenverkenner'].includes(batch.bronType))fouten.push('Batchbron is ongeldig.');if(!Number.isInteger(batch.documentversie)||batch.documentversie<1)fouten.push('Documentversie moet minimaal 1 zijn.');if(batch.status==='geprint'&&!batch.printdatum)fouten.push('Een geprinte batch vereist een printdatum.');if((batch.status==='gedeeltelijk_gepost'||batch.status==='gepost')&&!batch.verzenddatum)fouten.push('Een geposte batch vereist een verzenddatum.');if(batch.status==='geannuleerd'&&!batch.annuleringsreden?.trim())fouten.push('Een geannuleerde batch vereist een reden.');return fouten}
export function magBatchinhoudWijzigen(status:Printbatchstatus):boolean{return status==='concept'}
export function magBatchdocumentenRegenereren(status:Printbatchstatus):boolean{return status==='concept'||status==='documenten_gegenereerd'}
export function productiekernFeatureActief(envWaarde:unknown):boolean{return envWaarde==='true'}
