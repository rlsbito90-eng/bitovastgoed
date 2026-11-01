import {
  maakKandidaatVoorstellen, isAanbiedbaar,
  type CrmRelatieInput, type CrmMandaatInput, type CrmObjectInput,
  type KandidaatVoorstel,
} from './rolMandaatAdapter';
import type { PipelineKandidaat } from '@/data/mock-data';

/** A15 is read-only. These rows are review prompts, not approved future matches. */
export type A15VerschilSoort='weggevallen'|'nieuw'|'gewijzigd';
export type A15Verschil={
  objectId:string;
  relatieId:string;
  soort:A15VerschilSoort;
  redenen:string[];
  oud:KandidaatVoorstel|null;
  nieuw:KandidaatVoorstel|null;
};
export type A15PipelineControleStatus=
  'buiten_vergelijking'|'geen_match'|'valt_weg'|'koperverwijzing'|'andere_wijziging'|'profiel_ontbreekt'|'ongewijzigd';
export type A15PipelineControle={
  pipelineId:string|null;
  objectId:string;
  relatieId:string;
  pipelineFase:PipelineKandidaat['pipelineFase'];
  status:A15PipelineControleStatus;
  redenen:string[];
  partijprofielOntbreekt:boolean;
  huidigeKoperRelatieId:string|null;
  nieuweKoperRelatieId:string|null;
};
export type A15Impact={
  beschikbareObjecten:number;
  huidigeKandidaatKoppelingen:number;
  gesimuleerdeKandidaatKoppelingen:number;
  verdwenenKoppelingen:number;
  nieuweKoppelingen:number;
  objectenMetVerschil:number;
  veranderdeKoperidentiteiten:number;
  veranderdeBesteRoutes:number;
  veranderdeMatchkwalificaties:number;
  veranderdeBevestigingen:number;
  verschillen:A15Verschil[];
  lopendePipelineKoppelingen:number;
  relatiesMetLopendePipelineZonderProfiel:number;
  lopendePipelineBuitenVergelijking:number;
  lopendePipelineMetVerschil:number;
  pipelineZonderGegenereerdeMatch:number;
  pipelineWegvallendeRoutes:number;
  pipelineGewijzigdeKoperverwijzingen:number;
  pipelineTeBeoordelen:number;
  pipelineControles:A15PipelineControle[];
};

function redenVoorWegval(r:CrmRelatieInput|undefined):string{
  if(!r?.partijprofiel) return 'Partijprofiel ontbreekt; historische rollen en het oude hoofdtype zijn in de simulatie geen bewijs van een zoekende partij. Beoordeel bestaande zoekcriteria en eventuele zoekprofielen.';
  if(r.partijprofiel==='vastgoedeigenaar'||r.partijprofiel==='overig')
    return 'Het huidige partijprofiel geeft op zichzelf geen aankoopintentie aan; controleer of een concreet zoekprofiel nodig is.';
  return 'De combinatie van expliciet partijprofiel, algemene criteria en actieve zoekprofielen levert in de simulatie geen passende route op. Controleer de zoekcriteria.';
}
function redenVoorNieuw(r:CrmRelatieInput|undefined):string{
  return r?.partijprofiel
    ? 'Het expliciete partijprofiel kan met bestaande aankoopcriteria een contactroute opleveren. Dat bewijst geen opdracht, mandaat of economische koper.'
    : 'Een actief zoekprofiel levert in de simulatie een nieuwe contactroute op. Controleer of de bestaande matching dit terecht mist.';
}

/** Full explanation, not just counts. This algorithm intentionally compares
 * the default current adapter with an explicit opt-in alternative; it does not
 * change the default, write rows or send outreach. */
