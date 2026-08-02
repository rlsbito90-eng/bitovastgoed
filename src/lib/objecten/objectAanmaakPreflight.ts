import type { ObjectVastgoed } from '@/data/mock-data';
import { vindObjectMatches, type ObjectMatchInput, type ObjectMatchResultaat } from './objectMatchService';

/**
 * Read-only controle vóór het aanmaken van een nieuw Object.
 * Alleen exacte, sterke identifiers worden getoond. De functie muteert niets.
 */
export function beoordeelObjectAanmaakPreflight(
  input: ObjectMatchInput,
  objecten: ObjectVastgoed[],
): ObjectMatchResultaat[] {
  return vindObjectMatches(input, objecten)
    .filter((match) => match.score >= 80)
    .slice(0, 3);
}
