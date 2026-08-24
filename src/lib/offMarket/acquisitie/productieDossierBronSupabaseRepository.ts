import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';

export interface ProductieDossierBronRpcUitvoerder {
  rpc<T=unknown>(naam:string,parameters:Record<string,unknown>):Promise<{data:T|null;error:{message?:string;code?:string}|null}>;
}
export interface StartProductieDossierCommand { selectieId:string; actorId:string; operationKey:string; uitgevoerdOp?:string; }
export interface StartProductieDossierResultaat { selectieId:string; signaalId:string|null; vastgoedkansId:string|null; }
export interface ProductieDossierBronRepository { startDossier(command:StartProductieDossierCommand):Promise<StartProductieDossierResultaat>; }

function recordUit(data:unknown):Record<string,unknown>{const r=Array.isArray(data)?data[0]:data;if(!r||typeof r!=='object')throw new Error('Productiedossier-RPC gaf geen resultaat.');return r as Record<string,unknown>}
function nullableTekst(r:Record<string,unknown>,veld:string):string|null{const v=r[veld];if(v===null||v===undefined)return null;if(typeof v!=='string'||!v.trim())throw new Error(`Productiedossier-RPC gaf ongeldig ${veld}.`);return v}

export function maakProductieDossierBronSupabaseRepository(input:{activatie:ProductiekernActivatieBesluit;uitvoerder:ProductieDossierBronRpcUitvoerder;klok?:()=>string;}):ProductieDossierBronRepository{
  const klok=input.klok??(()=>new Date().toISOString());
  return{async startDossier(command){
    if(!input.activatie.schrijvenActief)throw new ProductieTransactiesNietGeactiveerdError('startProductiedossier');
    if(!command.selectieId.trim()||!command.actorId.trim()||!command.operationKey.trim())throw new Error('Selectie, actor en operation key zijn verplicht voor productiedossierstart.');
    const res=await input.uitvoerder.rpc('acquisitie_verwerking_starten_v2',{p_selectie_id:command.selectieId,p_actor_id:command.actorId,p_operation_key:command.operationKey,p_uitgevoerd_op:command.uitgevoerdOp??klok()});
    if(res.error)throw new Error(res.error.message||res.error.code||'Productiedossier starten is mislukt.');
    const r=recordUit(res.data);const selectieId=nullableTekst(r,'selectie_id');const signaalId=nullableTekst(r,'signaal_id');const vastgoedkansId=nullableTekst(r,'vastgoedkans_id');
    if(selectieId!==command.selectieId)throw new Error('Productiedossier-RPC gaf een andere selectie terug.');
    if(Number(Boolean(signaalId))+Number(Boolean(vastgoedkansId))!==1)throw new Error('Productiedossier-RPC gaf geen geldige dossierbron terug.');
    return{selectieId,signaalId,vastgoedkansId};
  }};
}
