import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export class ProductiekernLeesTimeoutError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEES_TIMEOUT';
  readonly status = 408;

  constructor(readonly timeoutMs: number) {
    super('De productiekern-read duurde te lang en is veilig afgebroken.');
    this.name = 'ProductiekernLeesTimeoutError';
  }
}

export interface ProductiekernLeesTimeoutOpties {
  timeoutMs?: number;
  planTimeout?: (callback: () => void, milliseconden: number) => ReturnType<typeof setTimeout>;
  annuleerTimeout?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function metProductiekernLeesTimeout(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernLeesTimeoutOpties = {},
): ProductiekernSupabaseQueryUitvoerder {
  const timeoutMs = opties.timeoutMs ?? 5_000;
  const planTimeout = opties.planTimeout ?? ((callback, milliseconden) => setTimeout(callback, milliseconden));
  const annuleerTimeout = opties.annuleerTimeout ?? ((timer) => clearTimeout(timer));
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error('Leestimeout moet een geheel aantal milliseconden tussen 100 en 30000 zijn.');
  }

  async function metTimeout<T>(actie: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = planTimeout(() => reject(new ProductiekernLeesTimeoutError(timeoutMs)), timeoutMs);
    });
    try { return await Promise.race([actie(), timeout]); }
    finally { if (timer !== undefined) annuleerTimeout(timer); }
  }

  return {
    voerUit: (input) => metTimeout(() => uitvoerder.voerUit(input)),
    voerBulkUit: uitvoerder.voerBulkUit
      ? (input) => metTimeout(() => uitvoerder.voerBulkUit!(input))
      : undefined,
  };
}
