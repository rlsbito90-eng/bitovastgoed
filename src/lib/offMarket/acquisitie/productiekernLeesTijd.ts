export class ProductiekernLeesTijdError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEESTIJD';

  constructor(veld: string, reden: string) {
    super(`Productiekern-tijdveld ${veld} is ongeldig: ${reden}.`);
    this.name = 'ProductiekernLeesTijdError';
  }
}

export function valideerProductiekernTijdstip(
  veld: string,
  waarde: string | null,
  nuMs = Date.now(),
  maximaleToekomstmargeMs = 60_000,
): string | null {
  if (waarde === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(waarde)) {
    throw new ProductiekernLeesTijdError(veld, 'geen canoniek UTC-tijdstip');
  }
  const tijdMs = Date.parse(waarde);
  if (!Number.isFinite(tijdMs)) {
    throw new ProductiekernLeesTijdError(veld, 'niet parseerbaar');
  }
  if (tijdMs > nuMs + maximaleToekomstmargeMs) {
    throw new ProductiekernLeesTijdError(veld, 'ligt te ver in de toekomst');
  }
  return waarde;
}
