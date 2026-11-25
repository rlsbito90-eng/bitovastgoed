export type KandidaatFilter='relevant'|'shortlist'|'kansrijk'|'controleren'|'overig'|'terug';
export interface KandidaatTerugkeer {
  objectId:string;
  relatieId:string;
  filter:KandidaatFilter;
  zoek:string;
  limiet:number;
  volgorde:string[];
  scrollTop:number;
  kaartOffset:number|null;
  openDetails:Record<string,number[]>;
}

/** Keep the old work order for surviving candidates; append newly matching ones.
 * An explicitly rejected, linked or seller relation is never reintroduced.
 */
export function herstelKandidaatVolgorde<T extends {relatieId:string}>(
  gefilterd:readonly T[], actueel:readonly T[], terug:KandidaatTerugkeer|null,
):T[] {
  if(!terug)return [...gefilterd];
  const map=new Map(gefilterd.map(p=>[p.relatieId,p]));
  const bewerkt=actueel.find(p=>p.relatieId===terug.relatieId);
  if(bewerkt)map.set(bewerkt.relatieId,bewerkt);
  const uitkomst:T[]=[];
  for(const id of terug.volgorde){
    const p=map.get(id);
    if(p){uitkomst.push(p);map.delete(id);}
  }
  return [...uitkomst,...map.values()];
}

export function leesKandidaatTerugkeer(state:unknown,objectId:string,relatieId:string):KandidaatTerugkeer|null {
  const v=(state as {kandidaatTerugkeer?:KandidaatTerugkeer}|null)?.kandidaatTerugkeer;
  return v && v.objectId===objectId && v.relatieId===relatieId &&
    ['relevant','shortlist','kansrijk','controleren','overig','terug'].includes(v.filter) &&
    typeof v.zoek==='string' && Number.isInteger(v.limiet) && v.limiet>=8 &&
    Array.isArray(v.volgorde) && v.volgorde.every(id=>typeof id==='string') &&
    Number.isFinite(v.scrollTop) && (v.kaartOffset===null || Number.isFinite(v.kaartOffset)) &&
    v.openDetails && typeof v.openDetails==='object' ? v : null;
}
