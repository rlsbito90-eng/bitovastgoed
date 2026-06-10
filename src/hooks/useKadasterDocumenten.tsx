// React Query hook voor opgeslagen Kadasterberichten/PDF's (Fase 4K.5).
// Intern only — leesrechten gelden alleen voor admin/medewerker.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KadasterDocument {
  id: string;
  object_id: string | null;
  signaal_id: string | null;
  kadaster_data_record_id: string | null;
  source: string;
  product_codes: string[];
  zoekadres: Record<string, unknown>;
  fetched_at: string;
  storage_bucket: string;
  storage_path: string;
  bestandsnaam: string;
  bestandsgrootte_bytes: number | null;
  mime_type: string;
  intern_only: boolean;
  created_at: string;
}

type Col = 'object_id' | 'signaal_id';

function gebruikKadasterDocumenten(col: Col, id: string | null | undefined) {
  return useQuery({
    queryKey: ['kadaster_documenten', col, id],
    enabled: !!id,
    queryFn: async (): Promise<KadasterDocument[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (k: string, o: { ascending: boolean }) => Promise<{
                data: KadasterDocument[] | null; error: { message: string } | null;
              }>;
            };
          };
        };
      })
        .from('kadaster_documenten')
        .select('*')
        .eq(col, id as string)
        .order('fetched_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as KadasterDocument[];
    },
  });
}

export function useKadasterDocumentenForObject(objectId: string | null | undefined) {
  return gebruikKadasterDocumenten('object_id', objectId);
}
export function useKadasterDocumentenForSignaal(signaalId: string | null | undefined) {
  return gebruikKadasterDocumenten('signaal_id', signaalId);
}

/** Open een intern Kadasterbericht via een tijdelijke signed URL. */
export async function openKadasterDocument(doc: KadasterDocument): Promise<void> {
  const { data, error } = await supabase.storage
    .from(doc.storage_bucket || 'bito-objecten')
    .createSignedUrl(doc.storage_path, 60 * 5);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Kon Kadasterbericht niet openen.');
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

/** Map per record_id naar bijbehorend document (voor record-kaarten). */
export function documentenPerRecord(
  docs: KadasterDocument[],
): Map<string, KadasterDocument> {
  const map = new Map<string, KadasterDocument>();
  for (const d of docs) {
    if (d.kadaster_data_record_id) {
      if (!map.has(d.kadaster_data_record_id)) {
        map.set(d.kadaster_data_record_id, d);
      }
    }
  }
  return map;
}
