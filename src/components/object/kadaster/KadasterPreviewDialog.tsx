// KadasterPreviewDialog — toont resultaat van Kadaster Objectinformatie API.
// V1: alleen weergave, geen overname-acties die overschrijven. Voor
// veilig overneembare basisvelden (bouwjaar, WOZ-waarde, WOZ-peildatum)
// kan een onOvernemen-callback worden meegegeven; CRM-veld vullen blijft
// expliciet bij de gebruiker.
import { useMemo } from 'react';
import { FileSearch, ExternalLink } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  KadasterPreview, KadasterProductResult, KadasterProductCode,
} from '@/lib/kadaster/types';
import { KADASTER_LABELS_PER_PRODUCT } from '@/lib/kadaster/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: KadasterPreview | null;
  /** Voor labeling van gebiedsdata: 'buurtprofiel' of 'gebiedscontext'. */
  gebiedsVariant: 'buurtprofiel' | 'gebiedscontext';
  /** Optioneel: callback om een basisveld over te nemen in CRM. */
  onOvernemenBouwjaar?: (jaar: number) => void;
  onOvernemenWozWaarde?: (waarde: number, peildatum?: string) => void;
}

function fmtDatumTijd(iso: string): string {
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n);
}

function leesString(data: unknown, ...keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}
function leesNummer(data: unknown, ...keys: string[]): number | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^[0-9.,]+$/.test(v.trim())) {
      const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function ProductCard({
  product, gebiedsVariant, onOvernemenBouwjaar, onOvernemenWozWaarde,
}: {
  product: KadasterProductResult;
  gebiedsVariant: 'buurtprofiel' | 'gebiedscontext';
  onOvernemenBouwjaar?: (jaar: number) => void;
  onOvernemenWozWaarde?: (waarde: number, peildatum?: string) => void;
}) {
  const titel = useMemo<string>(() => {
    if (product.code === 'lasten') return 'Gemeentelijke lasten';
    if (product.code === 'buurt') {
      return gebiedsVariant === 'buurtprofiel' ? 'Buurtprofiel' : 'Gebiedscontext';
    }
    return KADASTER_LABELS_PER_PRODUCT[product.code] ?? product.code;
  }, [product.code, gebiedsVariant]);

  if (!product.beschikbaar) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
        <p className="font-medium">{titel}</p>
        <p className="text-muted-foreground mt-1">
          {product.foutmelding ?? 'Niet beschikbaar voor dit adres.'}
        </p>
      </div>
    );
  }

  const bouwjaar = product.code === 'object'
    ? leesNummer(product.data, 'bouwjaar', 'buildYear', 'yearOfConstruction')
    : null;
  const wozWaarde = product.code === 'object'
    ? leesNummer(product.data, 'wozWaarde', 'wozValue', 'waarde')
    : null;
  const wozPeildatum = product.code === 'object'
    ? leesString(product.data, 'wozPeildatum', 'wozReferenceDate', 'peildatum')
    : null;
  const koopsom = product.code === 'waarde'
    ? leesNummer(product.data, 'koopsom', 'price', 'amount')
    : null;
  const transactiedatum = product.code === 'waarde'
    ? leesString(product.data, 'transactiedatum', 'transactionDate', 'datum')
    : null;
  const gebruiksdoel = product.code === 'object'
    ? leesString(product.data, 'gebruiksdoel', 'usePurpose', 'objecttype')
    : null;

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <p className="text-sm font-medium">{titel}</p>
      <div className="space-y-1.5 text-xs">
        {bouwjaar !== null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Bouwjaar</span>
            <span className="flex items-center gap-2">
              <span className="font-mono-data">{bouwjaar}</span>
              {onOvernemenBouwjaar && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                  onClick={() => onOvernemenBouwjaar(bouwjaar)}>
                  Overnemen
                </Button>
              )}
            </span>
          </div>
        )}
        {wozWaarde !== null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">WOZ-waarde</span>
            <span className="flex items-center gap-2">
              <span className="font-mono-data">{fmtEur(wozWaarde)}</span>
              {onOvernemenWozWaarde && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                  onClick={() => onOvernemenWozWaarde(wozWaarde, wozPeildatum ?? undefined)}>
                  Overnemen
                </Button>
              )}
            </span>
          </div>
        )}
        {wozPeildatum && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Peildatum</span><span className="font-mono-data">{wozPeildatum}</span></div>
        )}
        {koopsom !== null && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Koopsom</span><span className="font-mono-data">{fmtEur(koopsom)}</span></div>
        )}
        {transactiedatum && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Transactiedatum</span><span className="font-mono-data">{transactiedatum}</span></div>
        )}
        {gebruiksdoel && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Gebruiksdoel</span><span>{gebruiksdoel} <span className="text-[10px] text-muted-foreground">(suggestie)</span></span></div>
        )}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          Technische details
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 overflow-auto max-h-48 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify(product.data ?? {}, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function KadasterPreviewDialog({
  open, onOpenChange, preview, gebiedsVariant,
  onOvernemenBouwjaar, onOvernemenWozWaarde,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" /> Kadaster preview
          </DialogTitle>
          <DialogDescription>
            Bron: Kadaster Objectinformatie API ·{' '}
            {preview ? fmtDatumTijd(preview.opgehaald_op) : ''}
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Zoekadres</span>
                <span className="font-mono-data">{preview.zoekadres.waarde}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Productcodes</span>
                <span className="font-mono-data">{preview.productcodes.join(', ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Geschatte kosten</span>
                <span className="font-mono-data">{fmtEur(preview.kosten_indicatie_eur)}</span>
              </div>
            </div>

            {preview.producten.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen producten teruggekomen.</p>
            ) : (
              preview.producten.map((p: KadasterProductResult) => (
                <ProductCard
                  key={p.code}
                  product={p}
                  gebiedsVariant={gebiedsVariant}
                  onOvernemenBouwjaar={onOvernemenBouwjaar}
                  onOvernemenWozWaarde={onOvernemenWozWaarde}
                />
              ))
            )}

            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Data wordt nooit automatisch overschreven. Gebruik "Overnemen"
              per veld of vul handmatig in via Object bewerken.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Sluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
