/**
 * De beoordeling van één relatie-objectcombinatie heeft één centrale status.
 * Pipelinekandidaten blijven daarvan onafhankelijk en worden niet dubbel voorgesteld.
 */
export type MatchBesluitStatus = 'interessant'|'afgewezen';
export interface CompactMatchBesluit {
  relatieId:string;
  status:MatchBesluitStatus;
}
export const MATCH_AFWIJSREDENEN:Readonly<Record<string,string>>={
  type:'Vastgoedtype / ontwikkeling',
  locatie:'Locatie / zoekgebied',
  budget:'Prijs of budget',
  rendement:'Rendement',
  strategie:'Investeringsstrategie',
  huursituatie:'Huursituatie',
  staat:'Onderhoudsstaat',
  overig:'Overig / niet passend',
};

/** Bestaande kandidaten en afwijzingen niet opnieuw voorstellen; expliciet
 * interessant verklaarde contacten komen vóór nieuwe automatische suggesties.
 */
export function sorteerVoorstellenOpBesluit<T extends {relatieId:string}>(
  voorstellen:readonly T[],
  besluiten:readonly CompactMatchBesluit[],
  gekoppeldeRelaties:ReadonlySet<string>,
):T[]{
  const status=new Map(besluiten.map(b=>[b.relatieId,b.status]));
  return voorstellen
    .filter(p=>!gekoppeldeRelaties.has(p.relatieId) && status.get(p.relatieId)!=='afgewezen')
    .sort((a,b)=>Number(status.get(b.relatieId)==='interessant')-
      Number(status.get(a.relatieId)==='interessant'));
}
