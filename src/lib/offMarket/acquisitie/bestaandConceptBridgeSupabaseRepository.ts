import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';

export interface BestaandConceptBridgeRpcUitvoerder {
  rpc<T = unknown>(naam:string,parameters:Record<string,unknown>):Promise<{data:T|null;error:{message?:string;code?:string}|null}>;
}

export interface KoppelBestaandConceptCommand {
  selectieId:string;
  signaalId?:string|null;
  vastgoedkansId?:string|null;
  briefId:string;
  actorId:string;
  operationKey:string;
  inhoudSnapshot:Record<string,unknown>;
  geadresseerdeSnapshot:Record<string,unknown>;
}
export interface BestaandConceptBridgeResultaat { briefId:string; signaalId:string|null; vastgoedkansId:string|null; briefVersieId:string; versienummer:number; }
export interface BestaandConceptBridgeRepository { koppelBestaandConcept(command:KoppelBestaandConceptCommand):Promise<BestaandConceptBridgeResultaat>; }

function rij(data:unknown):Record<string,unknown>{const waarde=Array.isArray(data)?data[0]:data;if(!waarde||typeof waarde!=='object')throw new Error('Bestaand-concept-bridge RPC gaf geen resultaat.');return waarde as Record<string,unknown>}
function tekst(record:Record<string,unknown>,veld:string):string{const waarde=record[veld];if(typeof waarde!=='string'||!waarde.trim())throw new Error(`Bestaand-concept-bridge RPC mist ${veld}.`);return waarde}
function nullableTekst(record:Record<string,unknown>,veld:string):string|null{const waarde=record[veld];if(waarde===null||waarde===undefined)return null;if(typeof waarde!=='string')throw new Error(`Bestaand-concept-bridge RPC heeft ongeldig ${veld}.`);return waarde}
function valideerBron(command:KoppelBestaandConceptCommand):void{if(Number(Boolean(command.signaalId?.trim()))+Number(Boolean(command.vastgoedkansId?.trim()))!==1)throw new Error('Exact één dossierbron is verplicht voor de conceptbridge.')}

export function maakBestaandConceptBridgeSupabaseRepository(input:{activatie:ProductiekernActivatieBesluit;uitvoerder:BestaandConceptBridgeRpcUitvoerder;klok?:()=>string;}):BestaandConceptBridgeRepository{
  const klok=input.klok??(()=>new Date().toISOString());
  return{async koppelBestaandConcept(command){
    if(!input.activatie.schrijvenActief)throw new ProductieTransactiesNietGeactiveerdError('koppelBestaandConcept');
    valideerBron(command);
    const isPandenverkenner=Boolean(command.vastgoedkansId);
    const rpcNaam=isPandenverkenner?'acquisitie_bestaand_concept_koppelen_v2':'off_market_bestaand_concept_koppelen';
    const respons=await input.uitvoerder.rpc(rpcNaam,{p_selectie_id:command.selectieId,p_brief_id:command.briefId,p_actor_id:command.actorId,p_operation_key:command.operationKey,p_uitgevoerd_op:klok(),p_inhoud_snapshot:command.inhoudSnapshot,p_geadresseerde_snapshot:command.geadresseerdeSnapshot});
    if(respons.error)throw new Error(respons.error.message||respons.error.code||'Onbekende bestaand-concept-bridge RPC-fout.');
    const record=rij(respons.data);const briefId=tekst(record,'brief_id');const signaalId=nullableTekst(record,'signaal_id');const vastgoedkansId=isPandenverkenner?nullableTekst(record,'vastgoedkans_id'):null;const briefVersieId=tekst(record,'brief_versie_id');const versienummer=Number(record.versienummer);
    if(briefId!==command.briefId)throw new Error('Bestaand-concept-bridge RPC gaf een andere brief terug dan het commando.');
    if((signaalId??null)!==(command.signaalId??null))throw new Error('Bestaand-concept-bridge RPC gaf een ander signaal terug dan het commando.');
    if((vastgoedkansId??null)!==(command.vastgoedkansId??null))throw new Error('Bestaand-concept-bridge RPC gaf een andere Vastgoedkans terug dan het commando.');
    if(!Number.isInteger(versienummer)||versienummer<1)throw new Error('Bestaand-concept-bridge RPC gaf een ongeldig versienummer.');
    return{briefId,signaalId,vastgoedkansId,briefVersieId,versienummer};
  }};
}
