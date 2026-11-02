import type { CommercieleRol, Partijprofiel } from '@/data/mock-data';

/**
 * A15.9: partijprofiel = primaire identiteit; activiteiten = aanvullende functies.
 * Een bemiddelaar kan ook ontwikkelen. Een ontwikkelaar hoeft de eigen
 * hoofdclassificatie niet een tweede keer als activiteit aan te kruisen.
 * Oude waarden worden nooit stilzwijgend herleid of verwijderd.
 */
export const TRANSACTIEACTIVITEITEN = [
  { value: 'koper', label: 'Koopt zelf vastgoed', toelichting: 'Kan zelf als kandidaat-koper optreden; dit bevestigt geen aankoop of bod.' },
  { value: 'verkoper', label: 'Verkoopt vastgoed', toelichting: 'Kan vastgoed ter verkoop aanbieden, voor eigen rekening of als contactroute.' },
  { value: 'bemiddelaar', label: 'Bemiddelt voor derden', toelichting: 'Kan proposities doorzetten naar kopers uit het netwerk, ook zonder bekend mandaat.' },
  { value: 'ontwikkelaar', label: 'Ontwikkelt vastgoed', toelichting: 'Is daarnaast actief als ontwikkelaar. Alleen aanvullend op het primaire partijprofiel.' },
  { value: 'adviseur', label: 'Adviseert partijen', toelichting: 'Trekt op als adviseur bij vastgoedtransacties.' },
  { value: 'beheerder', label: 'Beheert vastgoed', toelichting: 'Heeft vastgoedbeheer als activiteit.' },
  { value: 'financier', label: 'Financiert vastgoed', toelichting: 'Kan financiering voor vastgoed verstrekken of organiseren.' },
] as const satisfies readonly { value: CommercieleRol; label: string; toelichting: string }[];

export type Transactieactiviteit = typeof TRANSACTIEACTIVITEITEN[number]['value'];
const wijzigbaar = new Set<string>(TRANSACTIEACTIVITEITEN.map(r=>r.value));

/** Geen dubbele hoofdindeling. Zonder bevestigd partijprofiel blijft de
 * oude rol 'ontwikkelaar' historisch en niet impliciet wijzigbaar. */
export function magAanvullendeActiviteit(
  rol:CommercieleRol,
  partijprofiel:Partijprofiel|null|undefined,
):rol is Transactieactiviteit{
  if(!wijzigbaar.has(rol))return false;
  if(rol==='ontwikkelaar')
    return !!partijprofiel
      &&partijprofiel!=='ontwikkelaar'
      &&partijprofiel!=='ontwikkelende_belegger';
  if(rol==='bemiddelaar'&&partijprofiel==='bemiddelaar')return false;
  return true;
}
export function wijzigbareActiviteiten(
  rollen:readonly CommercieleRol[]|null|undefined,
  partijprofiel?:Partijprofiel|null,
):Transactieactiviteit[]{
  return (rollen??[]).filter((r):r is Transactieactiviteit=>
    magAanvullendeActiviteit(r,partijprofiel));
}

/**
 * Behoud alle verborgen, onbekende of oude rolindicaties. Bewerk uitsluitend
 * de activiteiten die voor het huidige partijprofiel selecteerbaar zijn.
 */
export function voegActiviteitenSamen(
  bestaand:readonly CommercieleRol[]|null|undefined,
  gekozen:readonly Transactieactiviteit[],
  partijprofiel?:Partijprofiel|null,
):CommercieleRol[]{
  const historie=(bestaand??[]).filter(r=>
    !magAanvullendeActiviteit(r,partijprofiel));
  const aangepast=gekozen.filter(r=>magAanvullendeActiviteit(r,partijprofiel));
  return [...new Set<CommercieleRol>([...historie,...aangepast])];
}

export function gelijkeRollen(
  a:readonly CommercieleRol[]|null|undefined,
  b:readonly CommercieleRol[]|null|undefined,
):boolean{
  return JSON.stringify([...(a??[])].sort())===JSON.stringify([...(b??[])].sort());
}
