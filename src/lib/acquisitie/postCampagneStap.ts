import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';

const STAPPEN: CampagneStap[] = ['brief_1', 'brief_2', 'brief_3'];

const schoon = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/**
 * Bepaal de volgende post-campagnestap voor één geadresseerde.
 *
 * Eerst wordt de canonieke `geadresseerde_key` gebruikt. Voor oudere records
 * zonder key valt de helper terug op naam/bedrijfsnaam + verzendadres.
 * Alleen daadwerkelijk verstuurde postbrieven sluiten een stap af.
 */
export function bepaalVolgendePostCampagneStap(args: {
  brieven: OffMarketBrief[];
  geadresseerdeKey?: string | null;
  eigenaarNaam?: string | null;
  eigenaarBedrijfsnaam?: string | null;
  verzendadres?: string | null;
}): CampagneStap {
  const key = schoon(args.geadresseerdeKey);
  const naam = schoon(args.eigenaarNaam);
  const bedrijf = schoon(args.eigenaarBedrijfsnaam);
  const adres = schoon(args.verzendadres).replace(/(\d{4})\s+([a-z]{2})/g, '$1$2');

  const relevant = args.brieven.filter(brief => {
    if ((brief.kanaal ?? 'post') !== 'post') return false;

    if (key && schoon(brief.geadresseerde_key) === key) return true;

    const briefNaam = schoon(brief.eigenaar_naam);
    const briefBedrijf = schoon(brief.eigenaar_bedrijfsnaam);
    const briefAdres = schoon(brief.verzendadres).replace(/(\d{4})\s+([a-z]{2})/g, '$1$2');

    const heeftIdentiteit = !!(naam || bedrijf || adres);
    return heeftIdentiteit
      && briefNaam === naam
      && briefBedrijf === bedrijf
      && briefAdres === adres;
  });

  const verstuurdeStappen = new Set(
    relevant
      .filter(brief => brief.status === 'verstuurd')
      .map(brief => brief.campagne_stap)
      .filter((stap): stap is CampagneStap => STAPPEN.includes(stap as CampagneStap)),
  );

  for (const stap of STAPPEN) {
    if (!verstuurdeStappen.has(stap)) return stap;
  }

  return 'brief_3';
}
