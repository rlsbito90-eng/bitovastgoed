import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

function querySleutel(input: Parameters<ProductiekernSupabaseQueryUitvoerder['voerUit']>[0]): string {
  return JSON.stringify([
    'single', input.tabel, input.selectKolommen, input.filterKolom, input.filterWaarde,
    input.cardinaliteit, input.volgorde ?? null, input.maximaalAantalRecords,
  ]);
}

function bulkQuerySleutel(input: NonNullable<Parameters<NonNullable<ProductiekernSupabaseQueryUitvoerder['voerBulkUit']>>[0]>): string {
  return JSON.stringify([
    'bulk', input.tabel, input.selectKolommen, input.filterKolom,
    input.filterWaarden, input.maximaalAantalRecords,
  ]);
}

export function metSamengevoegdeProductiekernReads(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
): ProductiekernSupabaseQueryUitvoerder {
  const lopend = new Map<string, Promise<unknown>>();

  function voegSamen<T>(sleutel: string, actie: () => Promise<T>): Promise<T> {
    const bestaand = lopend.get(sleutel) as Promise<T> | undefined;
    if (bestaand) return bestaand;
    const verzoek = actie();
    lopend.set(sleutel, verzoek);
    void verzoek.finally(() => {
      if (lopend.get(sleutel) === verzoek) lopend.delete(sleutel);
    }).catch(() => undefined);
    return verzoek;
  }

  return {
    voerUit(input) {
      return voegSamen(querySleutel(input), () => uitvoerder.voerUit(input));
    },
    voerBulkUit: uitvoerder.voerBulkUit
      ? (input) => voegSamen(bulkQuerySleutel(input), () => uitvoerder.voerBulkUit!(input))
      : undefined,
  };
}
