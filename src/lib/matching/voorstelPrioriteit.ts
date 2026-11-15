import type { ProfielRoute } from './rolMandaatAdapter';
import type { RendementsOordeel } from './rendementsOordeel';

/** De zichtbare status is een indicatie, geen kanspercentage of automatische knock-out. */
export type VoorstelPrioriteit = 'kansrijk'|'controleren'|'niet_aanbevolen';
export const VOORSTEL_LABELS:Record<VoorstelPrioriteit,string>={
  kansrijk:'Kansrijk (indicatief)',
  controleren:'Controle nodig',
  niet_aanbevolen:'Zwak onderbouwd',
};

/**
 * Gedeelde inhoudelijke beoordeling voor object- én relatiezijde.
 * Vastgoedtype, dealtype/strategie en locatie zijn bewijs; een passende
 * vraagprijs alléén maakt nooit een relevante aanbeveling.
 */
export function bepaalInhoudelijkeVoorstelPrioriteit(route:ProfielRoute):VoorstelPrioriteit {
  if(route.kwalificatie==='afwijkend')return 'niet_aanbevolen';
  const bewijs=route.bewijs;
  if(!bewijs)return 'niet_aanbevolen';
  const vastgoed=bewijs.vastgoedtype||bewijs.subcategorie;
  const strategie=bewijs.dealtype;
  const locatie=bewijs.locatie;
  if(!vastgoed && !(strategie&&locatie))return 'niet_aanbevolen';
  if(vastgoed&&locatie&&route.kwalificatie==='passend')return 'kansrijk';
  return 'controleren';
}

/** Financiële gegevens mogen een voorlopig kansrijke match degraderen tot
 * controle, nooit een onbekende uitkomst omzetten naar een harde uitsluiting.
 */
export function bepaalVoorstelPrioriteit(
  route:ProfielRoute,
  rendement:RendementsOordeel,
):VoorstelPrioriteit {
  const inhoudelijk=bepaalInhoudelijkeVoorstelPrioriteit(route);
  if(inhoudelijk==='kansrijk' &&
    (rendement.status==='controle'||rendement.status==='indicatief_lager')){
    return 'controleren';
  }
  return inhoudelijk;
}
export function rangVoorstelPrioriteit(p:VoorstelPrioriteit):number {
  return p==='kansrijk'?3:p==='controleren'?2:1;
}
