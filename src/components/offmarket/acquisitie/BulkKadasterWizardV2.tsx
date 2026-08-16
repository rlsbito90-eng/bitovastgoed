import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Coins, FileSearch, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKadasterObjectinformatie, KadasterApiError } from '@/hooks/useKadasterObjectinformatie';
import { useKadasterProductCatalogus } from '@/hooks/useKadasterProductCatalogus';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import KadasterBerichtOpenKnop from './KadasterBerichtOpenKnop';
import {
  bouwBulkKadasterPreflightMetBag,
  type BulkKadasterBestaandDocument,
  type BulkKadasterBestaandRecord,
  type BulkKadasterPreflightRij,
} from '@/lib/offMarket/acquisitie/bulkKadaster';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Na een afgeronde batch terug naar Acquisitieselectie in plaats van de onderliggende Focus-kaart. */
  onResultaatClose?: () => void;
  signalen: OffMarketSignaal[];
}
type Fase = 'preflight' | 'bevestigen' | 'uitvoeren' | 'resultaat';
type UitvoerStatus = 'wacht' | 'bezig' | 'geslaagd' | 'waarschuwing' | 'overgeslagen' | 'mislukt' | 'onzeker';
interface UitvoerRij { signaalId: string; adres: string; status: UitvoerStatus; melding: string; }

async function laadBestaandeData(signaalIds: string[]) {
  if (signaalIds.length === 0) return { records: [], documenten: [] };
  const db = supabase as any;
  const [{ data: records, error: recordsError }, { data: documenten, error: docsError }] = await Promise.all([
    db.from('kadaster_data_records').select('id,signaal_id,product_code,status,fetched_at,zoekadres,raw_limited').in('signaal_id', signaalIds).order('fetched_at', { ascending: false }),
    db.from('kadaster_documenten').select('id,signaal_id,kadaster_data_record_id,product_codes,fetched_at').in('signaal_id', signaalIds).order('fetched_at', { ascending: false }),
  ]);
  if (recordsError) throw new Error(recordsError.message);
  if (docsError) throw new Error(docsError.message);
  return { records: (records ?? []) as BulkKadasterBestaandRecord[], documenten: (documenten ?? []) as BulkKadasterBestaandDocument[] };
}

async function verwerkEigenaarUitOpgeslagenPdf(signaalId: string, recordId: string, documentId: string) {
  const { error } = await supabase.functions.invoke('offmarket-kadaster-pdf-eigenaar-extractie', {
    body: { signaal_id: signaalId, record_id: recordId, document_id: documentId },
  });
  if (error) throw new Error(error.message || 'Eigenaarverwerking uit opgeslagen PDF is mislukt.');
}

async function registreerDefinitieveNotFound(signaalId: string, zoekadresLabel: string) {
  const { error } = await (supabase as any).from('kadaster_data_records').insert({
    signaal_id: signaalId,
    product_code: 'rechten',
    status: 'niet_geleverd',
    zoekadres: { type: 'pht', waarde: zoekadresLabel },
    raw_limited: { poging: { uitkomst: 'not_found', bron: 'bulk_kadaster', vastgelegd_op: new Date().toISOString() } },
  });
  if (error) throw new Error(error.message);
}

function statusLabel(status: BulkKadasterPreflightRij['status']) {
  if (status === 'aanvragen') return 'Nieuwe aanvraag';
  if (status === 'aanwezig') return 'Al aanwezig';
  return 'Geblokkeerd';
}
function uitvoerLabel(status: UitvoerStatus) {
  switch (status) {
    case 'wacht': return 'Wacht'; case 'bezig': return 'Bezig'; case 'geslaagd': return 'Geslaagd';
    case 'waarschuwing': return 'Geslaagd · controle'; case 'overgeslagen': return 'Overgeslagen';
    case 'mislukt': return 'Mislukt'; case 'onzeker': return 'Onzeker — stop';
  }
}

