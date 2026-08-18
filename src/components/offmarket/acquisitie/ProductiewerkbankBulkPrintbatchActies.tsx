import { useEffect, useMemo, useState } from 'react';
import { Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { bouwProductiekernBatchProductiepakket } from '@/lib/offMarket/acquisitie/productiekernBatchProductiepakket';
import { bepaalActieveProductiekernBatchdocumenten } from '@/lib/offMarket/acquisitie/productiekernBatchdocumentHerstel';
import { laadProductiekernBatch } from '@/lib/offMarket/acquisitie/productiekernBatchLezer';
import type { BatchdocumentContract, PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernProductiepakketPayload } from '@/lib/offMarket/acquisitie/productiekernProductiepakketSamenstelling';
import { startProductiekernPrintbatch, type ProductiekernBatchBrief } from '@/lib/offMarket/acquisitie/productiekernPrintbatch';
import ProductiekernPrintPostBevestiging from './ProductiekernPrintPostBevestiging';
import ProductiekernProductiepakketVastleggen from './ProductiekernProductiepakketVastleggen';
import ProductiekernVastgelegdeDocumentenDownload from './ProductiekernVastgelegdeDocumentenDownload';

interface Props {
  briefIds: readonly string[];
}

function lokaleDatum(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Eén formele BAT over definitieve brieven uit meerdere acquisitiesignalen. */
export default function ProductiewerkbankBulkPrintbatchActies({ briefIds }: Props) {
  const ids = useMemo(() => [...new Set(briefIds)].sort(), [briefIds]);
  const idsKey = ids.join('|');
  const lezen = useMemo(() => maakStandaardProductiekernBrowserLeesSamenstelling(), []);
  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);
  const actief = lezen.activatie.lezenActief && writes.activatie.schrijvenActief && ids.length > 0;

  const [herstelBezig, setHerstelBezig] = useState(true);
  const [herstelFout, setHerstelFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [batch, setBatch] = useState<PrintbatchContract | null>(null);
  const [batchBrieven, setBatchBrieven] = useState<ProductiekernBatchBrief[]>([]);
  const [pakket, setPakket] = useState<ProductiekernProductiepakketPayload | null>(null);
  const [documenten, setDocumenten] = useState<BatchdocumentContract[]>([]);
  const [documentenBezig, setDocumentenBezig] = useState(false);
  const [documentenFout, setDocumentenFout] = useState<string | null>(null);

  useEffect(() => {
    setBatch(null);
    setBatchBrieven([]);
    setPakket(null);
    setDocumenten([]);
    setHerstelFout(null);
  }, [idsKey]);

  useEffect(() => {
    if (!actief || batch) {
      setHerstelBezig(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setHerstelBezig(true);
      setHerstelFout(null);
      try {
        const scope: ProductiekernBatchBrief[] = [];
        const batchIds: Array<string | null> = [];
        for (const briefId of ids) {
          const [brief, versies] = await Promise.all([
            lezen.repository.haalBrief(briefId),
            lezen.repository.haalBriefversies(briefId),
          ]);
          if (!brief || brief.status !== 'definitief' || !brief.briefnummer || !brief.actieveVersie) {
            throw new Error(`Brief ${briefId} is niet definitief of mist een BR-nummer.`);
          }
          const versie = versies.find((v) =>
            v.versienummer === brief.actieveVersie && (v.status === 'actief' || v.status === 'verzonden'));
          if (!versie) throw new Error(`Actuele immutable versie voor ${brief.briefnummer} ontbreekt.`);
          scope.push({ brief, versie, geadresseerdeKey: `${brief.signaalId}|${versie.id}` });
          batchIds.push(await lezen.repository.haalActievePrintbatchIdVoorBriefversies([versie.id]));
        }

        const gekoppeld = batchIds.filter((id): id is string => Boolean(id));
        if (gekoppeld.length === 0) {
          if (!cancelled) setBatchBrieven(scope);
          return;
        }
        const uniek = new Set(gekoppeld);
        if (gekoppeld.length !== batchIds.length || uniek.size !== 1) {
          throw new Error('De gekozen definitieve brieven zijn deels al aan een andere printbatch gekoppeld. Selecteer één consistente productiescope.');
        }

        const bestaandId = [...uniek][0];
        const geladen = await laadProductiekernBatch(bestaandId, lezen.repository);
        const geladenIds = geladen.brieven.map((x) => x.brief.id).sort();
        if (JSON.stringify(geladenIds) !== JSON.stringify(ids)) {
          throw new Error('De bestaande printbatch bevat een andere briefscope dan de huidige selectie.');
        }
        if (cancelled) return;
        setBatch(geladen.batch);
        setBatchBrieven(geladen.brieven);
        if (geladen.batch.status === 'concept') {
          setPakket(bouwProductiekernBatchProductiepakket({ batch: geladen.batch, brieven: geladen.brieven }));
        }
      } catch (error) {
        if (!cancelled) setHerstelFout(error instanceof Error ? error.message : 'Printbatch kon niet veilig worden hersteld.');
      } finally {
        if (!cancelled) setHerstelBezig(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [actief, batch, idsKey, lezen.repository]);

  useEffect(() => {
    if (!actief || !batch || batch.status === 'concept') {
      setDocumenten([]);
      setDocumentenFout(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setDocumentenBezig(true);
      setDocumentenFout(null);
      try {
        const alle = await lezen.repository.haalBatchdocumenten(batch.id);
        const actueel = bepaalActieveProductiekernBatchdocumenten({ batch, documenten: alle });
        if (!cancelled) setDocumenten(actueel);
      } catch (error) {
        if (!cancelled) setDocumentenFout(error instanceof Error ? error.message : 'Productiebestanden konden niet veilig worden geladen.');
      } finally {
        if (!cancelled) setDocumentenBezig(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [actief, batch?.id, batch?.status, batch?.documentversie, lezen.repository]);

  if (!actief) return null;

  const maakBatch = async () => {
    if (bezig || herstelBezig || herstelFout || batch || batchBrieven.length !== ids.length) return;
    const bevestigd = window.confirm(
      `${ids.length} definitieve ${ids.length === 1 ? 'brief' : 'brieven'} samenvoegen in één formele printbatch?\n\n`
      + 'Er wordt een BAT-nummer uitgegeven. Er wordt nog niets als geprint of gepost gemarkeerd.',
    );
    if (!bevestigd) return;

    setBezig(true);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');
      const brieven = [...batchBrieven].sort((a, b) =>
        (a.brief.briefnummer ?? '').localeCompare(b.brief.briefnummer ?? '') || a.versie.id.localeCompare(b.versie.id));
      const versieScope = brieven.map((x) => x.versie.id).sort().join('.');
      const gestart = await startProductiekernPrintbatch({
        brieven,
        actorId: auth.data.user.id,
        datum: lokaleDatum(),
        operationScope: `bulk:${versieScope}`,
      }, writes.atomischePrintbatchRepository);
      setBatch(gestart.batch);
      setBatchBrieven(gestart.brieven);
      setPakket(bouwProductiekernBatchProductiepakket({ batch: gestart.batch, brieven: gestart.brieven }));
      toast.success(`Printbatch ${gestart.batch.batchnummer} aangemaakt (${gestart.brieven.length} brieven).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printbatch aanmaken is mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const documentenGeldig = !!batch && batch.status !== 'concept'
    && documenten.length === 4 && !documentenBezig && !documentenFout;

  return (
    <section className="rounded-md border bg-muted/20 p-3 space-y-2" data-testid="productiewerkbank-bulk-bat">
      <div>
        <p className="text-sm font-semibold">Printproductie</p>
        <p className="text-[11px] text-muted-foreground">
          Alleen definitieve BR-brieven komen hier terecht. Conceptbestanden worden nooit als formele printbron gebruikt.
        </p>
      </div>

      {herstelBezig ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Bestaande BAT controleren…
        </p>
      ) : herstelFout ? (
        <p className="text-xs text-destructive" role="alert">Printbatch geblokkeerd: {herstelFout}</p>
      ) : !batch ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs">{ids.length} definitieve {ids.length === 1 ? 'brief' : 'brieven'} gereed voor één BAT</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void maakBatch()} disabled={bezig}>
            {bezig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
            Printbatch maken ({ids.length})
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>Formele printbatch</span>
            <span className="font-mono-data font-semibold">{batch.batchnummer}</span>
          </div>
          {batch.status === 'concept' && pakket && (
            <ProductiekernProductiepakketVastleggen batch={batch} pakket={pakket} onVastgelegd={setBatch} />
          )}
          {batch.status !== 'concept' && documentenBezig && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Productiebestanden controleren…
            </p>
          )}
          {batch.status !== 'concept' && documentenFout && (
            <p className="text-xs text-destructive" role="alert">Print/post geblokkeerd: {documentenFout}</p>
          )}
          {documentenGeldig && <ProductiekernVastgelegdeDocumentenDownload documenten={documenten} />}
          {documentenGeldig && (
            <ProductiekernPrintPostBevestiging batch={batch} brieven={batchBrieven} onBatchChange={setBatch} />
          )}
          <p className="text-[11px] text-muted-foreground">
            Downloaden wijzigt geen fysieke status. Print en post worden uitsluitend na de echte fysieke handeling afzonderlijk bevestigd.
          </p>
        </div>
      )}
    </section>
  );
}