export function vergelijkMatchBeleid(
  objecten:readonly CrmObjectInput[],
  relaties:readonly CrmRelatieInput[],
  zoekprofielen:readonly CrmMandaatInput[],
  pipeline:readonly (Pick<PipelineKandidaat,'objectId'|'relatieId'|'pipelineFase'> & Partial<Pick<PipelineKandidaat,'id'>>)[]=[],
):A15Impact{
  const result:A15Impact={
    beschikbareObjecten:0,huidigeKandidaatKoppelingen:0,
    gesimuleerdeKandidaatKoppelingen:0,verdwenenKoppelingen:0,
    nieuweKoppelingen:0,objectenMetVerschil:0,veranderdeKoperidentiteiten:0,
    veranderdeBesteRoutes:0,veranderdeMatchkwalificaties:0,
    veranderdeBevestigingen:0,verschillen:[],
    lopendePipelineKoppelingen:0,relatiesMetLopendePipelineZonderProfiel:0,
    lopendePipelineBuitenVergelijking:0,lopendePipelineMetVerschil:0,
    pipelineZonderGegenereerdeMatch:0,pipelineWegvallendeRoutes:0,
    pipelineGewijzigdeKoperverwijzingen:0,pipelineTeBeoordelen:0,
    pipelineControles:[],
  };
  const relatiesPerId=new Map(relaties.map(r=>[r.id,r]));
  const huidigeRoutes=new Map<string,KandidaatVoorstel>();
  const nieuweRoutes=new Map<string,KandidaatVoorstel>();
  for(const object of objecten){
    if(!isAanbiedbaar(object))continue;
    result.beschikbareObjecten++;
    const huidig=maakKandidaatVoorstellen(object,relaties,zoekprofielen);
    const nieuw=maakKandidaatVoorstellen(object,relaties,zoekprofielen,{beleid:'profiel_eerst'});
    result.huidigeKandidaatKoppelingen+=huidig.length;
    result.gesimuleerdeKandidaatKoppelingen+=nieuw.length;
    const hi=new Map(huidig.map(x=>[x.relatieId,x]));
    const ni=new Map(nieuw.map(x=>[x.relatieId,x]));
    for(const v of huidig)huidigeRoutes.set(`${object.id}|${v.relatieId}`,v);
    for(const v of nieuw)nieuweRoutes.set(`${object.id}|${v.relatieId}`,v);
    let verschil=false;
    for(const [id,oud] of hi){
      const voorstel=ni.get(id);
      if(!voorstel){
        result.verdwenenKoppelingen++;
        result.verschillen.push({
          objectId:object.id,relatieId:id,soort:'weggevallen',oud,nieuw:null,
          redenen:[redenVoorWegval(relatiesPerId.get(id))],
        });
        verschil=true;
        continue;
      }
      const redenen:string[]=[];
      if(oud.besteRoute.koperRelatieId!==voorstel.besteRoute.koperRelatieId){
        result.veranderdeKoperidentiteiten++;
        redenen.push('De gekoppelde economische koper zou wijzigen. De nieuwe simulatie leidt geen koper af uit een historische koperrol; een geverifieerde opdrachtgever uit een actief zoekprofiel blijft afzonderlijk mogelijk.');
      }
      if(oud.besteRoute.key!==voorstel.besteRoute.key){
        result.veranderdeBesteRoutes++;
        redenen.push('De best passende zoekroute zou veranderen. Vergelijk de afzonderlijke criteria van beide routes.');
      }
      if(oud.besteRoute.kwalificatie!==voorstel.besteRoute.kwalificatie){
        result.veranderdeMatchkwalificaties++;
        redenen.push('De matchkwalificatie verschilt. Vergelijk de door de matching gecontroleerde criteria.');
      }
      if(oud.besteRoute.bevestiging!==voorstel.besteRoute.bevestiging){
        result.veranderdeBevestigingen++;
        redenen.push('De bevestigingsstatus wijzigt, omdat de nieuwe simulatie geen bevestiging uit oude commerciële rollen overneemt.');
      }
      if(redenen.length){
        result.verschillen.push({
          objectId:object.id,relatieId:id,soort:'gewijzigd',oud,nieuw:voorstel,redenen,
        });
        verschil=true;
      }
    }
    for(const [id,voorstel] of ni){
      if(hi.has(id))continue;
      result.nieuweKoppelingen++;
      result.verschillen.push({
        objectId:object.id,relatieId:id,soort:'nieuw',oud:null,nieuw:voorstel,
        redenen:[redenVoorNieuw(relatiesPerId.get(id))],
      });
      verschil=true;
    }
    if(verschil)result.objectenMetVerschil++;
  }
  // A15.5 — every existing pipeline position needs its own review.
  // Generated matches are only suggestions. No pipeline row is ever rewritten.
  const beschikbareIds=new Set(objecten.filter(isAanbiedbaar).map(o=>o.id));
  const verschilPerKey=new Map(result.verschillen.map(v=>[`${v.objectId}|${v.relatieId}`,v]));
  const zonderProfiel=new Set<string>();
  const key=(objectId:string,relatieId:string)=>`${objectId}|${relatieId}`;
  for(const koppeling of pipeline){
    if(koppeling.pipelineFase==='afgevallen'||koppeling.pipelineFase==='afgerond')continue;
    const relatie=relatiesPerId.get(koppeling.relatieId);
    if(!relatie||relatie.softDeletedAt)continue;
    result.lopendePipelineKoppelingen++;
    const ontbreekt=!relatie.partijprofiel;
    if(ontbreekt)zonderProfiel.add(relatie.id);
    const matchKey=key(koppeling.objectId,koppeling.relatieId);
    const oud=huidigeRoutes.get(matchKey);
    const nieuw=nieuweRoutes.get(matchKey);
    const verschil=verschilPerKey.get(matchKey);
    if(verschil)result.lopendePipelineMetVerschil++;
    let status:A15PipelineControleStatus='ongewijzigd';
    const redenen:string[]=[];
    if(!beschikbareIds.has(koppeling.objectId)){
      status='buiten_vergelijking';
      result.lopendePipelineBuitenVergelijking++;
      redenen.push('Object is niet aanbiedbaar of ontbreekt in de geladen objecten. Bestaande kandidaatkoppeling en proceshistorie blijven onaangetast.');
    }else if(!oud&&!nieuw){
      status='geen_match';
      result.pipelineZonderGegenereerdeMatch++;
      redenen.push('De bestaande kandidaatpositie is in geen van beide matchberekeningen terug te vinden. Het feitelijke transactiedossier blijft leidend.');
    }else if(oud&&!nieuw){
      status='valt_weg';
      result.pipelineWegvallendeRoutes++;
      redenen.push('Het voorgestelde beleid levert geen route meer voor deze bestaande kandidaat. Niet verwijderen of afwijzen zonder dossiercontrole.');
    }else if(oud&&nieuw&&oud.besteRoute.koperRelatieId!==nieuw.besteRoute.koperRelatieId){
      status='koperverwijzing';
      result.pipelineGewijzigdeKoperverwijzingen++;
      redenen.push('De berekende koperverwijzing verandert. Dit is geen wijziging van de feitelijke koper en mag niet automatisch worden doorgevoerd.');
    }else if(verschil){
      status='andere_wijziging';
      redenen.push('De matchkwalificatie, beste route of bevestigingsindicatie verandert. Beoordeel de concrete kandidaatpositie.');
    }else if(ontbreekt){
      status='profiel_ontbreekt';
      redenen.push('Nog geen bevestigd partijprofiel. De bestaande kandidaatpositie blijft geldig als dossierregistratie.');
    }
    if(ontbreekt && status!=='profiel_ontbreekt'){
      redenen.push('Partijprofiel ontbreekt: controleer classificatie onafhankelijk van de bestaande pipeline.');
    }
    if(status!=='ongewijzigd')result.pipelineTeBeoordelen++;
    result.pipelineControles.push({
      pipelineId:koppeling.id??null,
      objectId:koppeling.objectId,
      relatieId:koppeling.relatieId,
      pipelineFase:koppeling.pipelineFase,
      status,redenen,partijprofielOntbreekt:ontbreekt,
      huidigeKoperRelatieId:oud?.besteRoute.koperRelatieId??null,
      nieuweKoperRelatieId:nieuw?.besteRoute.koperRelatieId??null,
    });
  }
  result.relatiesMetLopendePipelineZonderProfiel=zonderProfiel.size;
  // Urgent first; inspection order never changes stored pipeline order.
  const prioriteit:Record<A15PipelineControleStatus,number>={
    'koperverwijzing':0,'valt_weg':1,'geen_match':2,
    'buiten_vergelijking':3,'andere_wijziging':4,
    'profiel_ontbreekt':5,'ongewijzigd':6,
  };
  // Een concreet (concept-)koopdossier of bod gaat in de audit vóór een
  // recente nieuwe match. Een pipelinefase alleen bewijst geen getekende deal.
  const fasePrioriteit:Partial<Record<PipelineKandidaat['pipelineFase'],number>>={
    transport_closing:0,koopovereenkomst_getekend:1,koopovereenkomst_concept:2,
    due_diligence:3,loi_ontvangen:4,onderhandeling:5,
    indicatieve_bieding:6,bezichtiging_geweest:7,bezichtiging_gepland:8,
    informatie_gedeeld:9,nda_getekend:10,nda_verstuurd:11,
    interesse_ontvangen:12,teaser_verstuurd:13,match_gevonden:14,
  };
  result.pipelineControles.sort((a,b)=>
    (fasePrioriteit[a.pipelineFase]??99)-(fasePrioriteit[b.pipelineFase]??99)
    ||prioriteit[a.status]-prioriteit[b.status]
    ||a.objectId.localeCompare(b.objectId)
    ||a.relatieId.localeCompare(b.relatieId));
  return result;
}
