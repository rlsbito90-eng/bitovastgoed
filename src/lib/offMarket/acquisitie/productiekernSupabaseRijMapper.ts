import type {
  AcquisitiedossierContract,
  BatchdocumentContract,
  BriefContract,
  BriefversieContract,
  GeadresseerdeSnapshot,
  InhoudSnapshot,
  PrintbatchBriefContract,
  PrintbatchContract,
  ProductieBronType,
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
const WERKBAKKEN = new Set<OperationeleWerkbak>(['nieuwe_selectie','eigenaar_achterhalen','brief_opstellen','printklaar','geprint_posten','opvolgen','wachten','afgehandeld']);
const BRIEFSTATUSSEN = new Set(['concept','definitief','geannuleerd']);
const VERSIESTATUSSEN = new Set(['actief','vervallen','verzonden']);
const BATCHSTATUSSEN = new Set(['concept','documenten_gegenereerd','geprint','gedeeltelijk_gepost','gepost','geannuleerd']);
const PRODUCTIEBRONNEN = new Set<ProductieBronType>(['off_market_radar','pandenverkenner']);
const BATCHDOCUMENTTYPEN = new Set(['brieven_pdf','adreslabels','controlelijst','batchvoorblad']);
const BATCHDOCUMENTSTATUSSEN = new Set(['actief','vervallen']);
const POSTGREST_TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function tekst(rij:Rij,veld:string,entiteit:string):string { const waarde=rij[veld]; if(typeof waarde!=='string'||!waarde.trim()) throw new ProductiekernRijOngeldigError(entiteit,`${veld} ontbreekt`); return waarde; }
function nullableTekst(rij:Rij,veld:string,entiteit:string):string|null { const waarde=rij[veld]; if(waarde===null||waarde===undefined)return null; if(typeof waarde!=='string')throw new ProductiekernRijOngeldigError(entiteit,`${veld} is geen tekst`); return waarde; }
function canoniekTijdstip(rij:Rij,veld:string,entiteit:string):string { const waarde=tekst(rij,veld,entiteit); if(!POSTGREST_TIMESTAMPTZ.test(waarde))throw new ProductiekernRijOngeldigError(entiteit,`${veld} is geen geldig timestamptz`); const tijdMs=Date.parse(waarde); if(!Number.isFinite(tijdMs))throw new ProductiekernRijOngeldigError(entiteit,`${veld} is niet parseerbaar`); return new Date(tijdMs).toISOString(); }
function nullableCanoniekTijdstip(rij:Rij,veld:string,entiteit:string):string|null { const waarde=rij[veld]; if(waarde===null||waarde===undefined)return null; if(typeof waarde!=='string')throw new ProductiekernRijOngeldigError(entiteit,`${veld} is geen tekst`); return canoniekTijdstip(rij,veld,entiteit); }
function geheelGetal(rij:Rij,veld:string,entiteit:string):number { const waarde=rij[veld]; if(typeof waarde!=='number'||!Number.isInteger(waarde))throw new ProductiekernRijOngeldigError(entiteit,`${veld} is geen geheel getal`); return waarde; }
function nullableGeheelGetal(rij:Rij,veld:string,entiteit:string):number|null { return rij[veld]===null||rij[veld]===undefined?null:geheelGetal(rij,veld,entiteit); }
function object(rij:Rij,veld:string,entiteit:string):Record<string,unknown> { const waarde=rij[veld]; if(!waarde||typeof waarde!=='object'||Array.isArray(waarde))throw new ProductiekernRijOngeldigError(entiteit,`${veld} is geen object`); return waarde as Record<string,unknown>; }
function enumWaarde<T extends string>(rij:Rij,veld:string,toegestaan:ReadonlySet<string>,entiteit:string):T { const waarde=tekst(rij,veld,entiteit); if(!toegestaan.has(waarde))throw new ProductiekernRijOngeldigError(entiteit,`${veld} bevat een onbekende waarde`); return waarde as T; }
function valideerExactEenBron(signaalId:string|null,vastgoedkansId:string|null,entiteit:string):void { if(Number(Boolean(signaalId?.trim()))+Number(Boolean(vastgoedkansId?.trim()))!==1) throw new ProductiekernRijOngeldigError(entiteit,'exact één dossierbron is verplicht'); }
function batchBron(rij:Rij):ProductieBronType { const waarde=rij.bron_type; if(waarde===null||waarde===undefined)return'off_market_radar'; if(typeof waarde!=='string'||!PRODUCTIEBRONNEN.has(waarde as ProductieBronType))throw new ProductiekernRijOngeldigError('Printbatch','bron_type bevat een onbekende waarde'); return waarde as ProductieBronType; }

export function mapAcquisitiedossierRij(rij:Rij):AcquisitiedossierContract {
  const selectieId=tekst(rij,'selectie_id','Acquisitiedossier');
  const signaalId=nullableTekst(rij,'signaal_id','Acquisitiedossier');
  const vastgoedkansId=nullableTekst(rij,'vastgoedkans_id','Acquisitiedossier');
  valideerExactEenBron(signaalId,vastgoedkansId,'Acquisitiedossier');
  return { selectieId,signaalId,...(vastgoedkansId?{vastgoedkansId}:{}),objectId:nullableTekst(rij,'object_id','Acquisitiedossier'),verwerkingGestartOp:nullableCanoniekTijdstip(rij,'verwerking_gestart_op','Acquisitiedossier'),verwerkingGestartDoor:nullableTekst(rij,'verwerking_gestart_door','Acquisitiedossier'),primaireWerkbak:enumWaarde(rij,'primaire_werkbak',WERKBAKKEN,'Acquisitiedossier'),volgendeActieOp:nullableCanoniekTijdstip(rij,'volgende_actie_op','Acquisitiedossier'),volgendeActieOmschrijving:nullableTekst(rij,'volgende_actie_omschrijving','Acquisitiedossier') };
}

export function mapBriefRij(rij:Rij):BriefContract {
  const id=tekst(rij,'id','Brief');
  const signaalId=nullableTekst(rij,'signaal_id','Brief');
  const vastgoedkansId=nullableTekst(rij,'vastgoedkans_id','Brief');
  valideerExactEenBron(signaalId,vastgoedkansId,'Brief');
  return { id,briefnummer:nullableTekst(rij,'briefnummer','Brief'),signaalId,...(vastgoedkansId?{vastgoedkansId}:{}),selectieId:nullableTekst(rij,'selectie_id','Brief'),objectId:nullableTekst(rij,'object_id','Brief'),relatieId:nullableTekst(rij,'relatie_id','Brief'),actieveVersie:nullableGeheelGetal(rij,'actieve_versie','Brief'),status:enumWaarde(rij,'status',BRIEFSTATUSSEN,'Brief'),vervangingVanBriefId:nullableTekst(rij,'vervanging_van_brief_id','Brief'),definitiefOp:nullableCanoniekTijdstip(rij,'definitief_op','Brief'),vergrendeldOp:nullableCanoniekTijdstip(rij,'vergrendeld_op','Brief'),annuleringsreden:nullableTekst(rij,'annuleringsreden','Brief') };
}

export function mapBriefversieRij(rij:Rij):BriefversieContract { return { id:tekst(rij,'id','Briefversie'),briefId:tekst(rij,'brief_id','Briefversie'),versienummer:geheelGetal(rij,'versienummer','Briefversie'),status:enumWaarde(rij,'status',VERSIESTATUSSEN,'Briefversie'),inhoud:object(rij,'inhoud_snapshot','Briefversie') as unknown as InhoudSnapshot,geadresseerde:object(rij,'geadresseerde_snapshot','Briefversie') as unknown as GeadresseerdeSnapshot,bestandReferentie:nullableTekst(rij,'bestand_referentie','Briefversie'),createdAt:canoniekTijdstip(rij,'created_at','Briefversie'),vervallenOp:nullableCanoniekTijdstip(rij,'vervallen_op','Briefversie'),verzondenOp:nullableCanoniekTijdstip(rij,'verzonden_op','Briefversie') }; }
export function mapPrintbatchRij(rij:Rij):PrintbatchContract { return { id:tekst(rij,'id','Printbatch'),batchnummer:tekst(rij,'batchnummer','Printbatch'),bronType:batchBron(rij),status:enumWaarde(rij,'status',BATCHSTATUSSEN,'Printbatch'),documentversie:geheelGetal(rij,'documentversie','Printbatch'),aanvullingOpBatchId:nullableTekst(rij,'aanvulling_op_batch_id','Printbatch'),printdatum:nullableCanoniekTijdstip(rij,'printdatum','Printbatch'),verzenddatum:nullableCanoniekTijdstip(rij,'verzenddatum','Printbatch'),geannuleerdOp:nullableCanoniekTijdstip(rij,'geannuleerd_op','Printbatch'),annuleringsreden:nullableTekst(rij,'annuleringsreden','Printbatch') }; }
export function mapPrintbatchBriefRij(rij:Rij):PrintbatchBriefContract { return { id:tekst(rij,'id','Printbatchbrief'),batchId:tekst(rij,'batch_id','Printbatchbrief'),briefId:tekst(rij,'brief_id','Printbatchbrief'),briefVersieId:tekst(rij,'brief_versie_id','Printbatchbrief'),verwijderdOp:nullableCanoniekTijdstip(rij,'verwijderd_op','Printbatchbrief'),afwijkingsstatus:nullableTekst(rij,'afwijkingsstatus','Printbatchbrief'),afwijkingsreden:nullableTekst(rij,'afwijkingsreden','Printbatchbrief') }; }
export function mapBatchdocumentRij(rij:Rij):BatchdocumentContract { return { id:tekst(rij,'id','Batchdocument'),batchId:tekst(rij,'batch_id','Batchdocument'),documentversie:geheelGetal(rij,'documentversie','Batchdocument'),documenttype:enumWaarde(rij,'documenttype',BATCHDOCUMENTTYPEN,'Batchdocument'),bestandReferentie:tekst(rij,'bestand_referentie','Batchdocument'),status:enumWaarde(rij,'status',BATCHDOCUMENTSTATUSSEN,'Batchdocument'),metadata:object(rij,'metadata','Batchdocument'),createdAt:canoniekTijdstip(rij,'created_at','Batchdocument'),vervallenOp:nullableCanoniekTijdstip(rij,'vervallen_op','Batchdocument') }; }
