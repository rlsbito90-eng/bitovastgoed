/**
 * Bouwt een Google Maps zoek-URL uit losse adresvelden.
 * Werkt zowel op desktop (opent maps.google.com) als op mobiel
 * (iOS/Android herkennen deze universele link en kunnen doorrouteren
 * naar de geïnstalleerde kaartapplicatie).
 *
 * Retourneert null als er onvoldoende locatiegegevens zijn om iets
 * zinnigs te zoeken (geen straat, geen postcode, geen plaats).
 */
export function buildMapsUrl(parts: {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  provincie?: string | null;
  land?: string | null;
}): string | null {
  const adres = parts.adres?.trim();
  const postcode = parts.postcode?.trim();
  const plaats = parts.plaats?.trim();
  const provincie = parts.provincie?.trim();
  const land = parts.land?.trim() || 'Nederland';

  // Minimaal iets bruikbaars vereist
  if (!adres && !postcode && !plaats) return null;

  const segments = [
    adres,
    [postcode, plaats].filter(Boolean).join(' ').trim() || null,
    provincie,
    land,
  ].filter((s): s is string => !!s && s.length > 0);

  const query = encodeURIComponent(segments.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Bouwt een Google Search-URL uit losse tekstdelen.
 * Lege/whitespace-only entries worden genegeerd. Retourneert null als
 * er geen bruikbare tekst over is.
 */
export function buildGoogleSearchUrl(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts
    .map((p) => (p ?? '').toString().trim())
    .filter((p) => p.length > 0);
  if (cleaned.length === 0) return null;
  const query = encodeURIComponent(cleaned.join(' '));
  return `https://www.google.com/search?q=${query}`;
}

/** Convenience: Google Search-URL voor een adres. */
export function buildAdresSearchUrl(parts: {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}): string | null {
  return buildGoogleSearchUrl([parts.adres, parts.postcode, parts.plaats]);
}
