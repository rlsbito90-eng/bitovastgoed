// React Query hooks voor opgeslagen Kadasterrecords per CRM-bron.
// Read-only — invoegen gebeurt door de edge function direct na een
// succesvolle, expliciet bevestigde Kadaster-response.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KadasterDeliverStatus, KadasterProductCode } from '@/lib/kadaster/types';

export interface KadasterDataRecord {
  id: string;
  object_id: string | null;
  signaal_id: string | null;
  vastgoedkans_id: string | null;
  source: string;
  mode: string;
  product_code: KadasterProductCode;
  status: KadasterDeliverStatus | 'fout';
  zoekadres: Record<string, unknown>;
  fetched_at: string;

  koopsom: number | null;
  koopjaar: number | null;
  koopsom_valuta: string | null;
  meer_onroerend_goed: boolean | null;
  doelbinding: boolean | null;

  bag_bouwjaar: number | null;
  bag_oppervlakte: number | null;
  bag_object_status: string | null;
  bag_gebruiksdoel: string | null;

  woz_objectnummer: string | null;
  woz_oppervlakte: number | null;
  woz_oppervlakte_wonen: number | null;
  woz_oppervlakte_niet_wonen: number | null;
  woz_inhoud: number | null;
  woz_gebruiksklasse: string | null;
  feitelijk_gebruik: string | null;
  monumentaanduiding: string | null;
  actualiteit: string | null;

  rechten_samenvatting: Record<string, unknown> | null;
  rechthebbende_naam: string | null;
  rechthebbende_type: string | null;
  rechtsoort: string | null;
  aandeel: string | null;
  kadastrale_aanduiding: string | null;

  raw_limited: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

type KadasterBronKolom = 'object_id' | 'signaal_id' | 'vastgoedkans_id';
type KadasterBronType = 'object' | 'signaal' | 'vastgoedkans';

function useKadasterDataRecordsVoorBron(
  bron: KadasterBronType,
  kolom: KadasterBronKolom,
  id: string | null | undefined,
) {
  return useQuery({
    queryKey: ['kadaster_data_records', bron, id],
    enabled: !!id,
    queryFn: async (): Promise<KadasterDataRecord[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: KadasterBronKolom, v: string) => {
              order: (k: string, o: { ascending: boolean }) => Promise<{
                data: KadasterDataRecord[] | null; error: { message: string } | null;
              }>;
            };
          };
        };
      })
        .from('kadaster_data_records')
        .select('*')
        .eq(kolom, id as string)
        .order('fetched_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as KadasterDataRecord[];
    },
  });
}

export function useKadasterDataRecords(objectId: string | null | undefined) {
  return useKadasterDataRecordsVoorBron('object', 'object_id', objectId);
}

/** Variant per signaal (Off Market Radar). Read-only. */
export function useKadasterDataRecordsForSignaal(signaalId: string | null | undefined) {
  return useKadasterDataRecordsVoorBron('signaal', 'signaal_id', signaalId);
}

/** Variant per Vastgoedkans. Read-only; vereist BUILD 2.0B.1 schema-activatie. */
export function useKadasterDataRecordsForVastgoedkans(vastgoedkansId: string | null | undefined) {
  return useKadasterDataRecordsVoorBron('vastgoedkans', 'vastgoedkans_id', vastgoedkansId);
}

/** Laatste record per product_code. */
export function laatsteRecordsPerProduct(
  records: KadasterDataRecord[],
): Map<KadasterProductCode, KadasterDataRecord> {
  const map = new Map<KadasterProductCode, KadasterDataRecord>();
  // records komen al gesorteerd desc binnen.
  for (const r of records) {
    if (!map.has(r.product_code)) map.set(r.product_code, r);
  }
  return map;
}
