import type { BulkKandidaat } from '@/lib/offMarket/acquisitie/bulkBrief';
import { isVolledigPostadres } from '@/lib/offMarket/acquisitie/readiness';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';

export const RADAR_PARTIJ_KEY_PREFIX = 'radar_geadresseerde:';
export const NIEUWE_PARTIJ_ID_PREFIX = 'new-radar-party:';

/**
 * Sterke lokale partij-identiteit voor Radar wanneer nog geen eigenaar_id bestaat.
 * Naam alleen is nooit voldoende: er moet een naam/bedrijfsnaam én een volledig
 * postadres aanwezig zijn. Juridische entiteiten met dezelfde naam maar een ander
 * adres worden dus niet stil samengevoegd.
 */
export function sterkeRadarPartijSleutel(kandidaat: Pick<BulkKandidaat,
  'naam' | 'bedrijfsnaam' | 'verzendadres' | 'geadresseerdeKey'>): string | null {
  if (!(kandidaat.naam || kandidaat.bedrijfsnaam)) return null;
  if (!isVolledigPostadres(kandidaat.verzendadres)) return null;
  const key = geadresseerdeKey({
    id: '_radar_party',
    eigenaar_naam: kandidaat.naam,
    eigenaar_bedrijfsnaam: kandidaat.bedrijfsnaam,
    verzendadres: kandidaat.verzendadres,
  } as any);
  if (!key || key.startsWith('_zonder|')) return null;
  return `${RADAR_PARTIJ_KEY_PREFIX}${key}`;
}

export function synthetischeRadarPartijId(identityKey: string): string {
  return `${NIEUWE_PARTIJ_ID_PREFIX}${encodeURIComponent(identityKey)}`;
}

export function decodeSynthetischeRadarPartijId(value: string): string | null {
  if (!value.startsWith(NIEUWE_PARTIJ_ID_PREFIX)) return null;
  try { return decodeURIComponent(value.slice(NIEUWE_PARTIJ_ID_PREFIX.length)); }
  catch { return null; }
}

export function parseRadarPartijSleutel(identityKey: string): {
  bedrijfsnaam: string | null;
  naam: string | null;
  adres: string | null;
  postcode: string | null;
  partijType: 'natuurlijk_persoon' | 'rechtspersoon' | 'onbekend';
} {
  const raw = identityKey.startsWith(RADAR_PARTIJ_KEY_PREFIX)
    ? identityKey.slice(RADAR_PARTIJ_KEY_PREFIX.length)
    : identityKey;
  const eerste = raw.indexOf('|');
  const tweede = eerste >= 0 ? raw.indexOf('|', eerste + 1) : -1;
  const bedrijfsnaam = eerste >= 0 ? raw.slice(0, eerste).trim() || null : null;
  const naam = eerste >= 0 && tweede >= 0 ? raw.slice(eerste + 1, tweede).trim() || null : null;
  const adres = tweede >= 0 ? raw.slice(tweede + 1).trim() || null : null;
  const postcodeMatch = adres?.match(/\b(\d{4})\s*([a-z]{2})\b/i);
  const postcode = postcodeMatch ? `${postcodeMatch[1]} ${postcodeMatch[2].toUpperCase()}` : null;
  return {
    bedrijfsnaam,
    naam,
    adres,
    postcode,
    partijType: bedrijfsnaam ? 'rechtspersoon' : naam ? 'natuurlijk_persoon' : 'onbekend',
  };
}
