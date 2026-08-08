import type { BriefversieContract } from './productiekernContract';

export class ProductiekernSnapshotTeGrootError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_SNAPSHOT_TE_GROOT';

  constructor(readonly aantalBytes: number, readonly maximaalAantalBytes: number) {
    super('Productiekern-snapshot overschrijdt de veilige leeslimiet.');
    this.name = 'ProductiekernSnapshotTeGrootError';
  }
}

export function bewaakBriefversieSnapshotLimiet(
  versie: BriefversieContract,
  maximaalAantalBytes = 256 * 1024,
): BriefversieContract {
  if (!Number.isInteger(maximaalAantalBytes)
      || maximaalAantalBytes < 1024
      || maximaalAantalBytes > 1024 * 1024) {
    throw new Error('Snapshotlimiet moet tussen 1024 en 1048576 bytes liggen.');
  }

  let json: string;
  try {
    json = JSON.stringify({
      inhoud: versie.inhoud,
      geadresseerde: versie.geadresseerde,
    });
  } catch {
    throw new Error('Productiekern-snapshot kan niet veilig worden geserialiseerd.');
  }

  const aantalBytes = new TextEncoder().encode(json).byteLength;
  if (aantalBytes > maximaalAantalBytes) {
    throw new ProductiekernSnapshotTeGrootError(aantalBytes, maximaalAantalBytes);
  }
  return versie;
}
