export class ProductiekernLeesIdentiteitError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEESIDENTITEIT';

  constructor(entiteit: string) {
    super(`${entiteit}-read retourneerde een ander record dan aangevraagd.`);
    this.name = 'ProductiekernLeesIdentiteitError';
  }
}

export function bewaakGevraagdeLeesIdentiteit(
  entiteit: string,
  gevraagdId: string,
  ontvangenId: string,
): void {
  if (!gevraagdId.trim() || ontvangenId !== gevraagdId) {
    throw new ProductiekernLeesIdentiteitError(entiteit);
  }
}

export function bewaakBriefversiesVoorGevraagdeBrief(
  gevraagdBriefId: string,
  ontvangenBriefIds: readonly string[],
): void {
  if (!gevraagdBriefId.trim()
      || ontvangenBriefIds.some((briefId) => briefId !== gevraagdBriefId)) {
    throw new ProductiekernLeesIdentiteitError('Briefversies');
  }
}
