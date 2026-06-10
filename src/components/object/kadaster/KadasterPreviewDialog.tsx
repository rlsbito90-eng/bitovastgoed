// KadasterPreviewDialog — toont resultaat van Kadaster Objectinformatie API.
//
// Fase 4K.3: handmatige overname van veilige velden naar Object.
//   - Geen automatische opslag of overschrijving.
//   - Alleen velden waarvoor een CRM-doelveld bestaat krijgen een
//     "Overnemen"-knop. Als CRM-veld al gevuld is: "Vervang huidige waarde"
//     met expliciete bevestiging via AlertDialog.
//   - Overname-acties bestaan in V1 voor:
//       · bouwjaar (BAG)
//       · oppervlakte (BAG of WOZ — keuze per knop)
//   - Velden zonder CRM-doel (vergund gebruik, WOZ-objectnummer, koopsom,
//     koopjaar, inhoud, monumentaanduiding, ...) worden alleen getoond
//     en gedocumenteerd als open punt in .lovable/plan.md.
//   - Bron-vermelding "Kadaster Objectinformatie API" altijd zichtbaar.
import { useMemo, useState } from 'react';
import { FileSearch, ExternalLink, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  KadasterDeliverStatus, KadasterPreview, KadasterProductResult,
} from '@/lib/kadaster/types';
import { KADASTER_LABELS_PER_PRODUCT, KADASTER_STATUS_LABELS } from '@/lib/kadaster/types';
import { mapWozObject, heeftWozObjectInhoud } from '@/lib/kadaster/wozObject';
import { mapRechten, heeftRechtenInhoud } from '@/lib/kadaster/rechten';
import { mapRechtenBlokken } from '@/lib/kadaster/rechtenBlokken';
import KadasterRechtenBlokken from './KadasterRechtenBlokken';

/** Patch dat naar de parent gaat. Bewust beperkt tot veilige velden. */
export interface KadasterOvernamePatch {
  bouwjaar?: number;
  oppervlakte?: number;
}

/** Huidige CRM-waarden die nodig zijn om "leeg vs vervang" te bepalen. */
export interface KadasterHuidigeObjectVelden {
  bouwjaar?: number | null;
  oppervlakte?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: KadasterPreview | null;
  gebiedsVariant: 'buurtprofiel' | 'gebiedscontext';
  /** Huidige CRM-waarden voor "leeg vs vervang"-logica. */
  objectVelden?: KadasterHuidigeObjectVelden;
  /**
   * Wordt aangeroepen als de gebruiker expliciet "Overnemen" of
   * "Vervang huidige waarde" bevestigt. Parent voert de persist uit.
   */
  onOvernemen?: (patch: KadasterOvernamePatch, beschrijving: string) => Promise<void> | void;
}

function fmtDatumTijd(iso: string): string {
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}
function fmtEur(n: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
  }).format(n);
}
function fmtNum(n: number | null): string {
  return n === null ? '—' : new Intl.NumberFormat('nl-NL').format(n);
}
function fmtOpp(n: number | null): string {
  return n === null ? '—' : `${new Intl.NumberFormat('nl-NL').format(n)} m²`;
}
function fmtInh(n: number | null): string {
  return n === null ? '—' : `${new Intl.NumberFormat('nl-NL').format(n)} m³`;
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
function leesBool(data: unknown, ...keys: string[]): boolean | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'ja' || s === 'true' || s === '1') return true;
      if (s === 'nee' || s === 'false' || s === '0') return false;
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

function Row({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-data text-right">
        {value === null || value === '' ? '—' : value}
      </span>
    </div>
  );
}

/**
 * Eén regel met een Kadasterwaarde en een handmatige Overnemen-knop.
 * Toont automatisch "Overnemen" of "Vervang huidige waarde" afhankelijk
 * van of het CRM-doelveld al gevuld is. Equal-waarden geven geen knop.
 */
