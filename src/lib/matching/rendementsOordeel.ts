import type { ObjectVastgoed } from '@/data/mock-data';
import type { Rendementscriterium } from '@/hooks/useRelatieMatchingData';

/** Geen automatische knock-outs op ongeverifieerde objectberekeningen.
 * BAR en NAR zijn strikt afzonderlijke methoden; ontwikkeling en IRR
 * worden nooit op een aanvangsrendement getoetst.
 */
export type RendementsOordeel = {
  status:'niet_van_toepassing'|'controle'|'indicatief_voldoet'|'indicatief_lager';
  uitleg:string;
  hardKnockout:false;
};
export function beoordeelObjectRendement(
  object:ObjectVastgoed,criteria:readonly Rendementscriterium[],zoekprofielId?:string|null,
):RendementsOordeel {
  const relevant=criteria.filter(c=>c.status==='actief' &&
    (!c.zoekprofielId || c.zoekprofielId===zoekprofielId));
  if(!relevant.length)return {status:'niet_van_toepassing',uitleg:'Geen rendementscriterium vastgelegd',hardKnockout:false};

  // Een specifiek zoekprofiel prevaleert boven dezelfde strategie in het algemene profiel.
  const specifiek=relevant.filter(c=>!!c.zoekprofielId);
  const best=relevant.filter(c=>!specifiek.some(s=>s.strategie===c.strategie && s!==c));
  let verificatie=false;
  for(const c of best){
    if(c.criteriumType!=='minimum' && c.criteriumType!=='doel')continue;
    if(!c.methodeBevestigd || !['bar','nar'].includes(c.methode)){verificatie=true;continue;}
    if(c.strategie!=='belegging'){verificatie=true;continue;}
    const waarde=c.methode==='bar'?object.brutoAanvangsrendement:object.nettoAanvangsrendement;
    if(typeof waarde!=='number'||!Number.isFinite(waarde)){verificatie=true;continue;}
    const label=c.methode.toUpperCase();
    const uitleg=`${label} object: ${waarde.toLocaleString('nl-NL')}%; criterium: ${c.percentage.toLocaleString('nl-NL')}%. Objectberekening en definities eerst controleren.`;
    if(waarde<c.percentage)return {status:'indicatief_lager',uitleg,hardKnockout:false};
    return {status:'indicatief_voldoet',uitleg,hardKnockout:false};
  }
  return {status:'controle',uitleg:verificatie?
    'Rendementsmethode, investeringsstrategie of objectberekening is nog niet voldoende bevestigd.':
    'Rendementscriteria zijn niet rechtstreeks vergelijkbaar met de beschikbare objectgegevens.',
    hardKnockout:false};
}
