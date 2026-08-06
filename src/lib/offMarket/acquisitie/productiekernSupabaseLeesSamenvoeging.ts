import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

function querySleutel(input: Parameters<ProductiekernSupabaseQueryUitvoerder['voerUit']>[0]): string {
  return JSON.stringify([
    input.tabel,
    input.selectKolommen,
    input.filterKolom,
    input.filterWaarde,
    input.cardinaliteit,
    input.volgorde ?? null,
    input.maximaalAantalRecords,
  ]);
}

/**
 * Voorkomt dubbele gelijktijdige netwerkreads voor exact dezelfde query.
 * Resultaten worden niet gecachet nadat de Promise is afgerond en filterwaarden
 * worden nergens gelogd of buiten het lokale geheugen opgeslagen.
 */
export function metSamengevoegdeProductiekernReads(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
): ProductiekernSupabaseQueryUitvoerder {
  const lopend = new Map<string, ReturnType<ProductiekernSupabaseQueryUitvoerder['voerUit']>>();

  return {
    voerUit(input) {
      const sleutel = querySleutel(input);
      const bestaand = lopend.get(sleutel);
      if (bestaand) return bestaand;

      const verzoek = uitvoerder.voerUit(input);
      lopend.set(sleutel, verzoek);
      void verzoek.finally(() => {
        if (lopend.get(sleutel) === verzoek) lopend.delete(sleutel);
      }).catch(() => undefined);
      return verzoek;
    },
  };
}
