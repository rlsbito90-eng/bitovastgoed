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
import { mapRechtenBlokken } from '@/lib/kadaster/rechtenBlokken';
import { bepaalRechtenbewusteEigenaar } from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';

interface Props {
  signaalId: string;
}

/**
 * Verwerkt een reeds opgeslagen Rechten-Kadasterbericht automatisch voor
 * Off-Market eigenaarsonderzoek. Dit component doet NOOIT een Kadastercall;
 * het leest alleen de bestaande interne PDF via een beveiligde Edge Function.
 *
 * Na PDF-verrijking worden meerdere primaire rechthebbenden ook canoniek op
 * het signaal opgeslagen, zodat readiness/geadresseerdentelling ze als
 * afzonderlijke acquisitiegeadresseerden kan gebruiken zonder al brieven
 * aan te maken.
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
      .then(async ({ error }) => {
        if (error) {
          bezigRef.current.delete(guard);
          return;
        }

        // Lees het zojuist door de Edge Function verrijkte record terug. Dit is
        // read-only richting Kadaster: er wordt geen externe aanvraag uitgevoerd.
        const { data: versRecord } = await supabase
          .from('kadaster_data_records')
          .select('raw_limited')
          .eq('id', rechtenRecord.id)
          .maybeSingle();
        const rawRechten = (versRecord?.raw_limited as Record<string, unknown> | null | undefined)?.rechten;
        const blokken = mapRechtenBlokken(rawRechten);
        const uitkomst = bepaalRechtenbewusteEigenaar(blokken);

        if (uitkomst.status === 'meervoudig') {
          const rechthebbenden = uitkomst.primaireRechthebbenden.map((r) => ({
            naam: r.naam,
            bedrijfsnaam: r.bedrijfsnaam,
            kvk: r.kvk,
            aandeel: r.aandeel,
            rechtstype: r.rechtstype,
            rechtssituatie: uitkomst.rechtssituatie,
            straat_huisnummer: r.straatHuisnummer,
            postcode: r.postcode,
            plaats: r.plaats,
            verzendadres: r.verzendadres,
            bron: 'kadaster',
          }));
          const { error: persistError } = await supabase
            .from('off_market_signalen')
            .update({ eigenaar_rechthebbenden: rechthebbenden } as any)
            .eq('id', signaalId);
          if (persistError) {
            bezigRef.current.delete(guard);
            return;
          }
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
