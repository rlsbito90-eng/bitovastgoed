import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import {
  faseInfo,
  isVolledigPostadres,
  tellGeadresseerden,
  type GeadresseerdeReadiness,
  type SignaalReadiness,
} from '@/lib/offMarket/acquisitie/readiness';

interface CanoniekeRechthebbende {
  naam?: string | null;
  bedrijfsnaam?: string | null;
  kvk?: string | null;
  aandeel?: string | null;
  rechtstype?: string | null;
  rechtssituatie?: string | null;
  straat_huisnummer?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  verzendadres?: string | null;
  bron?: string | null;
}

function schoon(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function canoniekeRechthebbenden(signaal: OffMarketSignaal): CanoniekeRechthebbende[] {
  const raw = (signaal as any).eigenaar_rechthebbenden;
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is CanoniekeRechthebbende => !!r && typeof r === 'object');
}

function virtueleGeadresseerden(signaal: OffMarketSignaal): GeadresseerdeReadiness[] {
  return canoniekeRechthebbenden(signaal)
    .filter((r) => schoon(r.naam) || schoon(r.bedrijfsnaam))
    .map((r, index) => {
      const naam = schoon(r.naam) || null;
      const bedrijfsnaam = schoon(r.bedrijfsnaam) || null;
      const adres = schoon(r.verzendadres) || null;
      const sleutelBron = schoon(r.kvk)
        || schoon(r.bedrijfsnaam)
        || schoon(r.naam)
        || `${index}`;
      return {
        key: `_rechthebbende|${signaal.id}|${sleutelBron.toLowerCase()}`,
        naam,
        bedrijfsnaam,
        verzendadres: adres,
        volledigPostadres: isVolledigPostadres(adres),
        laatsteBrief: null,
        heeftActiefConcept: false,
        heeftVerstuurd: false,
        heeftGeprint: false,
        heeftGepost: false,
        heeftEmailVerzonden: false,
        opvolgingOpen: false,
        responsBinnen: false,
        geblokkeerd: false,
      };
    });
}

/**
 * Readiness-adapter voor de periode vóórdat er brieven zijn gemaakt.
 * Meerdere canonieke Kadasterrechthebbenden tellen direct als afzonderlijke
 * geadresseerden en kunnen dus zonder handmatige tussenstap naar
 * `Brief voorbereiden`. Zodra er echte brieven bestaan blijft de bestaande
 * briefgebaseerde readiness leidend; bulk briefvoorbereiding wordt later
 * daarop aangesloten.
 */
export function pasCanoniekeRechthebbendenToeOpReadiness(
  signaal: OffMarketSignaal,
  brieven: OffMarketBrief[],
  basis: SignaalReadiness,
): SignaalReadiness {
  if (brieven.some((b) => !b.archived_at)) return basis;

  const geadresseerden = virtueleGeadresseerden(signaal);
  if (geadresseerden.length === 0) return basis;

  const a = signaal as any;
  if (a.eigenaar_controle_nodig === true) return basis;

  const telling = tellGeadresseerden(geadresseerden);
  const allemaalCompleet = geadresseerden.every((g) => g.volledigPostadres);
  const fase = allemaalCompleet ? 'brief_voorbereiden' : 'adres_ontbreekt';
  const waarschuwingen = [...basis.waarschuwingen.filter((w) => w !== 'meerdere_geadresseerden')];
  if (geadresseerden.length > 1) waarschuwingen.push('meerdere_geadresseerden');

  return {
    ...basis,
    fase,
    info: faseInfo(fase),
    geadresseerden,
    telling,
    waarschuwingen,
    blokkadeReden: allemaalCompleet
      ? null
      : 'Van één of meer rechthebbenden ontbreekt een volledig postadres.',
  };
}
