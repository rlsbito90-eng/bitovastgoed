// Vastgoedrelevantie-ranking voor off-market signalen.
// Lager getal = relevanter. Gebruikt titel, omschrijving en notities + type_signaal.
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export interface RelevantieBucket {
  rang: number;
  label: string;
}

export function relevantieBucket(s: OffMarketSignaal): RelevantieBucket {
  const text = `${s.titel ?? ''} ${s.omschrijving ?? ''} ${(s as any).notities ?? ''}`.toLowerCase();
  if (/\bsplitsingsvergunning\b|\bsplitsing\b|appartementsrecht|uitponding/.test(text)) {
    return { rang: 1, label: 'Splitsing' };
  }
  if (/woonvormingsvergunning|woningvorm(ing|en)/.test(text)) {
    return { rang: 2, label: 'Woonvorming' };
  }
  if (/omzettingsvergunning|onzelfstandige\s+woonruimte|kamergewijze|kamerverhuur|woningdelen/.test(text)) {
    return { rang: 3, label: 'Omzetting' };
  }
  if (/functiewijziging|wijzigen\s+gebruik|gebruikswijziging/.test(text) || s.type_signaal === 'functiewijziging') {
    return { rang: 4, label: 'Functiewijziging' };
  }
  if (/transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|bergingen?\s+naar\s+woonruimte/.test(text)
      || s.type_signaal === 'transformatiepotentie') {
    return { rang: 5, label: 'Transformatie' };
  }
  if (/onttrekkingsvergunning|onttrekking/.test(text)) {
    return { rang: 6, label: 'Onttrekking' };
  }
  if (/woningbouwproject|nieuwbouw|projectontwikkeling|gebiedsontwikkeling|herontwikkeling|appartement/.test(text)) {
    return { rang: 7, label: 'Ontwikkeling' };
  }
  return { rang: 8, label: 'Overige' };
}

export function compareRelevantie(a: OffMarketSignaal, b: OffMarketSignaal): number {
  const ra = relevantieBucket(a).rang;
  const rb = relevantieBucket(b).rang;
  if (ra !== rb) return ra - rb;
  return (b.ai_score ?? -1) - (a.ai_score ?? -1);
}
