// KadasterHistorieLijst — toont alle opgeslagen Kadasterrecords voor
// hetzelfde object of signaal, gesorteerd op fetched_at desc.
//
// Doel: voorkomen dat eerdere aanvragen "verdwijnen" doordat de hoofdkaart
// alleen de laatste record per productcode toont. Bevat per record:
//   - datum/tijd, productnaam, status
//   - zoekadres
//   - korte samenvatting (koopsom of rechthebbende)
//   - inklapbare technische details (response-shape, geen secrets)
import { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import { KADASTER_LABELS_PER_PRODUCT } from '@/lib/kadaster/types';

function fmtDatum(iso: string): string {
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}
function fmtEur(n: number | null): string {
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

function statusLabel(s: string): string {
  if (s === 'geleverd' || s === 'gedeeltelijk') return 'Opgehaald';
  if (s === 'niet_geleverd') return 'Niet geleverd';
  if (s === 'niet_beschikbaar') return 'Niet beschikbaar';
  return s;
}

function recordSamenvatting(r: KadasterDataRecord): string {
  if (r.status !== 'geleverd' && r.status !== 'gedeeltelijk') {
    return 'Niet geleverd voor dit adres.';
  }
  if (r.product_code === 'waarde') {
    if (r.koopsom !== null) {
      return `Koopsom: ${fmtEur(r.koopsom)}${r.koopjaar ? ` (${r.koopjaar})` : ''}`;
    }
    return 'Geleverd, geen koopsom-velden gevonden.';
  }
  if (r.product_code === 'rechten') {
    if (r.rechthebbende_naam) {
      return `Rechthebbende: ${r.rechthebbende_naam}${r.rechtsoort ? ` · ${r.rechtsoort}` : ''}`;
    }
    return 'Geleverd, rechthebbende-velden nog niet herkend.';
  }
  if (r.product_code === 'object') {
    return `WOZ/BAG-objectgegevens${r.bag_bouwjaar ? ` · bouwjaar ${r.bag_bouwjaar}` : ''}`;
  }
  return 'Geleverd.';
}

function HistorieItem({ r }: { r: KadasterDataRecord }) {
  const [open, setOpen] = useState(false);
  const productLabel =
    KADASTER_LABELS_PER_PRODUCT[r.product_code] ?? r.product_code;
  const rechtenShape = (r.raw_limited as Record<string, unknown> | null | undefined)?.rechten
    ?? null;

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">
            {productLabel}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono-data">
            {fmtDatum(r.fetched_at)} · {statusLabel(r.status)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Zoekadres: <span className="font-mono-data">{fmtZoek(r.zoekadres)}</span>
      </p>
      <p className="text-[11px]">{recordSamenvatting(r)}</p>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Technische details
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 overflow-auto max-h-64 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify({
  id: r.id,
  product_code: r.product_code,
  status: r.status,
  fetched_at: r.fetched_at,
  zoekadres: r.zoekadres,
  rechten_samenvatting_aanwezig: !!r.rechten_samenvatting,
  raw_limited_keys: Object.keys(r.raw_limited ?? {}),
  raw_limited_rechten: rechtenShape,
}, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface Props {
  records: KadasterDataRecord[];
}

export default function KadasterHistorieLijst({ records }: Props) {
  const [open, setOpen] = useState(false);
  if (records.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-2">
      <CollapsibleTrigger className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <History className="h-3 w-3" />
        Eerdere Kadasteraanvragen ({records.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        {records.map((r) => <HistorieItem key={r.id} r={r} />)}
      </CollapsibleContent>
    </Collapsible>
  );
}
