// Pure helper voor het afkorten van volledige persoonsnamen naar
// voorletters + achternaam. Alleen voor natuurlijke personen;
// bedrijfsnamen en rechtspersonen worden nooit doorgegeven aan deze
// functie.
//
// Regels:
//   - Meerdere voornamen → voorletters met punt ("V.T. Achternaam").
//   - Achternaam blijft voluit.
//   - Tussenvoegsels blijven voluit.
//   - Koppelteken-voornamen worden apart afgekort ("A.M. de Vries").
//   - Reeds-afgekorte namen blijven ongemoeid ("P.J. Achternaam").
//   - Lege/onzekere input crasht niet en retourneert origineel.

const TUSSENVOEGSELS = new Set([
  'van', 'de', 'der', 'den', 'ter', 'te', 'ten', 'het',
  'aan', 'bij', 'uit', 'over', 'in', 'op', 'onder', 'tot', 'met',
  'zonder', 'via', 'vande', 'vander', 'vanden', 'dela', 'dele',
  "'t",
]);

function isTussenvoegsel(part: string): boolean {
  return TUSSENVOEGSELS.has(part.toLowerCase());
}

/** Detecteert reeds-afgekorte namen zoals "P.J. Achternaam" of "P. J. Achternaam". */
function isAlAfgkort(naam: string): boolean {
  return /^[A-Z]\.(?:\s?[A-Z]\.)*\s+/.test(naam);
}

/**
 * Zet een volledige natuurlijk-persoonsnaam om naar voorletters + achternaam.
 * Retourneert de originele string bij lege input, reeds-afgekorte namen of
 * wanneer geen achternaam kan worden bepaald.
 */
export function naarVoorlettersAchternaam(
  naam: string | null | undefined,
): string {
  if (!naam) return naam ?? '';
  const trimmed = naam.trim();
  if (!trimmed) return '';
  if (isAlAfgkort(trimmed)) return trimmed;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed;

  let tussenvoegselStart = -1;
  for (let i = 0; i < parts.length; i++) {
    if (isTussenvoegsel(parts[i]) && i < parts.length - 1) {
      tussenvoegselStart = i;
      break;
    }
  }

  let voornamen: string[];
  let achternaamParts: string[];

  if (tussenvoegselStart >= 0) {
    voornamen = parts.slice(0, tussenvoegselStart);
    achternaamParts = parts.slice(tussenvoegselStart);
  } else {
    voornamen = parts.slice(0, -1);
    achternaamParts = parts.slice(-1);
  }

  if (voornamen.length === 0) return trimmed;

  const voorletters = voornamen
    .map((v) => v.split('-').map((p) => p.charAt(0).toUpperCase()).join('.') + '.')
    .join('');

  return `${voorletters} ${achternaamParts.join(' ')}`;
}
