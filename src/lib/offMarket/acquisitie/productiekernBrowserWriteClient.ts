import { supabase } from '@/integrations/supabase/client';

import { maakAtomischePrintbatchSupabaseRepository, type AtomischePrintbatchRepository, type AtomischePrintbatchRpcUitvoerder } from './atomischePrintbatchSupabaseRepository';
import { maakBestaandConceptBridgeSupabaseRepository, type BestaandConceptBridgeRepository, type BestaandConceptBridgeRpcUitvoerder } from './bestaandConceptBridgeSupabaseRepository';
import { bepaalBrowserProductiekernActivatieUitOmgeving, type ProductiekernBrowserOmgeving } from './productiekernBrowserClient';
import { maakGepoorteSupabaseProductieTransactieRepository, type ProductieSupabaseRpcUitvoerder } from './productieSupabaseTransactieRepository';
import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import type { AcquisitieProductieTransactieRepository } from './productieTransactieRepository';
import { maakVroegeProductieSupabaseRepository, type VroegeProductieWriteRepository, type VroegeRpcUitvoerder } from './vroegeProductieSupabaseRepository';
import { maakProductieDossierBronSupabaseRepository, type ProductieDossierBronRepository, type ProductieDossierBronRpcUitvoerder } from './productieDossierBronSupabaseRepository';

export interface ProductiekernBrowserWriteSamenstelling {
  activatie: ProductiekernActivatieBesluit;
  vroegeRepository: VroegeProductieWriteRepository;
  bestaandConceptBridgeRepository: BestaandConceptBridgeRepository;
  atomischePrintbatchRepository: AtomischePrintbatchRepository;
  transactieRepository: AcquisitieProductieTransactieRepository;
  dossierBronRepository: ProductieDossierBronRepository;
}
export interface ProductiekernBrowserWriteUitvoerders {
  vroege: VroegeRpcUitvoerder;
  bestaandConceptBridge: BestaandConceptBridgeRpcUitvoerder;
  atomischePrintbatch: AtomischePrintbatchRpcUitvoerder;
  transacties: ProductieSupabaseRpcUitvoerder;
  dossierBron: ProductieDossierBronRpcUitvoerder;
}

export function stelProductiekernBrowserWritesSamen(env:ProductiekernBrowserOmgeving,uitvoerders:ProductiekernBrowserWriteUitvoerders):ProductiekernBrowserWriteSamenstelling{
  const activatie=bepaalBrowserProductiekernActivatieUitOmgeving(env);
  return{
    activatie,
    vroegeRepository:maakVroegeProductieSupabaseRepository({activatie,uitvoerder:uitvoerders.vroege}),
    bestaandConceptBridgeRepository:maakBestaandConceptBridgeSupabaseRepository({activatie,uitvoerder:uitvoerders.bestaandConceptBridge}),
    atomischePrintbatchRepository:maakAtomischePrintbatchSupabaseRepository({activatie,uitvoerder:uitvoerders.atomischePrintbatch}),
    transactieRepository:maakGepoorteSupabaseProductieTransactieRepository(activatie,uitvoerders.transacties),
    dossierBronRepository:maakProductieDossierBronSupabaseRepository({activatie,uitvoerder:uitvoerders.dossierBron}),
  };
}

type SupabaseRpcClient={rpc(naam:string,parameters:Record<string,unknown>):Promise<{data:unknown;error:{message?:string|null;details?:string|null;hint?:string|null;code?:string|null}|null}>};
const rpcClient=supabase as unknown as SupabaseRpcClient;
async function voerBrowserRpcUit(naam:string,parameters:Record<string,unknown>){const respons=await rpcClient.rpc(naam,parameters);return{data:respons.data,error:respons.error?{message:respons.error.message??undefined,code:respons.error.code??undefined}:null}}
const browserUitvoerders:ProductiekernBrowserWriteUitvoerders={
  vroege:{rpc:voerBrowserRpcUit},bestaandConceptBridge:{rpc:voerBrowserRpcUit},atomischePrintbatch:{rpc:voerBrowserRpcUit},dossierBron:{rpc:voerBrowserRpcUit},
  transacties:{async voerRpcUit(rpc,parameters){const respons=await rpcClient.rpc(rpc,parameters);return{data:respons.data,error:respons.error?{message:respons.error.message,details:respons.error.details,hint:respons.error.hint}:null}}},
};
export function maakStandaardProductiekernBrowserWriteSamenstelling():ProductiekernBrowserWriteSamenstelling{return stelProductiekernBrowserWritesSamen(import.meta.env as ProductiekernBrowserOmgeving,browserUitvoerders)}
