import type { BriefversieContract } from './productiekernContract';

export class ProductiekernLeesIntegriteitError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEESINTEGRITEIT';

  constructor(reden: string) {
    super(`Productiekern-readintegriteit geschonden: ${reden}`);
    this.name = 'ProductiekernLeesIntegriteitError';
  }
}

/**
 * Bewaakt dat een briefversielijst begrensd, uniek en oplopend is. Hierdoor
 * worden dubbele of driftende records niet stil als geldig domeinmodel gebruikt.
 */
export function bewaakBriefversieLeesIntegriteit(
  versies: readonly BriefversieContract[],
  maximaalAantal = 100,
): BriefversieContract[] {
  if (!Number.isInteger(maximaalAantal) || maximaalAantal < 1 || maximaalAantal > 100) {
    throw new Error('Maximaal aantal briefversies moet tussen 1 en 100 liggen.');
  }
  if (versies.length > maximaalAantal) {
    throw new ProductiekernLeesIntegriteitError('te veel briefversies');
  }

  const ids = new Set<string>();
  const nummers = new Set<number>();
  let vorigVersienummer = 0;
  let briefId: string | null = null;

  for (const versie of versies) {
    if (ids.has(versie.id)) {
      throw new ProductiekernLeesIntegriteitError('dubbel briefversie-ID');
    }
    if (nummers.has(versie.versienummer)) {
      throw new ProductiekernLeesIntegriteitError('dubbel versienummer');
    }
    if (versie.versienummer <= vorigVersienummer) {
      throw new ProductiekernLeesIntegriteitError('versies zijn niet strikt oplopend');
    }
    if (briefId !== null && versie.briefId !== briefId) {
      throw new ProductiekernLeesIntegriteitError('versies horen bij verschillende brieven');
    }
    ids.add(versie.id);
    nummers.add(versie.versienummer);
    vorigVersienummer = versie.versienummer;
    briefId = versie.briefId;
  }

  return [...versies];
}
