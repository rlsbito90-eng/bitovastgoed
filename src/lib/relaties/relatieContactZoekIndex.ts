import type {Relatie, RelatieContactpersoon} from '@/data/mock-data';

/** Alleen bestaande contactpersonen, zonder extra opslag of fallbackbedrijfsnaam. */
export function maakContactNaamIndex(
  contactpersonen:readonly Pick<RelatieContactpersoon,'relatieId'|'naam'>[],
):ReadonlyMap<string,readonly string[]>{
  const index=new Map<string,string[]>();
  for(const cp of contactpersonen){
    const naam=cp.naam?.trim();
    if(!naam)continue;
    const namen=index.get(cp.relatieId)??[];
    namen.push(naam);
    index.set(cp.relatieId,namen);
  }
  return index;
}

/** Ook naamloze relaties kunnen via hun geregistreerde contactpersoon worden gevonden. */
export function matchRelatieZoekterm(
  relatie:Pick<Relatie,'id'|'bedrijfsnaam'|'contactpersoon'>,
  zoekterm:string,
  contactNaamIndex:ReadonlyMap<string,readonly string[]>,
):boolean{
  const zoek=zoekterm.trim().toLocaleLowerCase('nl-NL');
  if(!zoek)return true;
  return [relatie.bedrijfsnaam,relatie.contactpersoon,...(contactNaamIndex.get(relatie.id)??[])]
    .some(naam=>typeof naam==='string'&&naam.toLocaleLowerCase('nl-NL').includes(zoek));
}
