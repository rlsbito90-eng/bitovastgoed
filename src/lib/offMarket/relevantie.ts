// Vastgoedrelevantie-ranking voor off-market signalen.
// Lager getal = relevanter. Sinds D.1.5 primair op `vergunningtype` (persistente kolom);
// valt terug op tekstuele heuristiek wanneer dat veld nog leeg is.
import type { OffMarketSignaal, OffMarketVergunningtype } from '@/lib/offMarket/types';

export interface RelevantieBucket {
  rang: number;
  label: string;
}

const BUCKET_BY_VERGUNNINGTYPE: Record<OffMarketVergunningtype, RelevantieBucket> = {
  splitsing:        { rang: 1, label: 'Splitsing' },
  woonvorming:      { rang: 2, label: 'Woonvorming' },
  omzetting:        { rang: 3, label: 'Omzetting' },
  functiewijziging: { rang: 4, label: 'Functiewijziging' },
  transformatie:    { rang: 5, label: 'Transformatie' },
  onttrekking:      { rang: 6, label: 'Onttrekking' },
  ontwikkeling:     { rang: 7, label: 'Ontwikkeling' },
  overig:           { rang: 8, label: 'Overige' },
};

function bucketUitTekst(s: OffMarketSignaal): RelevantieBucket {
  const text = `${s.titel ?? ''} ${s.omschrijving ?? ''} ${(s as any).notities ?? ''}`.toLowerCase();
  if (/\bsplitsingsvergunning\b|\bsplitsing\b|appartementsrecht|uitponding/.test(text)) return BUCKET_BY_VERGUNNINGTYPE.splitsing;
  if (/woonvormingsvergunning|woningvorm(ing|en)/.test(text)) return BUCKET_BY_VERGUNNINGTYPE.woonvorming;
  if (/omzettingsvergunning|onzelfstandige\s+woonruimte|kamergewijze|kamerverhuur|woningdelen/.test(text)) return BUCKET_BY_VERGUNNINGTYPE.omzetting;
  if (/functiewijziging|wijzigen\s+gebruik|gebruikswijziging/.test(text) || s.type_signaal === 'functiewijziging') return BUCKET_BY_VERGUNNINGTYPE.functiewijziging;
  if (/transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|bergingen?\s+naar\s+woonruimte/.test(text) || s.type_signaal === 'transformatiepotentie') return BUCKET_BY_VERGUNNINGTYPE.transformatie;
  if (/onttrekkingsvergunning|onttrekking/.test(text)) return BUCKET_BY_VERGUNNINGTYPE.onttrekking;
  if (/woningbouwproject|nieuwbouw|projectontwikkeling|gebiedsontwikkeling|herontwikkeling|appartement/.test(text)) return BUCKET_BY_VERGUNNINGTYPE.ontwikkeling;
  return BUCKET_BY_VERGUNNINGTYPE.overig;
}

export function relevantieBucket(s: OffMarketSignaal): RelevantieBucket {
  const vt = (s as any).vergunningtype as OffMarketVergunningtype | null | undefined;
  if (vt && BUCKET_BY_VERGUNNINGTYPE[vt]) return BUCKET_BY_VERGUNNINGTYPE[vt];
  return bucketUitTekst(s);
}

export function compareRelevantie(a: OffMarketSignaal, b: OffMarketSignaal): number {
  const ra = relevantieBucket(a).rang;
  const rb = relevantieBucket(b).rang;
  if (ra !== rb) return ra - rb;
  return (b.ai_score ?? -1) - (a.ai_score ?? -1);
}

