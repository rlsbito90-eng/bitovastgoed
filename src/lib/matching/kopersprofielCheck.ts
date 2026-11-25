import type { CrmRelatieInput, CrmMandaatInput } from './rolMandaatAdapter';
import type { Rendementscriterium } from '@/hooks/useRelatieMatchingData';
import type { Risicovoorkeur } from '../relaties/risicovoorkeuren';

export type ProfielCheckPunt={id:string;label:string;vraag:string;doel:'vastgoed'|'voorwaarden'|'financiering'|'rendement'|'risico'|'zoekprofiel'};
export type ProfielCheckRoute={id:string|null;naam:string;punten:ProfielCheckPunt[]};
const gevuld=(v?:readonly unknown[]|null)=>!!v?.length;
const tekst=(v?:string|null)=>!!v?.trim();
const bedrag=(v?:number|null)=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function controleerKopersprofiel(
  r:CrmRelatieInput, profielen:readonly CrmMandaatInput[],
  criteria:readonly Rendementscriterium[], risico:readonly Risicovoorkeur[],
):ProfielCheckRoute[]{
  const actief=profielen.filter(p=>p.relatieId===r.id&&p.status==='actief');
  const zoekend=!!r.commercialRoles?.some(x=>['koper','bemiddelaar','makelaar','ontwikkelaar'].includes(x))||
    ['belegger','ontwikkelaar','makelaar'].includes(r.type??'');
  if(!zoekend&&!actief.length)return [];
  const bouw=(p?:CrmMandaatInput):ProfielCheckRoute=>{
    const punten:ProfielCheckPunt[]=[];
    const voeg=(id:string,label:string,vraag:string,doel:ProfielCheckPunt['doel'])=>punten.push({id,label,vraag,doel});
    const profielDoel=p?'zoekprofiel':'vastgoed';
    if(!gevuld(p?p.propertyTypeIds:r.propertyTypeIds)&&!gevuld(p?p.typeVastgoed:r.assetClasses)&&!gevuld(p?p.propertySubtypeIds:r.propertySubtypeIds))
      voeg('vastgoed','Vastgoedtypen ontbreken','Welke vastgoedtypen en subcategorieën komen in aanmerking?',profielDoel);
    if(!gevuld(p?p.dealTypeIds:r.dealTypeIds))
      voeg('strategie','Strategie niet gestructureerd','Gaat het om belegging, handel, ontwikkeling of transformatie?',profielDoel);
    const radius=!p&&tekst(r.zoekRadiusCentrum)&&bedrag(r.zoekRadiusWaarde)&&!!r.zoekRadiusEenheid;
    if(!gevuld(p?p.regio:r.regio)&&!gevuld(p?p.steden:r.zoekGemeenten)&&!(!p&&gevuld(r.zoekPlaatsen))&&!radius)
      voeg('locatie','Zoekgebied ontbreekt','Welke provincies, plaatsen of radius zijn relevant? Landelijk is ook een keuze.',profielDoel);
    if(!bedrag(p?p.prijsMin:r.budgetMin)&&!bedrag(p?p.prijsMax:r.budgetMax))
      voeg('budget','Budget niet vastgelegd','Welke aankoopprijs of bandbreedte is bespreekbaar?',p?'zoekprofiel':'financiering');
    const relevant=criteria.filter(c=>c.relatieId===r.id&&c.status==='actief'&&(!c.zoekprofielId||c.zoekprofielId===p?.id));
    const drempels=relevant.filter(c=>['minimum','maximum','doel'].includes(c.criteriumType));
    if(!drempels.length)
      voeg('rendement','Geen concreet rendementsdoel','Hanteert de partij BAR, NAR, Factor, projectrendement of een andere maatstaf? Of is dit per deal?', 'rendement');
    else if(drempels.some(c=>!c.methodeBevestigd||['onbekend','netto_onbekend','overig'].includes(c.methode)))
      voeg('rendement','Rendementsdefinitie te bevestigen','Welke berekeningsgrondslag en grens hanteert de investeerder?', 'rendement');
    if(!p&&!tekst(r.hardeAankoopvoorwaarden)&&!tekst(r.uitsluitingen)&&!tekst(r.aankoopvoorkeuren))
      voeg('voorwaarden','Voorwaarden niet beschreven','Zijn er harde uitsluitingen of voorkeuren, of juist geen specifieke beperkingen?', 'voorwaarden');
    if(!p&&!risico.some(v=>v.relatieId===r.id&&v.bevestigd&&tekst(v.bron)))
      voeg('risico','Risicobereidheid nog te bevestigen','Welke risico’s accepteert de partij, bijvoorbeeld leegstand, renovatie of vergunningstrajecten?', 'risico');
    return {id:p?.id??null,naam:p?.naam??'Algemene aankoopcriteria',punten};
  };
  return [...(zoekend?[bouw()]:[]),...actief.map(bouw)];
}
