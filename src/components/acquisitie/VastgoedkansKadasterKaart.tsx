import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Coins, FileSearch, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KadasterPreviewDialog from '@/components/object/kadaster/KadasterPreviewDialog';
import VastgoedkansEigenaarRelatieKaart from '@/components/acquisitie/VastgoedkansEigenaarRelatieKaart';
import BagAdresLookup from '@/components/shared/BagAdresLookup';
import { useKadasterDataRecordsForVastgoedkans, laatsteRecordsPerProduct } from '@/hooks/useKadasterDataRecords';
import { KadasterApiError, useKadasterObjectinformatie } from '@/hooks/useKadasterObjectinformatie';
import { useKadasterProductCatalogus } from '@/hooks/useKadasterProductCatalogus';
import type { BagAdresResultaat } from '@/lib/bag/pdokLookup';
import { parseObjectAdres } from '@/lib/kadaster/adres';
import type { KadasterPreview, KadasterProductCode, KadasterRequestInput } from '@/lib/kadaster/types';

interface Props {
  vastgoedkansId: string;
  adres: string | null | undefined;
  postcode: string | null | undefined;
  plaats: string | null | undefined;
}

function normaliseerPostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? compact : null;
}

function formatDatum(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function formatEuro(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export default function VastgoedkansKadasterKaart({ vastgoedkansId, adres, postcode, plaats }: Props) {
  const parsed = useMemo(() => parseObjectAdres(adres, postcode, plaats), [adres, postcode, plaats]);
  const [gekozenBagAdres, setGekozenBagAdres] = useState<BagAdresResultaat | null>(null);

  useEffect(() => {
    setGekozenBagAdres(null);
  }, [vastgoedkansId, adres, postcode, plaats]);

  const initieelHuisnummer = parsed.huisnummers[0] ?? null;
  const postcodeApi = normaliseerPostcode(gekozenBagAdres?.postcode ?? postcode ?? parsed.postcode);
  const huisnummer = gekozenBagAdres?.huisnummer ?? initieelHuisnummer?.huisnummer ?? null;
  const huisletter = gekozenBagAdres ? gekozenBagAdres.huisletter : (initieelHuisnummer?.huisletter ?? null);
  const toevoeging = gekozenBagAdres ? gekozenBagAdres.huisnummertoevoeging : (initieelHuisnummer?.toevoeging ?? null);
  // Betaalde Kadasteractie pas vrijgeven nadat PDOK/BAG een officieel adres heeft gekozen.
  // Daarmee kan een ruwe Vastgoedkans-adresstring niet rechtstreeks meer naar Kadaster lekken.
  const adresKlaar = !!gekozenBagAdres && !!postcodeApi && !!huisnummer;
  const adresLabel = adresKlaar
    ? [postcodeApi, `${huisnummer ?? ''}${huisletter ?? ''}`, toevoeging].filter(Boolean).join(' ')
    : [adres, postcode, plaats].filter(Boolean).join(', ') || 'Adres niet compleet';

  const [kostenOpen, setKostenOpen] = useState(false);
  const [rechtenOpen, setRechtenOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<KadasterPreview | null>(null);
  const [selObject, setSelObject] = useState(true);
  const [selWaarde, setSelWaarde] = useState(true);
  const [selRechten, setSelRechten] = useState(false);

  const mutation = useKadasterObjectinformatie();
  const queryClient = useQueryClient();
  const recordsQuery = useKadasterDataRecordsForVastgoedkans(vastgoedkansId);
  const laatste = useMemo(() => laatsteRecordsPerProduct(recordsQuery.data ?? []), [recordsQuery.data]);
  const catalogus = useKadasterProductCatalogus(kostenOpen);
  const rechtenItem = useMemo(() => catalogus.data?.products.find((p) => p.code === 'rechten') ?? null, [catalogus.data]);
  const rechtenBeschikbaar = !!rechtenItem;
  const heeftBetaaldProduct = selObject || selWaarde || (selRechten && rechtenBeschikbaar);

  function geselecteerdeProducten(): KadasterProductCode[] {
    const out: KadasterProductCode[] = [];
    if (selObject) out.push('object');
    if (selWaarde) out.push('waarde');
    if (selRechten && rechtenBeschikbaar) out.push('rechten');
    return out;
  }

  async function voerCallUit() {
    if (!adresKlaar || !postcodeApi || !huisnummer) {
      toast.error('Het adres is niet compleet genoeg voor Kadaster. Controleer eerst het officiële BAG-adres.');
      return;
    }
    if (!heeftBetaaldProduct) {
      toast.error('Selecteer minimaal één betaald Kadaster-product.');
      return;
    }

    const input: KadasterRequestInput = {
      modus: 'kadaster',
      adres: {
        postalcode: postcodeApi,
        houseNumber: huisnummer,
        houseLetter: huisletter ?? null,
        houseNumberAddition: toevoeging ?? null,
      },
      producten: geselecteerdeProducten(),
      context: { vastgoedkans_id: vastgoedkansId },
      persist: true,
      // BUILD 2.0B.1: document-persistence is nog niet gegeneraliseerd naar Vastgoedkansen.
      includePdf: false,
    };

    try {
      const resp = await mutation.mutateAsync(input);
      setPreview(resp);
      setPreviewOpen(true);
      if (resp.persist?.ok) {
        await queryClient.invalidateQueries({ queryKey: ['kadaster_data_records', 'vastgoedkans', vastgoedkansId] });
        toast.success('Kadastergegevens opgeslagen bij deze Vastgoedkans.');
      } else if (resp.persist?.requested) {
        toast.warning('Kadastergegevens zijn opgehaald, maar opslaan is mislukt. Doe geen nieuwe aanvraag voordat dit is gecontroleerd.', { duration: 12_000 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kadaster-aanvraag mislukt.';
      const extra = error instanceof KadasterApiError && error.httpStatus ? ` (HTTP ${error.httpStatus})` : '';
      toast.error(`${message}${extra}`);
    }
  }

  function bevestigKosten() {
    if (!adresKlaar) {
      toast.error('Controleer eerst het Vastgoedkans-adres via BAG/PDOK en kies een officieel adres.');
      return;
    }
    setKostenOpen(true);
  }

  const objectRecord = laatste.get('object');
  const waardeRecord = laatste.get('waarde');
  const rechtenRecord = laatste.get('rechten');
  const laatsteDatum = recordsQuery.data?.[0]?.fetched_at ?? null;

  return (
    <section className="section-card p-4 sm:p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4" />
          <h2 className="font-medium">Kadastergegevens ophalen</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Controleer eerst gratis het officiële BAG-adres. Alleen na expliciete kostenbevestiging wordt een Kadasteraanvraag gedaan en aan deze Vastgoedkans opgeslagen. Er wordt niets automatisch naar eigenaar- of dossiervelden overgenomen.
        </p>
      </div>

      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Zoekadres voor Kadaster</span>
        </div>
        <BagAdresLookup
          initieleStraat={parsed.straat ?? null}
          initieelHuisnummer={initieelHuisnummer?.huisnummer ?? null}
          initielePlaats={plaats ?? parsed.plaats ?? null}
          initielePostcode={postcode ?? parsed.postcode ?? null}
          voorkeursHuisnummerLabel={initieelHuisnummer?.label ?? null}
          onKies={(resultaat) => setGekozenBagAdres(resultaat)}
        />
        <div className="rounded-md border bg-background/60 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Aanvraagadres</span>
            <span className="font-mono-data">{adresLabel}</span>
          </div>
          {gekozenBagAdres && (
            <p className="mt-2 text-xs text-muted-foreground">
              Officieel BAG-adres gekozen: {gekozenBagAdres.weergavenaam || adresLabel}
            </p>
          )}
          {!adresKlaar && <p className="mt-2 text-xs text-destructive">Nog geen bruikbaar officieel BAG-adres gekozen; Kadaster-opvragen blijft geblokkeerd.</p>}
        </div>
      </div>

      {(recordsQuery.data?.length ?? 0) > 0 && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Opgeslagen Kadastergegevens</p>
              <p className="text-xs text-muted-foreground">Laatste opvraag: {formatDatum(laatsteDatum)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {objectRecord && <Badge variant="outline">WOZ-object</Badge>}
              {waardeRecord && <Badge variant="outline">Koopsom</Badge>}
              {rechtenRecord && <Badge variant="outline">Rechten</Badge>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Koopsom</p><p className="mt-1 text-sm">{formatEuro(waardeRecord?.koopsom)}</p></div>
            <div><p className="text-xs text-muted-foreground">Kadastrale aanduiding</p><p className="mt-1 text-sm">{rechtenRecord?.kadastrale_aanduiding || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Rechthebbende</p><p className="mt-1 text-sm">{rechtenRecord?.rechthebbende_naam || '—'}</p></div>
          </div>
        </div>
      )}

      <Button onClick={bevestigKosten} disabled={!adresKlaar || mutation.isPending}>
        <Coins className="mr-2 h-4 w-4" />
        {mutation.isPending ? 'Bezig…' : 'Kadastergegevens ophalen'}
      </Button>

      <Dialog open={kostenOpen} onOpenChange={setKostenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Producten en kosten bevestigen</DialogTitle>
            <DialogDescription>Deze aanvraag wordt door Kadaster in rekening gebracht. Er wordt geen PDF besteld of opgeslagen voor Vastgoedkansen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="rounded-md border bg-muted/30 p-3 text-xs"><span className="text-muted-foreground">Zoekadres: </span><span className="font-mono-data">{adresLabel}</span></div>
            <label className="flex items-center justify-between gap-2 rounded-md border p-2"><span className="flex items-center gap-2"><Checkbox checked={selObject} onCheckedChange={(v) => setSelObject(v === true)} /><span>WOZ-object</span></span><span className="text-xs text-muted-foreground">prijs volgens Kadaster</span></label>
            <label className="flex items-center justify-between gap-2 rounded-md border p-2"><span className="flex items-center gap-2"><Checkbox checked={selWaarde} onCheckedChange={(v) => setSelWaarde(v === true)} /><span>Koopsom</span></span><span className="text-xs text-muted-foreground">prijs volgens Kadaster</span></label>
            {rechtenBeschikbaar && (
              <label className="flex items-start justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2">
                <span className="flex items-start gap-2"><Checkbox className="mt-0.5" checked={selRechten} onCheckedChange={(v) => setSelRechten(v === true)} /><span><span className="block">{rechtenItem?.name?.trim() || 'Rechten / eigendomsinformatie'}</span><span className="block text-[10px] text-amber-900/80">Gevoelige eigendomsinformatie; aparte bevestiging vereist.</span></span></span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{rechtenItem?.priceEur != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(rechtenItem.priceEur) : 'prijs volgens Kadaster'}</span>
              </label>
            )}
            {!rechtenBeschikbaar && <p className="text-[11px] text-muted-foreground">{catalogus.isLoading ? 'Productlijst wordt opgehaald…' : 'Rechten/eigendomsinformatie is niet beschikbaar voor deze API-key.'}</p>}
            {!heeftBetaaldProduct && <p className="text-xs text-destructive">Selecteer minimaal één betaald product.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKostenOpen(false)} disabled={mutation.isPending}>Annuleren</Button>
            <Button disabled={mutation.isPending || !heeftBetaaldProduct} onClick={async () => {
              if (selRechten && rechtenBeschikbaar) {
                setKostenOpen(false);
                setRechtenOpen(true);
                return;
              }
              setKostenOpen(false);
              await voerCallUit();
            }}>Ophalen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rechtenOpen} onOpenChange={setRechtenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechten / eigendomsinformatie bevestigen</AlertDialogTitle>
            <AlertDialogDescription>
              Dit betaalde product kan namen of bedrijfsnamen van rechthebbenden bevatten. Het resultaat wordt uitsluitend als Kadasterrecord aan deze Vastgoedkans opgeslagen; er wordt geen eigenaar of relatie automatisch aangemaakt of gekoppeld.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Annuleren</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.isPending} onClick={async () => { setRechtenOpen(false); await voerCallUit(); }}>Rechten ophalen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VastgoedkansEigenaarRelatieKaart vastgoedkansId={vastgoedkansId} />
      <KadasterPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} preview={preview} gebiedsVariant="gebiedscontext" />
    </section>
  );
}
