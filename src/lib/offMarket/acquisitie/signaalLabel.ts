import {
  SIGNAALTYPE_LABEL,
  VERGUNNINGTYPE_LABEL,
  type OffMarketSignaal,
  type OffMarketVergunningtype,
} from '@/lib/offMarket/types';

const SPECIFIEKE_VERGUNNING_LABEL: Partial<Record<OffMarketVergunningtype, string>> = {
  splitsing: 'Splitsingsvergunning',
  woonvorming: 'Woonvorming',
  omzetting: 'Omzettingsvergunning',
  onttrekking: 'Onttrekkingsvergunning',
  functiewijziging: 'Functiewijziging',
  transformatie: 'Transformatie',
  ontwikkeling: 'Ontwikkeling',
  overig: 'Vergunning',
};

/**
 * Operationeel label voor de Acquisitieselectie.
 *
 * De werkbak moet tonen waarom een object interessant is, niet alleen uit welke
 * technische bronfamilie het record kwam. Daarom krijgt een vergunning het
 * concrete vergunningtype en krijgt een BAG-signaal de herkenbare herkomst
 * Pandenverkenner.
 */
export function acquisitieSignaalLabel(signaal: OffMarketSignaal): string {
  if (signaal.bron_type === 'bag') return 'Pandenverkenner';

  if (signaal.type_signaal === 'vergunning_bekendmaking') {
    if (signaal.vergunningtype) {
      const vergunningtype = signaal.vergunningtype as OffMarketVergunningtype;
      return SPECIFIEKE_VERGUNNING_LABEL[vergunningtype]
        ?? VERGUNNINGTYPE_LABEL[vergunningtype]
        ?? 'Vergunning';
    }
    if (signaal.bron_type === 'vergunning') return 'Vergunning';
    if (signaal.bron_type === 'bekendmaking') return 'Bekendmaking';
  }

  return (SIGNAALTYPE_LABEL as Record<string, string>)[signaal.type_signaal]
    ?? signaal.type_signaal
    ?? '—';
}