export default function BulkKadasterWizard({ open, onClose, onResultaatClose, signalen }: Props) {
  const [fase, setFase] = useState<Fase>('preflight');
  const [preflight, setPreflight] = useState<BulkKadasterPreflightRij[]>([]);
  const [preflightBezig, setPreflightBezig] = useState(false);
  const [preflightFout, setPreflightFout] = useState<string | null>(null);
  const [uitvoer, setUitvoer] = useState<UitvoerRij[]>([]);
  const [stopReden, setStopReden] = useState<string | null>(null);
  const catalogus = useKadasterProductCatalogus(open);
  const mutation = useKadasterObjectinformatie();
  const signaalIds = useMemo(() => signalen.map(s => s.id), [signalen]);
  const rechtenProduct = catalogus.data?.products.find(p => p.code === 'rechten') ?? null;
  const prijs = rechtenProduct?.priceEur ?? null;
  const aanvragen = preflight.filter(r => r.status === 'aanvragen');
  const aanwezig = preflight.filter(r => r.status === 'aanwezig');
  const bestaandeEigenaarverwerking = aanwezig.filter(r => !!r.bestaandRecordId && !!r.bestaandDocumentId);
  const geblokkeerd = preflight.filter(r => r.status === 'geblokkeerd');
  const geschatteKosten = prijs === null ? null : aanvragen.length * prijs;
  const heeftWerk = aanvragen.length > 0 || bestaandeEigenaarverwerking.length > 0;

  const doePreflight = async () => {
    setPreflightBezig(true); setPreflightFout(null); setStopReden(null); setUitvoer([]);
    try {
      const bestaand = await laadBestaandeData(signaalIds);
      setPreflight(await bouwBulkKadasterPreflightMetBag(signalen, bestaand.records, bestaand.documenten));
      setFase('preflight');
    } catch (e) { setPreflight([]); setPreflightFout(e instanceof Error ? e.message : 'Preflight mislukt'); }
    finally { setPreflightBezig(false); }
  };

  useEffect(() => { if (open) void doePreflight(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, signaalIds.join('|')]);

  const reset = () => {
    setFase('preflight'); setPreflight([]); setUitvoer([]); setStopReden(null);
  };
  const sluit = (afgerondResultaat = false) => {
    if (fase === 'uitvoeren') return;
    reset();
    if (afgerondResultaat && onResultaatClose) onResultaatClose();
    else onClose();
  };

  const verversEnCheckOfAlAanwezig = async (signaal: OffMarketSignaal) => {
    const bestaand = await laadBestaandeData([signaal.id]);
    return (await bouwBulkKadasterPreflightMetBag([signaal], bestaand.records, bestaand.documenten))[0];
  };
  const updateUitvoer = (id: string, patch: Partial<UitvoerRij>) => setUitvoer(prev => prev.map(r => r.signaalId === id ? { ...r, ...patch } : r));

  const startUitvoering = async () => {
    if (!heeftWerk) return;
    if (aanvragen.length > 0 && !rechtenProduct) { toast.error('Rechten is niet beschikbaar voor deze Kadaster API-key.'); return; }
    setFase('uitvoeren'); setStopReden(null);
    setUitvoer(preflight.map(r => ({
      signaalId: r.signaal.id,
      adres: formatSignaalAdres(r.signaal) || r.signaal.titel || '—',
      status: r.status === 'aanvragen' || (r.status === 'aanwezig' && r.bestaandRecordId && r.bestaandDocumentId) ? 'wacht' : 'overgeslagen',
      melding: r.reden,
    })));

    for (const rij of bestaandeEigenaarverwerking) {
      if (!rij.bestaandRecordId || !rij.bestaandDocumentId) continue;
      updateUitvoer(rij.signaal.id, { status: 'bezig', melding: 'Bestaand Kadasterbericht wordt verwerkt naar eigenaar/rechthebbenden…' });
      try {
        await verwerkEigenaarUitOpgeslagenPdf(rij.signaal.id, rij.bestaandRecordId, rij.bestaandDocumentId);
        updateUitvoer(rij.signaal.id, { status: 'overgeslagen', melding: 'Geen nieuwe Kadasteraanvraag. Eigenaar/rechthebbenden zijn verwerkt uit het al opgeslagen Kadasterbericht.' });
      } catch (e) {
        updateUitvoer(rij.signaal.id, { status: 'waarschuwing', melding: `Geen nieuwe Kadasteraanvraag. Eigenaarverwerking vraagt controle: ${e instanceof Error ? e.message : 'onbekende fout'}` });
      }
    }

    for (const rij of aanvragen) {
      const signaal = rij.signaal;
      if (!rij.adresInput) continue;
      updateUitvoer(signaal.id, { status: 'bezig', melding: 'Laatste veiligheidscheck…' });
      let actueel: BulkKadasterPreflightRij;
      try { actueel = await verversEnCheckOfAlAanwezig(signaal); }
      catch (e) { const melding = `Veiligheidscheck mislukt: ${e instanceof Error ? e.message : 'onbekende fout'}`; updateUitvoer(signaal.id, { status: 'onzeker', melding }); setStopReden(melding); break; }
      if (actueel.status !== 'aanvragen' || !actueel.adresInput) { updateUitvoer(signaal.id, { status: 'overgeslagen', melding: actueel.reden }); continue; }

      updateUitvoer(signaal.id, { status: 'bezig', melding: 'Betaalde Rechten-aanvraag wordt uitgevoerd…' });
      try {
        const resp = await mutation.mutateAsync({ modus: 'kadaster', adres: actueel.adresInput, producten: ['rechten'], context: { signaal_id: signaal.id }, persist: true, includePdf: true });
        const rechten = resp.producten.find(p => p.code === 'rechten');
        if (!rechten?.beschikbaar) { updateUitvoer(signaal.id, { status: 'mislukt', melding: rechten?.foutmelding ?? 'Kadaster leverde geen bruikbare Rechten-informatie.' }); continue; }
        if (!resp.persist?.ok) { const melding = 'Kadaster antwoordde, maar lokale opslag is niet bevestigd. Niet opnieuw aanvragen voordat dit dossier is gecontroleerd.'; updateUitvoer(signaal.id, { status: 'onzeker', melding }); setStopReden(melding); break; }
        const pdf = resp.persist.pdf;
        if (pdf?.requested && !pdf.ok) { const melding = 'Rechten zijn opgehaald en opgeslagen, maar het Kadasterbericht/PDF is niet bevestigd. Geen automatische herhaalaanvraag.'; updateUitvoer(signaal.id, { status: 'onzeker', melding }); setStopReden(melding); break; }
        const recordId = resp.persist.record_ids?.[0] ?? null;
        const documentId = pdf?.document_id ?? null;
        if (recordId && documentId) {
          try {
            await verwerkEigenaarUitOpgeslagenPdf(signaal.id, recordId, documentId);
            updateUitvoer(signaal.id, { status: 'geslaagd', melding: 'Rechten + Kadasterbericht opgeslagen. Eigenaar/rechthebbenden zijn direct verwerkt.' });
          } catch (e) {
            updateUitvoer(signaal.id, { status: 'waarschuwing', melding: `Rechten + Kadasterbericht zijn veilig opgeslagen, maar eigenaarverwerking vraagt controle: ${e instanceof Error ? e.message : 'onbekende fout'}` });
          }
        } else updateUitvoer(signaal.id, { status: 'waarschuwing', melding: 'Rechten + Kadasterbericht zijn opgeslagen, maar de eigenaarverwerking kon niet veilig worden gekoppeld aan record/PDF.' });
      } catch (e) {
        const api = e instanceof KadasterApiError ? e : null;
        if (api?.code === 'not_found') {
          try {
            await registreerDefinitieveNotFound(signaal.id, actueel.zoekadresLabel ?? rij.zoekadresLabel ?? 'onbekend');
            updateUitvoer(signaal.id, { status: 'mislukt', melding: `${e.message} Deze uitkomst is vastgelegd; dit zoekadres wordt niet automatisch opnieuw betaald aangevraagd.` });
            continue;
          } catch (auditError) {
            const melding = `Kadaster vond geen object, maar de poging kon lokaal niet veilig worden vastgelegd (${auditError instanceof Error ? auditError.message : 'onbekende fout'}). Batch gestopt om een herhaalaanvraag te voorkomen.`;
            updateUitvoer(signaal.id, { status: 'onzeker', melding }); setStopReden(melding); break;
          }
        }
        const onzeker = !api || api.code === 'upstream_unavailable' || api.code === 'unknown' || (api.httpStatus ?? 0) >= 500;
        const melding = onzeker ? `${e instanceof Error ? e.message : 'Kadaster-aanvraag gaf een onzekere uitkomst.'} Batch gestopt om dubbele kosten te voorkomen.` : (e instanceof Error ? e.message : 'Kadaster-aanvraag mislukt');
        updateUitvoer(signaal.id, { status: onzeker ? 'onzeker' : 'mislukt', melding });
        if (onzeker) { setStopReden(melding); break; }
      }
    }
    setFase('resultaat');
  };

  const resultaatTellingen = useMemo(() => ({
    geslaagd: uitvoer.filter(r => r.status === 'geslaagd').length,
    waarschuwing: uitvoer.filter(r => r.status === 'waarschuwing').length,
    overgeslagen: uitvoer.filter(r => r.status === 'overgeslagen').length,
    mislukt: uitvoer.filter(r => r.status === 'mislukt').length,
    onzeker: uitvoer.filter(r => r.status === 'onzeker').length,
  }), [uitvoer]);

  return <Dialog open={open} onOpenChange={(v) => { if (!v) sluit(fase === 'resultaat'); }}>
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="bulk-kadaster-wizard">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSearch className="h-4 w-4" /> Bulk Kadaster — Rechten</DialogTitle><DialogDescription>Eerst gratis preflight. Alleen na de tweede, expliciete bevestiging worden betaalde Kadasteraanvragen uitgevoerd.</DialogDescription></DialogHeader>
      {(fase === 'preflight' || fase === 'bevestigen') && <div className="space-y-4">
        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">{preflightBezig ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preflight uitvoeren…</div> : preflightFout ? <div className="text-destructive">Preflight mislukt: {preflightFout}</div> : <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div><span className="text-muted-foreground">Geselecteerd</span><p className="font-semibold">{preflight.length}</p></div><div><span className="text-muted-foreground">Nieuwe aanvragen</span><p className="font-semibold">{aanvragen.length}</p></div><div><span className="text-muted-foreground">Al aanwezig</span><p className="font-semibold">{aanwezig.length}</p></div><div><span className="text-muted-foreground">Geblokkeerd</span><p className="font-semibold">{geblokkeerd.length}</p></div><div><span className="text-muted-foreground">Geschatte kosten</span><p className="font-semibold">{geschatteKosten === null ? 'prijs volgens Kadaster' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(geschatteKosten)}</p></div>
        </div>}</div>
        {catalogus.isError && aanvragen.length > 0 && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">Product-/prijsinformatie kon niet worden geladen. Er wordt niets betaald zolang Rechten niet expliciet beschikbaar is.</div>}
        <div className="space-y-2">{preflight.map(r => <div key={r.signaal.id} className="rounded-md border border-border p-3 text-xs space-y-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-foreground">{formatSignaalAdres(r.signaal) || r.signaal.titel || '—'}</span><span className="text-muted-foreground">{statusLabel(r.status)}</span></div>{r.zoekadresLabel && <p className="font-mono-data text-muted-foreground">Zoekadres: {r.zoekadresLabel}</p>}<p className={r.status === 'geblokkeerd' ? 'text-destructive' : 'text-muted-foreground'}>{r.reden}</p></div>)}</div>
        {fase === 'bevestigen' && <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm space-y-2"><div className="flex items-start gap-2 text-amber-950"><ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /><div><p className="font-semibold">Definitieve verwerkingsbevestiging</p><p className="text-xs">{aanvragen.length > 0 ? `Je start maximaal ${aanvragen.length} nieuwe Rechten-aanvragen. ` : 'Er worden geen nieuwe betaalde Kadasteraanvragen gestart. '}{bestaandeEigenaarverwerking.length > 0 ? `${bestaandeEigenaarverwerking.length} al opgeslagen Kadasterbericht(en) worden gebruikt voor eigenaarverwerking.` : ''}</p></div></div><p className="text-xs text-amber-950">Bij een onzekere netwerk- of opslaguitkomst stopt de betaalde batch onmiddellijk. De wizard doet nooit automatisch een betaalde retry.</p></div>}
      </div>}
      {(fase === 'uitvoeren' || fase === 'resultaat') && <div className="space-y-4"><div className="rounded-md border border-border bg-muted/20 p-3 text-xs"><div className="flex flex-wrap gap-x-4 gap-y-1"><span>Geslaagd: <strong>{resultaatTellingen.geslaagd}</strong></span><span>Controle: <strong>{resultaatTellingen.waarschuwing}</strong></span><span>Overgeslagen: <strong>{resultaatTellingen.overgeslagen}</strong></span><span>Mislukt: <strong>{resultaatTellingen.mislukt}</strong></span><span>Onzeker: <strong>{resultaatTellingen.onzeker}</strong></span></div></div>{stopReden && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{stopReden}</span></div>}<div className="space-y-2">{uitvoer.map(r => <div key={r.signaalId} className="rounded-md border border-border p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-medium">{r.adres}</span><span className="flex items-center gap-1 text-muted-foreground">{r.status === 'bezig' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{r.status === 'geslaagd' && <CheckCircle2 className="h-3.5 w-3.5" />}{uitvoerLabel(r.status)}</span></div><p className="mt-1 text-muted-foreground">{r.melding}</p>{fase === 'resultaat' && (r.status === 'geslaagd' || r.status === 'waarschuwing' || r.status === 'overgeslagen') && <div className="mt-2"><KadasterBerichtOpenKnop signaalId={r.signaalId} hideWhenMissing /></div>}</div>)}</div></div>}
      <DialogFooter>{(fase === 'preflight' || fase === 'bevestigen') && <><Button variant="ghost" onClick={() => sluit(false)} disabled={preflightBezig}>Annuleren</Button><Button variant="outline" onClick={() => void doePreflight()} disabled={preflightBezig}>Preflight opnieuw</Button>{fase === 'preflight' ? <Button onClick={() => setFase('bevestigen')} disabled={preflightBezig || !!preflightFout || !heeftWerk || (aanvragen.length > 0 && !rechtenProduct)}>{aanvragen.length > 0 ? <Coins className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{aanvragen.length > 0 ? 'Naar betaalbevestiging' : 'Bestaande eigenaargegevens verwerken'}</Button> : <Button onClick={() => void startUitvoering()} disabled={!heeftWerk || mutation.isPending}>{aanvragen.length > 0 ? <Coins className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{aanvragen.length > 0 ? `Definitief ${aanvragen.length} Rechten aanvragen` : `Verwerk ${bestaandeEigenaarverwerking.length} opgeslagen Kadasterbericht(en)`}</Button>}</>}{fase === 'uitvoeren' && <Button disabled><Loader2 className="h-4 w-4 animate-spin" /> Batch uitvoeren…</Button>}{fase === 'resultaat' && <Button onClick={() => sluit(true)}>Sluiten en terug naar selectie</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
