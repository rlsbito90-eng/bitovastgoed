import type { ProfielRoute, MatchCriteriumStatus } from './rolMandaatAdapter';
import type { RendementsOordeel } from './rendementsOordeel';

export const MATCH_ONDERDELEN = ['vastgoed','strategie','locatie','budget','rendement'] as const;
export type MatchOnderdeel=typeof MATCH_ONDERDELEN[number];
export type MatchBewijskwaliteit={
  onderdelen:Record<MatchOnderdeel,MatchCriteriumStatus>;
  passend:number;
  afwijkend:number;
  beoordeeld:number;
  totaal:number;
  aansluiting:number|null;
};

export function bepaalMatchBewijskwaliteit(route:ProfielRoute,rendement?:RendementsOordeel):MatchBewijskwaliteit|null {
  if(!route.criteriaStatus)return null;
  const financieel:MatchCriteriumStatus=rendement?.status==='indicatief_voldoet'?'passend':
    rendement?.status==='indicatief_lager'?'afwijkend':
    rendement?.status==='controle'?'controle':'niet_ingevuld';
  const onderdelen={...route.criteriaStatus,rendement:financieel};
  const waarden=MATCH_ONDERDELEN.map(k=>onderdelen[k]);
  const passend=waarden.filter(v=>v==='passend').length;
  const afwijkend=waarden.filter(v=>v==='afwijkend').length;
  const beoordeeld=passend+afwijkend;
  return {onderdelen,passend,afwijkend,beoordeeld,totaal:MATCH_ONDERDELEN.length,
    aansluiting:beoordeeld>=2?Math.round(passend/beoordeeld*100):null};
}

/** Sort within the same priority only. More actual positive evidence takes
 * precedence over a flattering ratio with little supporting information.
 * A financial family counts once, even if BAR and Factor both match.
 */
export function vergelijkMatchBewijs(a:MatchBewijskwaliteit|null,b:MatchBewijskwaliteit|null):number {
  return (b?.passend??0)-(a?.passend??0) ||
    (a?.afwijkend??0)-(b?.afwijkend??0) ||
    (b?.beoordeeld??0)-(a?.beoordeeld??0);
}
