import type {PipelineFase, InteresseNiveau} from '@/data/mock-data';
import {CRM_SANDBOX_HOST} from '@/demo/demoHost';
import type {KandidaatBulkVerzoek,KandidaatBulkOpslagResultaat} from './kandidaatBulkContract';
import type {KandidaatBulkHerstelVerzoek,KandidaatBulkHerstelResultaat} from './kandidaatBulkHerstel';
import type {KandidaatBulkPoort,ActueleObjectPipelineFase} from './kandidaatBulkUitvoering';
import type {KandidaatBulkHerstelPoort} from './kandidaatBulkHerstel';

/**
 * Voorbereide, maar NIET geactiveerde poort naar een afzonderlijk Supabase-
 * testproject. Er wordt geen client aangemaakt en deze module doet geen fetch.
 * De sandbox blijft volledig in geheugen totdat testauth + project afzonderlijk
 * zijn ingericht en een mens expliciet de testomgeving heeft gekozen.
 */
export interface TestDatabaseConfiguratie {
  hostname: string;
  enabled: boolean;
  projectUrl: string;
  projectRef: string;
  productieProjectUrl?: string;
}
/** Alleen synthetische records. Geen echte contact- of persoonsgegevens. */
export interface TestPipelineKandidaat {
  id: string;
  objectId: string;
  pipelineFase: PipelineFase;
  interesseNiveau: InteresseNiveau;
  updatedAt: string;
}

/** Serverclient wordt pas door het testproject geïnjecteerd. */
export interface TestDatabaseTransport {
  /** Authenticated getUser, nooit alleen een lokale getSession-bewering. */
  identiteit():Promise<{id:string;isAnonymous?:boolean}|null>;
  rpcOpslaan(verzoek:KandidaatBulkVerzoek):Promise<KandidaatBulkOpslagResultaat>;
  rpcHerstellen(verzoek:KandidaatBulkHerstelVerzoek):Promise<KandidaatBulkHerstelResultaat>;
  kandidatenLezen(objectId:string):Promise<TestPipelineKandidaat[]>;
  objectFaseLezen(objectId:string):Promise<ActueleObjectPipelineFase>;
}

const verbodenRefs=new Set([
  // Bestaande productie en het ongeïnspecteerde, inactieve BAG-shadowproject.
  'vyjocdlwfxrblusfngfq',
  'xfygspvpeugxowxbcvnm',
]);
const refPatroon=/^[a-z0-9]{16,32}$/;
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
function urlHost(url:string){
  try{
    const parsed=new URL(url);
    if(parsed.protocol!=='https:' || parsed.username || parsed.password ||
      parsed.port || parsed.pathname!=='/' || parsed.search || parsed.hash)
      return null;
    return parsed.hostname.toLowerCase();
  }catch{return null;}
}
export function valideerAparteTestDatabase(c:TestDatabaseConfiguratie):void {
  if(!c.enabled)throw Error('Testdatabase is niet geactiveerd.');
  if(c.hostname.toLowerCase()!==CRM_SANDBOX_HOST)
    throw Error('Testdatabase is uitsluitend op de afzonderlijke CRM-testhost toegestaan.');
  if(!refPatroon.test(c.projectRef)||verbodenRefs.has(c.projectRef))
    throw Error('Geen geldige afzonderlijke testprojectreferentie opgegeven.');
  const host=urlHost(c.projectUrl);
  if(host!==c.projectRef+'.supabase.co')
    throw Error('Testproject-URL en projectreferentie komen niet overeen.');
  const productieHost=c.productieProjectUrl?urlHost(c.productieProjectUrl):null;
  if(c.productieProjectUrl && !productieHost)
    throw Error('De productieproject-URL is ongeldig. Testverbinding geblokkeerd.');
  if(host===productieHost)
    throw Error('Testproject mag nooit dezelfde database als productie gebruiken.');
}

/**
 * De testpoort weigert toegang vóór elke databaseactie wanneer configuratie
 * niet klopt of een testgebruiker niet echt bij test-Auth is ingelogd.
 */
export function maakAparteTestDatabasePoort(
  c:TestDatabaseConfiguratie, transport:TestDatabaseTransport,
):{
  bulk:KandidaatBulkPoort<TestPipelineKandidaat>;
  herstel:KandidaatBulkHerstelPoort<TestPipelineKandidaat>;
}{
  valideerAparteTestDatabase(c);
  const beveilig=async()=>{
    valideerAparteTestDatabase(c);
    const user=await transport.identiteit();
    if(!user?.id||!uuid.test(user.id)||user.isAnonymous)
      throw Object.assign(new Error('Een geverifieerde testgebruiker is verplicht.'),{code:'42501'});
  };
  const ververs=async(objectId:string)=>{
    await beveilig();
    if(!uuid.test(objectId))throw Object.assign(new Error('Ongeldig object-ID'),{code:'22023'});
    const kandidaten=await transport.kandidatenLezen(objectId);
    if(kandidaten.some(k=>k.objectId!==objectId))
      throw Error('Testproject antwoordde met kandidaten van een ander object.');
    return kandidaten;
  };
  const verversObjectFase=async(objectId:string)=>{
    await beveilig();
    if(!uuid.test(objectId))
      throw Object.assign(new Error('Ongeldig object-ID'),{code:'22023'});
    const fase=await transport.objectFaseLezen(objectId);
    if(!fase || fase.objectId.toLowerCase()!==objectId.toLowerCase())
      throw Error('Testproject antwoordde met objectgegevens van een ander object.');
    return fase;
  };
  return{
    bulk:{
      async opslaan(v){
        await beveilig();
        if(!uuid.test(v.p_object_id)||!uuid.test(v.p_request_id))
          throw Object.assign(new Error('Ongeldige verzoek- of objectreferentie'),{code:'22023'});
        return transport.rpcOpslaan(v);
      },
      ververs,
      verversObjectFase,
    },
    herstel:{
      async herstellen(v){
        await beveilig();
        if(!uuid.test(v.p_object_id)||!uuid.test(v.p_bron_request_id)||
          !uuid.test(v.p_herstel_request_id))
          throw Object.assign(new Error('Ongeldige herstelaanvraag'),{code:'22023'});
        return transport.rpcHerstellen(v);
      },
      ververs,
    },
  };
}