function OvernameRij({
  label, crmWaarde, kadasterWaarde, formatter, onBevestig, disabled,
}: {
  label: string;
  crmWaarde: number | null | undefined;
  kadasterWaarde: number | null;
  formatter: (n: number | null) => string;
  onBevestig: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const heeftCrm = crmWaarde !== null && crmWaarde !== undefined;
  const heeftKad = kadasterWaarde !== null && kadasterWaarde !== undefined;
  const gelijk = heeftCrm && heeftKad && Number(crmWaarde) === Number(kadasterWaarde);
  const moetVervangen = heeftCrm && heeftKad && !gelijk;

  return (
    <div className="rounded border border-border/60 p-2 space-y-1.5">
      <p className="text-[11px] font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CRM</p>
          <p className="font-mono-data">{heeftCrm ? formatter(Number(crmWaarde)) : 'leeg'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kadaster</p>
          <p className="font-mono-data">{formatter(kadasterWaarde)}</p>
        </div>
      </div>
      {!heeftKad ? (
        <p className="text-[10px] text-muted-foreground italic">Niet geleverd door Kadaster.</p>
      ) : gelijk ? (
        <p className="text-[10px] text-muted-foreground italic">CRM en Kadaster zijn al gelijk.</p>
      ) : moetVervangen ? (
        <>
          <Button
            size="sm" variant="outline" className="h-7 text-[11px]"
            disabled={disabled} onClick={() => setConfirmOpen(true)}
          >
            <ArrowDownToLine className="h-3 w-3 mr-1" /> Vervang huidige waarde
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Huidige waarde vervangen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Het veld <strong>{label}</strong> bevat al {formatter(Number(crmWaarde))}.
                  Wil je dit vervangen door de Kadasterwaarde{' '}
                  <strong>{formatter(kadasterWaarde)}</strong>?
                  <br /><br />
                  Bron: Kadaster Objectinformatie API. Deze actie wijzigt het
                  object direct.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={() => { void onBevestig(); }}>
                  Vervangen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <Button
          size="sm" variant="outline" className="h-7 text-[11px]"
          disabled={disabled} onClick={() => { void onBevestig(); }}
        >
          <ArrowDownToLine className="h-3 w-3 mr-1" /> Overnemen
        </Button>
      )}
    </div>
  );
}

function ProductCard({
  product, gebiedsVariant, objectVelden, onOvernemen,
}: {
  product: KadasterProductResult;
  gebiedsVariant: 'buurtprofiel' | 'gebiedscontext';
  objectVelden?: KadasterHuidigeObjectVelden;
  onOvernemen?: (patch: KadasterOvernamePatch, beschrijving: string) => Promise<void> | void;
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
          code: {product.code}{product.deliver ? ` · deliver: ${product.deliver}` : ''}
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
    const w0 = view.woz[0];

    async function neemBouwjaarOver() {
      if (!onOvernemen || view.bag.bouwjaar === null) return;
      await onOvernemen(
        { bouwjaar: view.bag.bouwjaar },
        `Bouwjaar (BAG) → ${view.bag.bouwjaar}`,
      );
      toast.success('Kadastergegevens overgenomen.');
    }
    async function neemOppervlakteBagOver() {
      if (!onOvernemen || view.bag.oppervlakteBag === null) return;
      await onOvernemen(
        { oppervlakte: view.bag.oppervlakteBag },
        `Oppervlakte (BAG) → ${view.bag.oppervlakteBag} m²`,
      );
      toast.success('Kadastergegevens overgenomen.');
    }
    async function neemOppervlakteWozOver() {
      if (!onOvernemen || !w0 || w0.oppervlakteWoz === null) return;
      await onOvernemen(
        { oppervlakte: w0.oppervlakteWoz },
        `Oppervlakte (WOZ) → ${w0.oppervlakteWoz} m²`,
      );
      toast.success('Kadastergegevens overgenomen.');
    }

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

            {w0 && (
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">WOZ-object</p>
                  {view.woz.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      Meerdere WOZ-objecten ({view.woz.length}) — V1 toont eerste
                    </span>
                  )}
                </div>
                <Row label="WOZ-objectnummer" value={w0.wozObjectNummer} />
                <Row label="Gebruiksklasse" value={w0.gebruiksklasse} />
                <Row label="Feitelijk gebruik" value={w0.feitelijkGebruik} />
                <Row label="Monumentaanduiding" value={w0.monumentaanduiding} />
                <Row label="WOZ-oppervlakte totaal" value={fmtOpp(w0.oppervlakteWoz)} />
                <Row label="WOZ-oppervlakte wonen" value={fmtOpp(w0.oppervlakteWozWonen)} />
                <Row label="WOZ-oppervlakte niet-wonen" value={fmtOpp(w0.oppervlakteWozNietWonen)} />
                <Row label="Inhoud" value={fmtInh(w0.inhoud)} />
                <Row label="Bouwlaag" value={w0.bouwlaag} />

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

            {/* ---- Handmatige overname ---- */}
            {onOvernemen && (view.bag.bouwjaar !== null
              || view.bag.oppervlakteBag !== null
              || (w0 && w0.oppervlakteWoz !== null)) && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Overnemen naar object
                </p>
                {view.bag.bouwjaar !== null && (
                  <OvernameRij
                    label="Bouwjaar"
                    crmWaarde={objectVelden?.bouwjaar ?? null}
                    kadasterWaarde={view.bag.bouwjaar}
                    formatter={(n) => n === null ? '—' : String(n)}
                    onBevestig={neemBouwjaarOver}
                  />
                )}
                {view.bag.oppervlakteBag !== null && (
                  <OvernameRij
                    label="Oppervlakte (BAG)"
                    crmWaarde={objectVelden?.oppervlakte ?? null}
                    kadasterWaarde={view.bag.oppervlakteBag}
                    formatter={fmtOpp}
                    onBevestig={neemOppervlakteBagOver}
                  />
                )}
                {w0 && w0.oppervlakteWoz !== null
                  && w0.oppervlakteWoz !== view.bag.oppervlakteBag && (
                  <OvernameRij
                    label="Oppervlakte (WOZ-totaal)"
                    crmWaarde={objectVelden?.oppervlakte ?? null}
                    kadasterWaarde={w0.oppervlakteWoz}
                    formatter={fmtOpp}
                    onBevestig={neemOppervlakteWozOver}
                  />
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  WOZ-objectnummer, vergund gebruik, feitelijk gebruik, monumentaanduiding,
                  gebruiksklasse en inhoud hebben momenteel geen CRM-doelveld.
                  Alleen preview — zie open punten in plan.
                </p>
              </div>
            )}
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

  // ---- Koopsom (productcode 'waarde') --------------------------------------
  if (product.code === 'waarde') {
    const koopsom = leesNummer(product.data, 'koopsom', 'price', 'amount');
    const koopJaar = leesNummer(product.data, 'koopJaar', 'koopjaar', 'jaar');
    const valuta = leesString(product.data, 'koopsomValuta', 'valuta', 'currency') ?? 'EUR';
    const meerOg = leesBool(product.data, 'meerOnroerendGoed');
    const doelbinding = leesString(product.data, 'doelbinding');

    const heeftIets = koopsom !== null || koopJaar !== null
      || meerOg !== null || doelbinding !== null;

    return (
      <div className="rounded-md border border-border bg-card p-3 space-y-2">
        {header}
        {heeftIets ? (
          <div className="space-y-1.5 text-xs">
            <Row
              label="Koopsom"
              value={koopsom !== null
                ? (valuta === 'EUR' ? fmtEur(koopsom) : `${fmtNum(koopsom)} ${valuta}`)
                : null}
            />
            <Row label="Koopjaar" value={koopJaar} />
            <Row label="Valuta" value={valuta} />
            <Row
              label="Meer onroerend goed"
              value={meerOg === null ? null : meerOg ? 'Ja' : 'Nee'}
            />
            <Row label="Doelbinding" value={doelbinding} />
            <p className="text-[10px] text-muted-foreground italic pt-1">
              Kadaster-koopsom is geen marktwaarde, vraagprijs of taxatiewaarde.
              Deze gegevens zijn intern opgeslagen als Kadasterrecord en worden
              niet automatisch overgenomen naar financiële objectvelden.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Niet geleverd voor dit adres.
          </p>
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

  // ---- Rechten / eigendomsinformatie (productcode 'rechten') ---------------
  // Experimentele preview (Fase 4K.3R). Geen opslag, geen automatische
  // koppeling aan Relaties, geen overname-knoppen.
  if (product.code === 'rechten') {
    const view = mapRechten(product.data);
    const heeft = heeftRechtenInhoud(view);
    return (
      <div className="rounded-md border border-border bg-card p-3 space-y-3">
        {header}
        <p className="text-[11px] text-muted-foreground">
          Rechthebbende(n) volgens Kadaster. Intern opgeslagen als
          Kadasterrecord, maar niet automatisch gekoppeld aan relaties,
          eigenaar of verkoper.
        </p>

        {!heeft ? (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            Rechten geleverd, maar rechthebbende-velden nog niet herkend.
            Bekijk technische details voor de response-shape.
          </p>
        ) : (
          <>
            {view.rechthebbenden.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Rechthebbenden volgens Kadaster ({view.rechthebbenden.length})
                </p>
                {view.rechthebbenden.map((r, i) => (
                  <div key={i} className="rounded border border-border/60 p-2 space-y-1 text-xs">
                    <Row label="Naam" value={r.naam} />
                    <Row label="Bedrijfsnaam" value={r.bedrijfsnaam} />
                    <Row label="Type" value={r.type} />
                    <Row label="Aandeel" value={r.aandeel} />
                    <Row label="Rechtsoort" value={r.rechtsoort} />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Object
              </p>
              <Row label="Kadastrale aanduiding" value={view.kadastraleAanduiding} />
              <Row label="Appartementsrecht" value={view.appartementsrecht} />
            </div>

            <p className="text-[10px] text-muted-foreground italic">
              Labels zoals "verkoper" of "opdrachtgever" worden niet automatisch
              toegekend — alleen "rechthebbende volgens Kadaster".
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

  // ---- Overige producten ---------------------------------------------------
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      {header}
      <p className="text-[11px] text-muted-foreground italic">
        Productdata aanwezig, maar geen velden herkend door de previewer.
        Bekijk de technische details.
      </p>
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
  open, onOpenChange, preview, gebiedsVariant, objectVelden, onOvernemen,
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
                  objectVelden={objectVelden}
                  onOvernemen={onOvernemen}
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
