// KadasterPreviewDialog — toont resultaat van Kadaster Objectinformatie API.
// V1: alleen weergave. "Overnemen" verschijnt alleen bij geleverde data.
// Per product tonen we expliciet status + deliver-mode + eventuele
// Kadaster-melding zodat duidelijk is of de API niets leverde of dat de
// frontend de response nog niet uitleest.
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
  KadasterDeliverStatus, KadasterPreview, KadasterProductResult,
} from '@/lib/kadaster/types';
import { KADASTER_LABELS_PER_PRODUCT, KADASTER_STATUS_LABELS } from '@/lib/kadaster/types';
import { mapWozObject, heeftWozObjectInhoud } from '@/lib/kadaster/wozObject';



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

const STATUS_KLEUR: Record<KadasterDeliverStatus, string> = {
  geleverd: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  gedeeltelijk: 'bg-amber-100 text-amber-800 border-amber-200',
  niet_geleverd: 'bg-muted text-muted-foreground border-border',
  niet_beschikbaar: 'bg-destructive/10 text-destructive border-destructive/30',
  onbekend: 'bg-muted text-muted-foreground border-border',
};

function StatusBadge({ status }: { status: KadasterDeliverStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_KLEUR[status]}`}>
      {KADASTER_STATUS_LABELS[status]}
    </span>
  );
}

function ProductCard({
  product, gebiedsVariant,
}: {
  product: KadasterProductResult;
  gebiedsVariant: 'buurtprofiel' | 'gebiedscontext';
}) {

  const titel = useMemo<string>(() => {
    if (product.code === 'lasten') return 'Gemeentelijke lasten';
    if (product.code === 'buurt') {
      return gebiedsVariant === 'buurtprofiel' ? 'Buurtprofiel' : 'Gebiedscontext';
    }
    return KADASTER_LABELS_PER_PRODUCT[product.code] ?? product.code;
  }, [product.code, gebiedsVariant]);

  const status: KadasterDeliverStatus = product.status
    ?? (product.beschikbaar ? 'geleverd' : 'niet_geleverd');

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{titel}</p>
        <p className="text-[10px] text-muted-foreground font-mono-data">
          code: {product.code}
          {product.deliver ? ` · deliver: ${product.deliver}` : ''}
        </p>
      </div>
      <StatusBadge status={status} />
    </div>
  );

  if (!product.beschikbaar) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
        {header}
        <p className="text-xs text-muted-foreground">
          {product.foutmelding
            ?? 'Niet geleverd voor dit adres. Kadaster heeft voor dit product geen gegevens teruggegeven.'}
        </p>
        {product.deliver?.toLowerCase().includes('without') && (
          <p className="text-[11px] text-muted-foreground">
            De aanvraag is afgerond, maar dit product is door Kadaster niet
            meegeleverd (deliver = {product.deliver}).
          </p>
        )}
        <Collapsible>
          <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Technische details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 overflow-auto max-h-48 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify({ status: product.status, deliver: product.deliver, data_keys: product.data ? Object.keys(product.data) : [] }, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // ---- WOZ-object (productcode 'object') -----------------------------------
  if (product.code === 'object') {
    const view = mapWozObject(product.data);
    const heeftData = heeftWozObjectInhoud(view);
    const fmtNum = (n: number | null) => n === null ? '—' : new Intl.NumberFormat('nl-NL').format(n);
    const fmtOpp = (n: number | null) => n === null ? '—' : `${new Intl.NumberFormat('nl-NL').format(n)} m²`;
    const fmtInh = (n: number | null) => n === null ? '—' : `${new Intl.NumberFormat('nl-NL').format(n)} m³`;
    const Row = ({ label, value }: { label: string; value: string | number | null }) => (
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono-data text-right">{value === null || value === '' ? '—' : value}</span>
      </div>
    );

    return (
      <div className="rounded-md border border-border bg-card p-3 space-y-3">
        {header}
        <p className="text-[11px] text-muted-foreground">
          WOZ-objectinformatie (BAG + WOZ-administratie). Dit is geen WOZ-waarde-bedrag.
        </p>

        {!heeftData && (
          <p className="text-[11px] text-muted-foreground italic">
            Productdata aanwezig, maar geen WOZ-objectvelden gevonden. Bekijk technische details.
          </p>
        )}

        {heeftData && (
          <>
            <div className="space-y-1.5 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BAG-object</p>
              <Row label="Objectstatus" value={view.bag.objectStatus} />
              <Row label="Bouwjaar" value={view.bag.bouwjaar} />
              <Row label="BAG-oppervlakte" value={fmtOpp(view.bag.oppervlakteBag)} />
              <Row label="Vergund gebruik" value={view.bag.omschrijvingVergundeGebruik} />
              <Row label="Complexrelatie" value={view.bag.complexrelatie} />
              <Row label="Oppervlaktewijziging" value={view.bag.oppervlakteWijziging} />
            </div>

            {view.woz.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">WOZ-object</p>
                  {view.woz.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      Meerdere WOZ-objecten gevonden ({view.woz.length})
                    </span>
                  )}
                </div>
                {(() => {
                  const w = view.woz[0];
                  return (
                    <div className="space-y-1.5">
                      <Row label="WOZ-objectnummer" value={w.wozObjectNummer} />
                      <Row label="Gebruiksklasse" value={w.gebruiksklasse} />
                      <Row label="Feitelijk gebruik" value={w.feitelijkGebruik} />
                      <Row label="Monumentaanduiding" value={w.monumentaanduiding} />
                      <Row label="WOZ-oppervlakte totaal" value={fmtOpp(w.oppervlakteWoz)} />
                      <Row label="WOZ-oppervlakte wonen" value={fmtOpp(w.oppervlakteWozWonen)} />
                      <Row label="WOZ-oppervlakte niet-wonen" value={fmtOpp(w.oppervlakteWozNietWonen)} />
                      <Row label="Inhoud" value={fmtInh(w.inhoud)} />
                      <Row label="Bouwlaag" value={w.bouwlaag} />
                    </div>
                  );
                })()}

                {view.woz.length > 1 && (
                  <Collapsible>
                    <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      Overige WOZ-objecten ({view.woz.length - 1})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {view.woz.slice(1).map((w, i) => (
                        <div key={i} className="rounded border border-border/60 p-2 space-y-1">
                          <Row label="WOZ-objectnummer" value={w.wozObjectNummer} />
                          <Row label="Gebruiksklasse" value={w.gebruiksklasse} />
                          <Row label="Feitelijk gebruik" value={w.feitelijkGebruik} />
                          <Row label="Oppervlakte" value={fmtOpp(w.oppervlakteWoz)} />
                          <Row label="Inhoud" value={fmtInh(w.inhoud)} />
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Algemeen</p>
              <Row label="Actualiteit" value={view.algemeen.actualiteit} />
              <Row label="Doelbinding" value={view.algemeen.doelbinding} />
              <Row label="Titel" value={view.algemeen.titel} />
            </div>

            <p className="text-[10px] text-muted-foreground italic">
              Overnemen naar objectvelden komt in een volgende stap. Geen automatische opslag.
            </p>
          </>
        )}

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

  // ---- Overige producten (waarde, rechten, ...) ----------------------------
  const koopsom = product.code === 'waarde'
    ? leesNummer(product.data, 'koopsom', 'price', 'amount')
    : null;
  const transactiedatum = product.code === 'waarde'
    ? leesString(product.data, 'transactiedatum', 'transactionDate', 'datum')
    : null;

  const heeftLeesbareWaarde = koopsom !== null || transactiedatum !== null;

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      {header}
      <div className="space-y-1.5 text-xs">
        {koopsom !== null && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Koopsom</span><span className="font-mono-data">{fmtEur(koopsom)}</span></div>
        )}
        {transactiedatum && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Transactiedatum</span><span className="font-mono-data">{transactiedatum}</span></div>
        )}
        {!heeftLeesbareWaarde && (
          <p className="text-[11px] text-muted-foreground italic">
            {product.code === 'waarde'
              ? 'Niet geleverd voor dit adres.'
              : 'Productdata aanwezig, maar geen velden herkend door de previewer. Bekijk de technische details.'}
          </p>
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
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
                <span className="text-muted-foreground">Kosten</span>
                <span className="font-mono-data">
                  {preview.kosten_indicatie_eur === null || preview.kosten_indicatie_eur === undefined
                    ? 'prijs volgens Kadaster'
                    : fmtEur(preview.kosten_indicatie_eur)}
                </span>
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
                />

              ))
            )}

            {preview.debug?.response_shape && (
              <Collapsible>
                <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  Response-shape (debug, zonder secrets)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 overflow-auto max-h-64 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify({
  endpoint: preview.debug.endpoint,
  base_url: preview.debug.base_url,
  product_codes: preview.debug.product_codes,
  allowed_products: preview.debug.allowed_products,
  products_source: preview.debug.products_source,
  response_shape: preview.debug.response_shape,
}, null, 2)}
                  </pre>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Deliver-mode <code>WithoutProduct</code> betekent dat de aanvraag
                    kan slagen zonder dat elk product inhoud heeft. Een leeg product
                    betekent dus niet automatisch een fout.
                  </p>
                </CollapsibleContent>
              </Collapsible>
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
