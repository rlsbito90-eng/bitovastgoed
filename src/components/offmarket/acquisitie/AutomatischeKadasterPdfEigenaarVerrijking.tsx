import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useKadasterDataRecordsForSignaal,
  type KadasterDataRecord,
} from '@/hooks/useKadasterDataRecords';
import {
  documentenPerRecord,
  useKadasterDocumentenForSignaal,
} from '@/hooks/useKadasterDocumenten';

interface Props {
  signaalId: string;
}

/**
 * Verwerkt een reeds opgeslagen Rechten-Kadasterbericht automatisch voor
 * Off-Market eigenaarsonderzoek. Dit component doet NOOIT een Kadastercall;
 * het leest alleen de bestaande interne PDF via een beveiligde Edge Function.
 */
export default function AutomatischeKadasterPdfEigenaarVerrijking({ signaalId }: Props) {
  const qc = useQueryClient();
  const records = useKadasterDataRecordsForSignaal(signaalId);
  const documenten = useKadasterDocumentenForSignaal(signaalId);
  const bezigRef = useRef<Set<string>>(new Set());

  const rechtenRecord = useMemo<KadasterDataRecord | null>(() => {
    return (records.data ?? []).find((r) =>
      r.product_code === 'rechten' && (r.status === 'geleverd' || r.status === 'gedeeltelijk'),
    ) ?? null;
  }, [records.data]);

  const document = useMemo(() => {
    if (!rechtenRecord) return null;
    return documentenPerRecord(documenten.data ?? [], [rechtenRecord]).get(rechtenRecord.id) ?? null;
  }, [documenten.data, rechtenRecord]);

  useEffect(() => {
    if (!rechtenRecord || !document) return;
    const guard = `${signaalId}|${rechtenRecord.id}|${document.id}`;
    if (bezigRef.current.has(guard)) return;
    bezigRef.current.add(guard);

    void supabase.functions
      .invoke('offmarket-kadaster-pdf-eigenaar-extractie', {
        body: {
          signaal_id: signaalId,
          record_id: rechtenRecord.id,
          document_id: document.id,
        },
      })
      .then(({ error }) => {
        if (error) {
          bezigRef.current.delete(guard);
          return;
        }
        void qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
        void qc.invalidateQueries({ queryKey: ['off-market-signalen', 'alle'] });
        void qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
        void qc.invalidateQueries({ queryKey: ['kadaster_data_records', 'signaal', signaalId] });
      })
      .catch(() => {
        bezigRef.current.delete(guard);
      });
  }, [document, qc, rechtenRecord, signaalId]);

  return null;
}
