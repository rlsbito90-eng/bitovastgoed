// Stabiele key per geadresseerde voor groepering van off-market brieven.
// Werkt puur op de bestaande velden van een brief — geen DB-wijziging nodig.
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

/** Genormaliseerde lower-case, whitespace-collapsed tekst. */
function norm(v: string | null | undefined): string {
  if (!v) return '';
  return v
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Normaliseer NL-postcode binnen tekst: "1071 vb" → "1071vb". */
function normPostcode(v: string): string {
  return v.replace(/(\d{4})\s+([a-z]{2})/g, '$1$2');
}

/**
 * Bouw een stabiele key voor een geadresseerde uit naam/bedrijfsnaam en
 * verzendadres. Brieven met identieke (genormaliseerde) waarden krijgen
 * dezelfde key en worden samen gegroepeerd.
 *
 * Als er onvoldoende identificerende data is (geen naam, geen bedrijf,
 * geen verzendadres) krijgt de brief een **unieke** fallback-key zodat
 * verschillende lege records niet ten onrechte worden samengevoegd.
 */
export function geadresseerdeKey(
  brief: Pick<OffMarketBrief, 'id' | 'eigenaar_naam' | 'eigenaar_bedrijfsnaam' | 'verzendadres'>,
): string {
  const naam = norm(brief.eigenaar_naam);
  const bedrijf = norm(brief.eigenaar_bedrijfsnaam);
  const adres = normPostcode(norm(brief.verzendadres));

  if (!naam && !bedrijf && !adres) {
    return `_zonder|${brief.id}`;
  }
  return [bedrijf, naam, adres].join('|');
}

/** Display-naam voor een geadresseerde. */
export function geadresseerdeDisplayNaam(
  brief: Pick<OffMarketBrief, 'eigenaar_naam' | 'eigenaar_bedrijfsnaam'>,
): string {
  const naam = (brief.eigenaar_naam ?? '').trim();
  const bedrijf = (brief.eigenaar_bedrijfsnaam ?? '').trim();
  if (bedrijf && naam) return `${naam} — ${bedrijf}`;
  return naam || bedrijf || '(zonder geadresseerde)';
}
