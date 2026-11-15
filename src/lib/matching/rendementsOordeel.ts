import type { ObjectVastgoed } from '@/data/mock-data';
import type { Rendementscriterium } from '@/hooks/useRelatieMatchingData';

/** Financiële toetsing is indicatief totdat de objectberekening en de
 * gehanteerde rendementsdefinities daadwerkelijk zijn geverifieerd.
 * BAR, NAR, GDV-marge, projectkosten en IRR zijn niet uitwisselbaar.
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
  if(!relevant.length)return {
    status:'niet_van_toepassing',uitleg:'Geen rendementscriterium vastgelegd',hardKnockout:false,
  };

  // De criteria van een afzonderlijk zoekprofiel vervangen slechts de
  // algemene criteria voor diezelfde strategie; andere strategieën blijven bestaan.
  const specifiek=relevant.filter(c=>!!c.zoekprofielId);
  const best=relevant.filter(c=>!specifiek.some(s=>s.strategie===c.strategie && s!==c));
  const toetsbaar=best.filter(c=>c.criteriumType==='minimum'||c.criteriumType==='doel');

  // Een historisch of gemiddeld percentage is geen financiële aankoopdrempel.
  if(!toetsbaar.length)return {
    status:'niet_van_toepassing',
    uitleg:'Alleen historische of gemiddelde rendementen; geen toetsbaar rendementsdoel.',
    hardKnockout:false,
  };

  const lager:string[]=[];
  const passend:string[]=[];
  let onzeker=false;
  for(const c of toetsbaar) {
    if(!c.methodeBevestigd || !['bar','nar'].includes(c.methode) || c.strategie!=='belegging') {
      onzeker=true;
      continue;
    }
    const waarde=c.methode==='bar'?object.brutoAanvangsrendement:object.nettoAanvangsrendement;
    if(typeof waarde!=='number'||!Number.isFinite(waarde)) {
      onzeker=true;
      continue;
    }
    const uitleg=`${c.methode.toUpperCase()}: object ${waarde.toLocaleString('nl-NL')}%, criterium ${c.percentage.toLocaleString('nl-NL')}% (indicatief).`;
    if(waarde<c.percentage) lager.push(uitleg);
    else passend.push(uitleg);
  }
  if(lager.length)return {
    status:'indicatief_lager',
    uitleg:lager.join(' ')+' Geen automatische uitsluiting zonder verificatie van de berekening.',
    hardKnockout:false,
  };
  if(onzeker)return {
    status:'controle',
    uitleg:'Eén of meer rendementscriteria zijn niet vergelijkbaar of nog niet bevestigd.',
    hardKnockout:false,
  };
  if(passend.length)return {
    status:'indicatief_voldoet',
    uitleg:passend.join(' ')+' Onderliggende objectberekening nog controleren.',
    hardKnockout:false,
  };
  return {
    status:'controle',uitleg:'Nog geen rechtstreeks vergelijkbare rendementsgegevens.',
    hardKnockout:false,
  };
}
