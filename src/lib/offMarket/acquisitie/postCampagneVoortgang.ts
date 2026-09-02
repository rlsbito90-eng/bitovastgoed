import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';

const POST_STAPPEN: readonly CampagneStap[] = ['brief_1', 'brief_2', 'brief_3'];

function isPost(brief: OffMarketBrief): boolean {
  return (brief.kanaal ?? 'post') === 'post';
}

function isVerzonden(brief: OffMarketBrief): boolean {
  const verzendstatus = String(brief.verzendstatus ?? '');
  return brief.status === 'verstuurd'
    || verzendstatus === 'gepost'
    || verzendstatus === 'verzonden';
}

function stapIsPost(stap: OffMarketBrief['campagne_stap']): stap is CampagneStap {
  return POST_STAPPEN.includes(stap as CampagneStap);
}

function verzendMoment(brief: OffMarketBrief): string {
  return brief.verzonden_op
    ?? brief.postdatum
    ?? brief.updated_at
    ?? brief.created_at
    ?? '';
}

/**
 * Bepaal de bezette briefstappen uit de werkelijke verzendhistorie. Legacy
 * brieven zonder stap vullen chronologisch de eerste nog vrije positie, exact
 * zoals de centrale vervolgbriefplanner dat deed.
 */
export function verstuurdePoststappen(
  brieven: readonly OffMarketBrief[],
): Set<CampagneStap> {
  const verzonden = brieven
    .filter((brief) => !brief.archived_at && isPost(brief) && isVerzonden(brief))
    .sort((a, b) => verzendMoment(a).localeCompare(verzendMoment(b)));
  const bezet = new Set<CampagneStap>();
  for (const brief of verzonden) {
    if (stapIsPost(brief.campagne_stap)) {
      bezet.add(brief.campagne_stap);
      continue;
    }
    const eersteVrije = POST_STAPPEN.find((stap) => !bezet.has(stap));
    if (eersteVrije) bezet.add(eersteVrije);
  }
  return bezet;
}

export function volgendePostCampagneStap(
  brieven: readonly OffMarketBrief[],
): CampagneStap | null {
  const bezet = verstuurdePoststappen(brieven);
  if (bezet.size === 0) return null;
  const hoogste = Math.max(...[...bezet].map((stap) => POST_STAPPEN.indexOf(stap)));
  return hoogste >= POST_STAPPEN.length - 1 ? null : POST_STAPPEN[hoogste + 1];
}

/**
 * Een concept/definitieve brief is operationeel actueel wanneer er nog niets
 * is verzonden, of wanneer hij exact de volgende stap na de verzendhistorie is.
 * Zo wint Brief 2 in productie van de reeds geposte Brief 1, zonder dat een oud
 * dubbel concept van Brief 1 opnieuw naar voren komt.
 */
export function isActueleOnverzondenPostbrief(
  brief: OffMarketBrief,
  postbrieven: readonly OffMarketBrief[],
): boolean {
  if (brief.archived_at || !isPost(brief)) return false;
  if (brief.status !== 'concept' && brief.status !== 'definitief') return false;
  const verzondenStappen = verstuurdePoststappen(postbrieven);
  if (verzondenStappen.size === 0) return true;
  const volgende = volgendePostCampagneStap(postbrieven);
  return volgende !== null && brief.campagne_stap === volgende;
}

/** Laat per geadresseerde alleen de meest recente echte verzending over. */
export function actueleVerzondenBrievenPerGeadresseerde(
  brieven: readonly OffMarketBrief[],
): OffMarketBrief[] {
  const perGeadresseerde = new Map<string, OffMarketBrief>();
  for (const brief of brieven) {
    if (brief.archived_at || !isVerzonden(brief)) continue;
    const key = brief.geadresseerde_key ?? geadresseerdeKey(brief);
    const bestaand = perGeadresseerde.get(key);
    if (!bestaand || verzendMoment(brief) > verzendMoment(bestaand)) {
      perGeadresseerde.set(key, brief);
    }
  }
  return [...perGeadresseerde.values()];
}

