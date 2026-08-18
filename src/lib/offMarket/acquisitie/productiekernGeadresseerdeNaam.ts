import { isRechtspersoonNaam, naarVoorlettersAchternaam } from '@/lib/format/naam';

import type { GeadresseerdeSnapshot } from './productiekernContract';

/**
 * Enige presentatienaam voor formele Productiekern/BAT-output.
 *
 * - Een expliciete bedrijfsnaam wint en blijft exact intact.
 * - Een rechtspersoon die legacy alleen in `naam` staat blijft eveneens intact.
 * - Een natuurlijke persoon wordt naar voorletters + achternaam genormaliseerd;
 *   Kadaster-biografiesuffixen zoals `Geboren ... te ...` verdwijnen daarbij.
 *
 * De immutable snapshot zelf wordt niet gemuteerd; dit is uitsluitend een
 * deterministische outputnormalisatie voor brief, label en controlelijst.
 */
export function productiekernGeadresseerdeNaam(
  geadresseerde: Pick<GeadresseerdeSnapshot, 'naam' | 'bedrijfsnaam'>,
): string {
  const bedrijfsnaam = geadresseerde.bedrijfsnaam?.trim() ?? '';
  if (bedrijfsnaam) return bedrijfsnaam;

  const naam = geadresseerde.naam?.trim() ?? '';
  if (!naam) return '';
  if (isRechtspersoonNaam(naam)) return naam;
  return naarVoorlettersAchternaam(naam);
}
