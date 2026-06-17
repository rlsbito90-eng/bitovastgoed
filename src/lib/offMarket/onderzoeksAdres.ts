/**
 * Helpers om externe onderzoekslinks (Google Maps, Google Search, BAG
 * Viewer, KadastraleKaart.com) op te bouwen vanuit een Off-Market signaal.
 *
 * De adresquery wordt opgeschoond zodat signaal-/vergunningswoorden zoals
 * "Aanvraag", "Besluit", "Omgevingsvergunning" niet in de zoekopdracht
 * terechtkomen. De meest specifieke adresvariant (incl. huisletter,
 * toevoeging en postcode) blijft behouden.
 */

const NOISE_PATTONS: RegExp[] = [
  /\baanvra(?:ag|gen)\b/gi,
  /\baangevraagde?\b/gi,
  /\bbesluit(?:en)?\b/gi,
  /\bverleend(?:e)?\b/gi,
  /\bingetrokken\b/gi,
  /\bgeweigerd(?:e)?\b/gi,
  /\bontwerp(?:besluit)?\b/gi,
  /\bkennisgeving(?:en)?\b/gi,
  /\bvergunning(?:en)?\b/gi,
  /\bomgevingsvergunning(?:en)?\b/gi,
  /\bsplitsingsvergunning(?:en)?\b/gi,
  /\bwoonvormingsvergunning(?:en)?\b/gi,
  /\bonttrekkingsvergunning(?:en)?\b/gi,
  /\bkamerverhuurvergunning(?:en)?\b/gi,
  /\bkamerverhuur\b/gi,
  /\bsloopvergunning(?:en)?\b/gi,
  /\bbouwvergunning(?:en)?\b/gi,
  /\bmelding(?:en)?\b/gi,
  /\bbekendmaking(?:en)?\b/gi,
  /\bintrekkingsbesluit\b/gi,
  /\bomzetting(?:svergunning)?\b/gi,
  /\bonttrekking(?:svergunning)?\b/gi,
  /\bontrekkingsvergunning\b/gi,
  /\bwoonvorming\b/gi,
];

export function schoonAdresTekst(input: string | null | undefined): string {
  if (!input) return '';
  let t = input;
  for (const re of NOISE_PATTONS) t = t.replace(re, ' ');
  // Verwijder dubbele leestekens/whitespace en komma's-aan-begin/eind
  t = t.replace(/[\s,;]+/g, ' ').trim();
  t = t.replace(/^[,\s]+|[,\s]+$/g, '');
  return t;
}

export interface OnderzoeksAdresSignaal {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}

/**
 * Bouwt een opgeschoonde adresquery: "<straat huisnummer[+toevoeging]> [postcode] [plaats]"
 * zonder signaalwoorden. Retourneert null als er geen bruikbaar adres is.
 */
export function bouwOnderzoeksAdresQuery(
  signaal: OnderzoeksAdresSignaal,
): string | null {
  const adres = schoonAdresTekst(signaal.adres);
  const postcode = (signaal.postcode ?? '').trim();
  const plaats = schoonAdresTekst(signaal.plaats);

  const delen: string[] = [];
  if (adres) delen.push(adres);
  if (postcode) delen.push(postcode);
  if (plaats && !adres.toLowerCase().endsWith(plaats.toLowerCase())) delen.push(plaats);

  const query = delen.join(' ').replace(/\s+/g, ' ').trim();
  return query.length > 0 ? query : null;
}

export function bouwGoogleMapsUrl(
  signaal: OnderzoeksAdresSignaal & { lat?: number | null; lng?: number | null },
): string | null {
  const query = bouwOnderzoeksAdresQuery(signaal);
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  if (typeof signaal.lat === 'number' && typeof signaal.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${signaal.lat},${signaal.lng}`;
  }
  return null;
}

export function bouwGoogleSearchUrl(signaal: OnderzoeksAdresSignaal): string | null {
  const query = bouwOnderzoeksAdresQuery(signaal);
  return query ? `https://www.google.com/search?q=${encodeURIComponent(query)}` : null;
}

/**
 * BAG Viewer ondersteunt geen gegarandeerde deep-link met vooraf
 * ingevuld adres. We openen de viewer zelf — de gebruiker plakt het
 * gekopieerde adres in de zoekbalk.
 */
export function bouwBagViewerUrl(): string {
  return 'https://bagviewer.kadaster.nl/lvbag/bag-viewer/';
}

/**
 * KadastraleKaart.com heeft geen betrouwbare deep-link met vooraf
 * ingevuld adres. We openen de homepage en laten de gebruiker plakken.
 */
export function bouwKadastraleKaartUrl(): string {
  return 'https://kadastralekaart.com/';
}
