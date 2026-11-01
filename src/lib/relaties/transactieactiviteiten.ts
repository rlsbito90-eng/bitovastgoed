import type { CommercieleRol } from '@/data/mock-data';

/**
 * A15.4: dit zijn activiteiten, geen tweede partijprofiel.
 * De historische rollen 'makelaar' en 'ontwikkelaar' blijven bewaard
 * maar worden niet langer aangeboden als concurrerende classificatie.
 */
export const TRANSACTIEACTIVITEITEN = [
  { value: 'koper', label: 'Koopt zelf vastgoed', toelichting: 'Kan zelf als kandidaat-koper optreden; dit bevestigt geen aankoop of bod.' },
  { value: 'verkoper', label: 'Verkoopt vastgoed', toelichting: 'Kan vastgoed ter verkoop aanbieden, voor eigen rekening of als contactroute.' },
  { value: 'bemiddelaar', label: 'Bemiddelt voor derden', toelichting: 'Kan proposities doorzetten naar kopers uit het netwerk, ook zonder bekend mandaat.' },
  { value: 'adviseur', label: 'Adviseert partijen', toelichting: 'Trekt op als adviseur bij vastgoedtransacties.' },
  { value: 'beheerder', label: 'Beheert vastgoed', toelichting: 'Heeft vastgoedbeheer als activiteit.' },
  { value: 'financier', label: 'Financiert vastgoed', toelichting: 'Kan financiering voor vastgoed verstrekken of organiseren.' },
] as const satisfies readonly { value: CommercieleRol; label: string; toelichting: string }[];

export type Transactieactiviteit = typeof TRANSACTIEACTIVITEITEN[number]['value'];
const wijzigbaar = new Set<string>(TRANSACTIEACTIVITEITEN.map(r=>r.value));

export function wijzigbareActiviteiten(rollen:readonly CommercieleRol[]|null|undefined):Transactieactiviteit[] {
  return (rollen??[]).filter((r):r is Transactieactiviteit=>wijzigbaar.has(r));
}

/** Behoud onbekende/oude rollen en laat uitsluitend activiteiten veranderen. */
export function voegActiviteitenSamen(
  bestaand:readonly CommercieleRol[]|null|undefined,
  gekozen:readonly Transactieactiviteit[],
):CommercieleRol[] {
  const historie=(bestaand??[]).filter(r=>!wijzigbaar.has(r));
  return [...new Set<CommercieleRol>([...historie,...gekozen])];
}

export function gelijkeRollen(a:readonly CommercieleRol[]|null|undefined,b:readonly CommercieleRol[]|null|undefined):boolean {
  return JSON.stringify([...(a??[])].sort())===JSON.stringify([...(b??[])].sort());
}
