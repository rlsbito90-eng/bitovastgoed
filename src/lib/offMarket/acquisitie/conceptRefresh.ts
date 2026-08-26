import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

export type ConceptRefreshClassificatie = 'actueel' | 'legacy_standaard' | 'afwijkend_mogelijk_handmatig';

function norm(v: string | null | undefined): string {
  return (v ?? '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}

const LEGACY_STANDAARD_MARKERS = [
  'Vanuit mijn kantoor begeleid ik professionele beleggers, ontwikkelaars en vastgoedondernemers',
  'Binnen mijn netwerk is er regelmatig vraag naar vastgoed in deze omgeving, met name naar panden met beleggings-, verhuur-, splitsings-, transformatie- of ontwikkelpotentie',
];

/**
 * Conservatieve classificatie voor bulk "standaardtekst herstellen".
 * Alleen exact-actuele tekst of herkenbare historische standaardtekst is veilig
 * automatisch te behandelen. Ieder ander verschil geldt als mogelijk handmatig.
 */
export function classificeerConceptVoorVernieuwing(
  brief: Pick<OffMarketBrief, 'status' | 'brieftekst'>,
  actueleBrieftekst: string,
): ConceptRefreshClassificatie {
  if (brief.status !== 'concept') return 'afwijkend_mogelijk_handmatig';
  const bestaand = norm(brief.brieftekst);
  const actueel = norm(actueleBrieftekst);
  if (bestaand === actueel) return 'actueel';
  if (LEGACY_STANDAARD_MARKERS.some((marker) => bestaand.includes(norm(marker)))) {
    return 'legacy_standaard';
  }
  return 'afwijkend_mogelijk_handmatig';
}

export function magConceptAutomatischVernieuwen(
  classificatie: ConceptRefreshClassificatie,
  explicietAfwijkendOverschrijven: boolean,
): boolean {
  return classificatie === 'legacy_standaard'
    || (classificatie === 'afwijkend_mogelijk_handmatig' && explicietAfwijkendOverschrijven);
}
