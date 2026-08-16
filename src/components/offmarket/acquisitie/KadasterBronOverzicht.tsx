import { FileCheck2, History, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useKadasterDataRecordsForSignaal, type KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import { documentenPerRecord, useKadasterDocumentenForSignaal } from '@/hooks/useKadasterDocumenten';

interface Props {
  signaalId: string;
}

export type KadasterBronSoort = 'actueel' | 'eerder' | 'alternatief';

export interface KadasterBronLabel {
  recordId: string;
  soort: KadasterBronSoort;
  label: string;
}

function zoekadresWaarde(record: KadasterDataRecord | null | undefined): string | null {
  if (!record) return null;
  const zoekadres = record.zoekadres as Record<string, unknown> | null | undefined;
  const waarde = zoekadres && typeof zoekadres.waarde === 'string' ? zoekadres.waarde.trim() : '';
  return waarde || null;
}

function normaliseerAdres(v: string | null): string {
  return (v ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .trim();
}

/**
 * Spiegelt de bronkeuze van AutomatischeKadasterPdfEigenaarVerrijking:
 * het eerste geleverde/gedeeltelijke Rechten-record is kandidaat en wordt
 * alleen echt gebruikt wanneer daar ook een intern opgeslagen PDF bij hoort.
 */
export function bepaalKadasterBronLabels(
  records: KadasterDataRecord[],
  recordIdsMetPdf: ReadonlySet<string>,
): KadasterBronLabel[] {
  const rechten = records.filter((r) => r.product_code === 'rechten');
  if (rechten.length === 0) return [];

  const kandidaat = rechten.find((r) => r.status === 'geleverd' || r.status === 'gedeeltelijk') ?? null;
  const actueleBron = kandidaat && recordIdsMetPdf.has(kandidaat.id) ? kandidaat : null;
  const referentieAdres = zoekadresWaarde(actueleBron ?? kandidaat ?? rechten[0]);
  const refNorm = normaliseerAdres(referentieAdres);

  return rechten.map((record) => {
    if (actueleBron?.id === record.id) {
      return {
        recordId: record.id,
        soort: 'actueel',
        label: 'Actuele bron eigenaarsonderzoek',
      };
    }

    const adresNorm = normaliseerAdres(zoekadresWaarde(record));
    const alternatief = !!refNorm && !!adresNorm && adresNorm !== refNorm;
    return {
      recordId: record.id,
      soort: alternatief ? 'alternatief' : 'eerder',
      label: alternatief ? 'Alternatieve adresquery' : 'Eerdere aanvraag',
    };
  });
}

function datumLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function KadasterBronOverzicht({ signaalId }: Props) {
  const { data: records = [] } = useKadasterDataRecordsForSignaal(signaalId);
  const { data: documenten = [] } = useKadasterDocumentenForSignaal(signaalId);

  const pdfPerRecord = documentenPerRecord(documenten, records);
  const idsMetPdf = new Set(Array.from(pdfPerRecord.keys()));
  const labels = bepaalKadasterBronLabels(records, idsMetPdf);
  if (labels.length === 0) return null;

  const rechtenPerId = new Map(records.filter((r) => r.product_code === 'rechten').map((r) => [r.id, r]));
  const heeftActueleBron = labels.some((x) => x.soort === 'actueel');

  return (
    <section
      data-testid="kadaster-bron-overzicht"
      className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
      aria-label="Kadasterbronnen eigenaarsonderzoek"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">Bronnen eigenaarsonderzoek</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Hiermee zie je welk Rechten-Kadasterbericht de automatische eigenaarflow gebruikt en welke aanvragen alleen historie of een andere adresquery zijn.
          </p>
        </div>
        <FileCheck2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {!heeftActueleBron && (
        <p className="rounded-md border border-amber-300/70 bg-amber-50/60 px-2.5 py-2 text-[11px] text-amber-900">
          Er is nog geen actueel opgeslagen Rechten-PDF beschikbaar voor automatische eigenaarverwerking.
        </p>
      )}

      <div className="space-y-1.5">
        {labels.map((item) => {
          const record = rechtenPerId.get(item.recordId);
          if (!record) return null;
          const zoekadres = zoekadresWaarde(record) ?? 'Zoekadres onbekend';
          const isActueel = item.soort === 'actueel';
          return (
            <div
              key={item.recordId}
              className={`flex flex-col gap-1 rounded-md border px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between ${
                isActueel ? 'border-accent/40 bg-accent/5' : 'border-border bg-background/50'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={isActueel ? 'default' : 'secondary'} className="text-[10px]">
                    {item.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{datumLabel(record.fetched_at)}</span>
                </div>
                <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                  {item.soort === 'alternatief'
                    ? <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    : <History className="mt-0.5 h-3 w-3 shrink-0" />}
                  <span className="font-mono-data break-all">{zoekadres}</span>
                </p>
              </div>
              <span className="text-[10px] font-mono-data text-muted-foreground">
                {record.status}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
