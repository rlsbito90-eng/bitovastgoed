import type { Rendementscriterium } from '@/hooks/useRelatieMatchingData';

/** Financiële toetsing is indicatief totdat de objectberekening en de
 * gehanteerde rendementsdefinities daadwerkelijk zijn geverifieerd.
 * BAR, NAR, GDV-marge, projectkosten en IRR zijn niet uitwisselbaar.
 */
export type RendementsOordeel = {
  status:'niet_van_toepassing'|'controle'|'indicatief_voldoet'|'indicatief_lager';
  uitleg:string;
  hardKnockout:false;
  prijsindicatie?: { maximum:number; grondslag:'BAR'|'Factor'; verschilVraagprijs:number|null; overigeCriteriaOngetoetst:boolean };
};

export function beoordeelObjectRendement(
  object:{brutoAanvangsrendement?:number|null;nettoAanvangsrendement?:number|null;vraagprijs?:number|null;huurinkomsten?:number|null},criteria:readonly Rendementscriterium[],zoekprofielId?:string|null,
):RendementsOordeel {
  const relevant=criteria.filter(c=>c.status==='actief' &&
    (!c.zoekprofielId || c.zoekprofielId===zoekprofielId));
  if(!relevant.length)return {
    status:'niet_van_toepassing',uitleg:'Geen rendementscriterium vastgelegd',hardKnockout:false,
  };

  // De criteria van een afzonderlijk zoekprofiel vervangen slechts de
  // algemene criteria voor diezelfde strategie; andere strategieën blijven bestaan.
  const specifiek=relevant.filter(c=>!!c.zoekprofielId);
  const best=relevant.filter(c=>!!c.zoekprofielId || !specifiek.some(s=>s.strategie===c.strategie && s.methode===c.methode && s.criteriumType===c.criteriumType));
  const toetsbaar=best.filter(c=>c.criteriumType==='minimum'||c.criteriumType==='maximum'||c.criteriumType==='doel');

  // Een historisch of gemiddeld percentage is geen financiële aankoopdrempel.
  if(!toetsbaar.length)return {
    status:'niet_van_toepassing',
    uitleg:'Alleen historische of gemiddelde rendementen; geen toetsbaar rendementsdoel.',
    hardKnockout:false,
  };

  const prijsgrenzen: {maximum:number;grondslag:'BAR'|'Factor'}[]=[];
  const jaarhuur=object.huurinkomsten;
  if(typeof jaarhuur==='number' && Number.isFinite(jaarhuur) && jaarhuur>0) {
    for(const c of toetsbaar) {
      if(!c.methodeBevestigd || c.strategie!=='belegging' || !Number.isFinite(c.percentage) || c.percentage<=0) continue;
      const maximum=c.methode==='bar' && c.criteriumType==='minimum' ? jaarhuur*100/c.percentage : c.methode==='factor' && c.criteriumType==='maximum' ? jaarhuur*c.percentage : null;
      if(maximum!==null && Number.isFinite(maximum)) prijsgrenzen.push({maximum,grondslag:c.methode==='bar'?'BAR':'Factor'});
    }
  }
  prijsgrenzen.sort((a,b)=>a.maximum-b.maximum);
  const grens=prijsgrenzen[0];
  const prijs=object.vraagprijs;
  const prijsindicatie=grens ? { ...grens, maximum:Math.floor(grens.maximum), verschilVraagprijs:typeof prijs==='number' && Number.isFinite(prijs) && prijs>0 ? prijs-Math.floor(grens.maximum) : null,
    overigeCriteriaOngetoetst:toetsbaar.some(c=>!c.methodeBevestigd || c.strategie!=='belegging' || !(c.methode==='bar' && c.criteriumType==='minimum' || c.methode==='factor' && c.criteriumType==='maximum') || !Number.isFinite(c.percentage) || c.percentage<=0) } : undefined;
  const lager:string[]=[];
  const passend:string[]=[];
  let onzeker=false;
  for(const c of toetsbaar) {
    if(!c.methodeBevestigd || !['bar','nar','factor'].includes(c.methode) || c.strategie!=='belegging') {
      onzeker=true;
      continue;
    }
    const prijs=object.vraagprijs, jaarhuur=object.huurinkomsten;
    const bronGeldig=typeof prijs==='number' && Number.isFinite(prijs) && prijs>0 && typeof jaarhuur==='number' && Number.isFinite(jaarhuur) && jaarhuur>0;
    const waarde=c.methode==='factor'?(bronGeldig ? prijs!/jaarhuur! : undefined):c.methode==='bar'?(bronGeldig ? jaarhuur!/prijs!*100 : object.brutoAanvangsrendement):object.nettoAanvangsrendement;
    if(typeof waarde!=='number'||!Number.isFinite(waarde)) {
      onzeker=true;
      continue;
    }
    const eenheid=c.methode==='factor'?'×':'%';
    const label=c.methode==='factor'?'Factor (vraagprijs / brutojaarhuur)':c.methode.toUpperCase();
    const fmt=(n:number)=>n.toLocaleString('nl-NL',{maximumFractionDigits:2});
    const uitleg=`${label}: object ${fmt(waarde)}${eenheid}, ${c.methode==='factor'?'max. ':'min. '}${fmt(c.percentage)}${eenheid} (indicatief).`;
    if(c.methode==='factor'?waarde>c.percentage:waarde<c.percentage) lager.push(uitleg);
    else passend.push(uitleg);
  }
  if(lager.length)return {
    status:'indicatief_lager',
    uitleg:[...lager,...passend].join(' ')+(onzeker?' Overige criteria nog niet vergelijkbaar.':'')+' Geen automatische uitsluiting zonder verificatie van de berekening.',
    hardKnockout:false,prijsindicatie,
  };
  if(onzeker)return {
    status:'controle',
    uitleg:[...passend,'Eén of meer rendementscriteria zijn niet vergelijkbaar of nog niet bevestigd.'].join(' '),
    hardKnockout:false,prijsindicatie,
  };
  if(passend.length)return {
    status:'indicatief_voldoet',
    uitleg:passend.join(' ')+' Onderliggende objectberekening nog controleren.',
    hardKnockout:false,prijsindicatie,
  };
  return {
    status:'controle',uitleg:'Nog geen rechtstreeks vergelijkbare rendementsgegevens.',
    hardKnockout:false,prijsindicatie,
  };
}
