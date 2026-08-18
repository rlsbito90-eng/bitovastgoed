// Keuze van het meest passende zoekprofiel bij het toevoegen van een kandidaat.
// Een relatie kan meerdere actieve zoekprofielen hebben; we kiezen het profiel
// met de hoogste geldige matchscore in plaats van willekeurig het eerste.

export type ProfielKeuze = { zoekprofielId: string; score: number };

type MinimaalProfiel = { id: string; status?: string | null };

/**
 * Geeft het actieve profiel met de hoogste geldige score, of null wanneer geen
 * enkel actief profiel een geldige score oplevert (dan geen koppeling maken).
 */
export function kiesBesteZoekprofielMatch<T extends MinimaalProfiel>(
  profielen: T[] | null | undefined,
  scoreVan: (profiel: T) => number | undefined,
): ProfielKeuze | null {
  let beste: ProfielKeuze | null = null;
  for (const profiel of profielen ?? []) {
    if (!profiel || profiel.status !== 'actief') continue;
    let score: number | undefined;
    try {
      score = scoreVan(profiel);
    } catch {
      continue;
    }
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    if (!beste || score > beste.score) beste = { zoekprofielId: profiel.id, score };
  }
  return beste;
}
