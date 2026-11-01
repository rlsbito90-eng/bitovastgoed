import {
  maakKandidaatVoorstellen, isAanbiedbaar,
  type CrmRelatieInput, type CrmMandaatInput, type CrmObjectInput,
  type KandidaatVoorstel,
} from './rolMandaatAdapter';

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
):A15Impact{
  const result:A15Impact={
    beschikbareObjecten:0,huidigeKandidaatKoppelingen:0,
    gesimuleerdeKandidaatKoppelingen:0,verdwenenKoppelingen:0,
    nieuweKoppelingen:0,objectenMetVerschil:0,veranderdeKoperidentiteiten:0,
    veranderdeBesteRoutes:0,veranderdeMatchkwalificaties:0,
    veranderdeBevestigingen:0,verschillen:[],
  };
  const relatiesPerId=new Map(relaties.map(r=>[r.id,r]));
  for(const object of objecten){
    if(!isAanbiedbaar(object))continue;
    result.beschikbareObjecten++;
    const huidig=maakKandidaatVoorstellen(object,relaties,zoekprofielen);
    const nieuw=maakKandidaatVoorstellen(object,relaties,zoekprofielen,{beleid:'profiel_eerst'});
    result.huidigeKandidaatKoppelingen+=huidig.length;
    result.gesimuleerdeKandidaatKoppelingen+=nieuw.length;
    const hi=new Map(huidig.map(x=>[x.relatieId,x]));
    const ni=new Map(nieuw.map(x=>[x.relatieId,x]));
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
  return result;
}
