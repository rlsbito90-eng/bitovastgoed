import {
  maakKandidaatVoorstellen, isAanbiedbaar,
  type CrmRelatieInput, type CrmMandaatInput, type CrmObjectInput,
} from './rolMandaatAdapter';

/** Pure read-only *simulation*, not the live engine or a validated successor.
 * Counts effects of switching off old type/role inference and using confirmed
 * party profiles + active search profiles for contact-candidate discovery.
 */
export type A15Impact={
  beschikbareObjecten:number;
  huidigeKandidaatKoppelingen:number;
  gesimuleerdeKandidaatKoppelingen:number;
  verdwenenKoppelingen:number;
  nieuweKoppelingen:number;
  objectenMetVerschil:number;
  veranderdeKoperidentiteiten:number;
};

export function vergelijkMatchBeleid(
  objecten:readonly CrmObjectInput[],
  relaties:readonly CrmRelatieInput[],
  zoekprofielen:readonly CrmMandaatInput[]
):A15Impact{
  const result:A15Impact={
    beschikbareObjecten:0,huidigeKandidaatKoppelingen:0,
    gesimuleerdeKandidaatKoppelingen:0,verdwenenKoppelingen:0,
    nieuweKoppelingen:0,objectenMetVerschil:0,veranderdeKoperidentiteiten:0,
  };
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
      if(!voorstel){result.verdwenenKoppelingen++;verschil=true;continue;}
      if(oud.besteRoute.koperRelatieId!==voorstel.besteRoute.koperRelatieId){
        result.veranderdeKoperidentiteiten++;verschil=true;
      }
    }
    for(const id of ni.keys())if(!hi.has(id)){result.nieuweKoppelingen++;verschil=true;}
    if(verschil)result.objectenMetVerschil++;
  }
  return result;
}
