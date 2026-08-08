import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

type SupabaseResultaat = {
  data: unknown;
  error: unknown;
};

export interface ProductiekernSupabaseQueryBuilder {
  select(kolommen: string): ProductiekernSupabaseQueryBuilder;
  eq(kolom: string, waarde: string): ProductiekernSupabaseQueryBuilder;
  in(kolom: string, waarden: readonly string[]): ProductiekernSupabaseQueryBuilder;
  order(kolom: string, opties: { ascending: boolean }): ProductiekernSupabaseQueryBuilder;
  limit(aantal: number): ProductiekernSupabaseQueryBuilder;
  maybeSingle(): PromiseLike<SupabaseResultaat>;
  then<TResult1 = SupabaseResultaat, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResultaat) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export interface ProductiekernSupabaseClientLike {
  from(tabel: string): ProductiekernSupabaseQueryBuilder;
}

function geefFoutDoor(error: unknown): never {
  if (error) throw error;
  throw new Error('Supabase-read faalde zonder foutobject.');
}

function kolommenCsv(kolommen: readonly string[]): string {
  if (kolommen.length === 0) throw new Error('Supabase-read vereist minimaal één selectiekolom.');
  return kolommen.join(',');
}

/**
 * Dunne vertaling van reeds allowlisted querycontracten naar een geïnjecteerde
 * Supabase-client. Deze factory importeert of instantieert zelf geen client en
 * kent geen URL, key, projectref of productieomgeving.
 */
export function maakProductiekernSupabaseQueryUitvoerder(
  client: ProductiekernSupabaseClientLike,
): ProductiekernSupabaseQueryUitvoerder {
  return {
    async voerUit(input) {
      let query = client
        .from(input.tabel)
        .select(kolommenCsv(input.selectKolommen))
        .eq(input.filterKolom, input.filterWaarde);

      if (input.volgorde) {
        query = query.order(input.volgorde.kolom, { ascending: input.volgorde.oplopend });
      }
      query = query.limit(input.maximaalAantalRecords);

      const resultaat = input.cardinaliteit === 'nul_of_een'
        ? await query.maybeSingle()
        : await query;
      if (resultaat.error) geefFoutDoor(resultaat.error);
      return resultaat.data as Record<string, unknown> | Record<string, unknown>[] | null;
    },

    async voerBulkUit(input) {
      let query = client
        .from(input.tabel)
        .select(kolommenCsv(input.selectKolommen))
        .in(input.filterKolom, input.filterWaarden)
        .limit(input.maximaalAantalRecords);
      const resultaat = await query;
      if (resultaat.error) geefFoutDoor(resultaat.error);
      if (!Array.isArray(resultaat.data)) {
        throw { code: '21000' };
      }
      return resultaat.data as Record<string, unknown>[];
    },
  };
}
