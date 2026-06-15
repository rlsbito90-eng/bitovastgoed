// KadasterRecordDetailDialog — toont alle beschikbare velden van één
// opgeslagen Kadasterrecord, los van de samenvatting op de hoofdkaart.
// Doel: oudere aanvragen volledig raadpleegbaar maken zonder opnieuw aan
// te vragen.
import { FileText, Info } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import KadasterPdfKnop from '@/components/object/kadaster/KadasterPdfKnop';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import type { KadasterDocument } from '@/hooks/useKadasterDocumenten';
import {
  KADASTER_LABELS_PER_PRODUCT, KADASTER_STATUS_LABELS,
  type KadasterDeliverStatus,
} from '@/lib/kadaster/types';

function fmtDatum(iso: string): string {
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}
function fmtEur(n: number | null | undefined): string {
  return n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('nl-NL', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
      }).format(n);
}
function fmtZoek(z: Record<string, unknown> | null | undefined): string {
  if (!z) return '—';
  const w = typeof (z as { waarde?: unknown }).waarde === 'string'
    ? (z as { waarde: string }).waarde : null;
  return w ?? '—';
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return (
    <div className="flex items-start justify-between gap-3 text-xs py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-data text-right break-words">{value}</span>
    </div>
  );
}

interface Props {
  record: KadasterDataRecord | null;
  pdf?: KadasterDocument | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function KadasterRecordDetailDialog({
  record, pdf, open, onOpenChange,
}: Props) {
  if (!record) return null;
  const r = record;
  const productLabel = KADASTER_LABELS_PER_PRODUCT[r.product_code] ?? r.product_code;
  const statusLabel = KADASTER_STATUS_LABELS[r.status as KadasterDeliverStatus] ?? r.status;
  const isFout = r.status !== 'geleverd' && r.status !== 'gedeeltelijk';
  const foutmelding = (r.raw_limited as Record<string, unknown> | null | undefined)?.foutmelding;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" /> Kadasterbericht
          </DialogTitle>
          <DialogDescription>
            {productLabel} · {fmtDatum(r.fetched_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {pdf ? (
            <div className="flex items-center justify-between gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1.5">
              <span className="text-[11px] inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Officieel Kadasterbericht (PDF) opgeslagen
              </span>
              <KadasterPdfKnop document={pdf} label="Openen" />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Geen Kadasterbericht/PDF opgeslagen bij deze aanvraag — alleen
              gestructureerde data beschikbaar.
            </p>
          )}

          <div className="rounded-md border border-border bg-card p-3 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Aanvraag
            </p>
            <Row label="Type" value={productLabel} />
            <Row label="Aangevraagd" value={fmtDatum(r.fetched_at)} />
            <Row label="Status" value={statusLabel} />
            <Row label="Zoekadres" value={fmtZoek(r.zoekadres)} />
            <Row label="Bron" value={r.source} />
            <Row label="Modus" value={r.mode} />
            <Row label="Record-id" value={r.id} />
          </div>

          {r.product_code === 'rechten' && !isFout && (
            <div className="rounded-md border border-border bg-card p-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Rechthebbende
              </p>
              <Row label="Naam" value={r.rechthebbende_naam} />
              <Row label="Type" value={r.rechthebbende_type} />
              <Row label="Rechtsoort" value={r.rechtsoort} />
              <Row label="Aandeel" value={r.aandeel} />
              <Row label="Kadastrale aanduiding" value={r.kadastrale_aanduiding} />
              {!r.rechthebbende_naam && !r.kadastrale_aanduiding && (
                <p className="text-[11px] text-muted-foreground italic">
                  Geen rechthebbende-velden herkend in deze response. Bekijk
                  het Kadasterbericht (PDF) voor de officiële bron.
                </p>
              )}
            </div>
          )}

          {r.product_code === 'waarde' && !isFout && (
            <div className="rounded-md border border-border bg-card p-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Koopsom
              </p>
              <Row label="Koopsom" value={fmtEur(r.koopsom)} />
              <Row label="Koopjaar" value={r.koopjaar} />
              <Row label="Valuta" value={r.koopsom_valuta} />
              <Row
                label="Meer onroerend goed"
                value={r.meer_onroerend_goed === null ? null
                  : (r.meer_onroerend_goed ? 'Ja' : 'Nee')}
              />
            </div>
          )}

          {isFout && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-medium">Aanvraag niet succesvol</p>
              <p className="mt-1 text-foreground">
                Status: <span className="font-mono-data">{statusLabel}</span>
              </p>
              {typeof foutmelding === 'string' && foutmelding && (
                <p className="mt-1 text-foreground">{foutmelding}</p>
              )}
            </div>
          )}

          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Technische details (raw)
            </summary>
            <pre className="mt-2 overflow-auto max-h-64 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify({
  id: r.id,
  product_code: r.product_code,
  status: r.status,
  fetched_at: r.fetched_at,
  zoekadres: r.zoekadres,
  raw_limited_keys: Object.keys(r.raw_limited ?? {}),
  raw_limited: r.raw_limited,
}, null, 2)}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
