import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Loader2 } from 'lucide-react';
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
  signaalId: string;
  briefIds: readonly string[];
}

function lokaleDatum(): string {
  const d = new Date();
  const jaar = d.getFullYear();
  const maand = String(d.getMonth() + 1).padStart(2, '0');
  const dag = String(d.getDate()).padStart(2, '0');
  return `${jaar}-${maand}-${dag}`;
}

/** Volledige expliciete BAT-keten: maken → vastleggen → print bevestigen → post bevestigen. */
export default function ProductiekernPrintbatchActies({ signaalId, briefIds }: Props) {
  const [bezig, setBezig] = useState(false);
  const [herstelBezig, setHerstelBezig] = useState(true);
  const [herstelFout, setHerstelFout] = useState<string | null>(null);
  const [documentenBezig, setDocumentenBezig] = useState(false);
  const [documentenFout, setDocumentenFout] = useState<string | null>(null);
  const [pakket, setPakket] = useState<ProductiekernProductiepakketPayload | null>(null);
  const [batch, setBatch] = useState<PrintbatchContract | null>(null);
  const [batchBrieven, setBatchBrieven] = useState<ProductiekernBatchBrief[]>([]);
  const [batchDocumenten, setBatchDocumenten] = useState<BatchdocumentContract[]>([]);

  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);
  const lezen = useMemo(() => maakStandaardProductiekernBrowserLeesSamenstelling(), []);
  const ids = useMemo(() => [...new Set(briefIds)].sort(), [briefIds]);
  const idsSleutel = ids.join('|');
  const actief = writes.activatie.schrijvenActief && lezen.activatie.lezenActief && ids.length > 0;

  // Herstel eerst de canonieke BAT. Hierdoor kan refresh/navigatie nooit stil
  // leiden tot een tweede batch voor reeds gekoppelde immutable briefversies.
  useEffect(() => {
    if (!actief) {
      setHerstelBezig(false);
      return;
    }
    if (batch) {
      setHerstelBezig(false);
      return;
    }

    let geannuleerd = false;
    const herstel = async () => {
      setHerstelBezig(true);
      setHerstelFout(null);
      try {
        const versiesVoorScope: string[] = [];
        for (const briefId of ids) {
          const [brief, versies] = await Promise.all([
            lezen.repository.haalBrief(briefId),
            lezen.repository.haalBriefversies(briefId),
          ]);
          if (!brief) throw new Error(`Definitieve Productiekern-brief ${briefId} ontbreekt.`);
          if (brief.signaalId !== signaalId) throw new Error('Brief hoort bij een ander acquisitiesignaal.');
          if (brief.status !== 'definitief' || !brief.briefnummer?.trim() || !brief.actieveVersie) {
            throw new Error(`Brief ${briefId} is niet definitief of mist een actuele versie.`);
          }
          const versie = versies.find((item) =>
            item.versienummer === brief.actieveVersie
            && (item.status === 'actief' || item.status === 'verzonden'));
          if (!versie) throw new Error(`Actuele immutable versie voor ${brief.briefnummer} ontbreekt.`);
          versiesVoorScope.push(versie.id);
        }

        const bestaandBatchId = await lezen.repository.haalActievePrintbatchIdVoorBriefversies(versiesVoorScope);
        if (!bestaandBatchId) return;

        const geladen = await laadProductiekernBatch(bestaandBatchId, lezen.repository);
        const geladenBriefIds = geladen.brieven.map((item) => item.brief.id).sort();
        if (geladen.brieven.some((item) => item.brief.signaalId !== signaalId)) {
          throw new Error('Bestaande printbatch bevat een brief uit een ander acquisitiesignaal.');
        }
        if (JSON.stringify(geladenBriefIds) !== JSON.stringify(ids)) {
          throw new Error('Bestaande printbatch wijkt af van de definitieve brieven in dit dossier.');
        }

        if (geannuleerd) return;
        setBatch(geladen.batch);
        setBatchBrieven(geladen.brieven);
        if (geladen.batch.status === 'concept') {
          setPakket(bouwProductiekernBatchProductiepakket({ batch: geladen.batch, brieven: geladen.brieven }));
        }
      } catch (error) {
        if (!geannuleerd) {
          setHerstelFout(error instanceof Error ? error.message : 'Bestaande printbatch kon niet veilig worden hersteld.');
        }
      } finally {
        if (!geannuleerd) setHerstelBezig(false);
      }
    };

    void herstel();
    return () => { geannuleerd = true; };
  // idsSleutel maakt de inhoudelijke scope stabiel; ids zelf kan een nieuwe arrayreferentie krijgen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actief, batch, idsSleutel, signaalId, lezen.repository]);

  // Vanaf documenten_gegenereerd is niet een nieuwe render, maar exact de vier
  // geregistreerde private Storage-objecten het productiebewijs. Die set wordt
  // opnieuw gelezen en gevalideerd vóór fysieke print/postacties zichtbaar zijn.
  useEffect(() => {
    if (!actief || !batch || batch.status === 'concept') {
      setDocumentenBezig(false);
      setDocumentenFout(null);
      setBatchDocumenten([]);
      return;
    }

    let geannuleerd = false;
    const laadDocumenten = async () => {
      setDocumentenBezig(true);
      setDocumentenFout(null);
      try {
        const alleDocumenten = await lezen.repository.haalBatchdocumenten(batch.id);
        const actueel = bepaalActieveProductiekernBatchdocumenten({ batch, documenten: alleDocumenten });
        if (!geannuleerd) setBatchDocumenten(actueel);
      } catch (error) {
        if (!geannuleerd) {
          setBatchDocumenten([]);
          setDocumentenFout(error instanceof Error ? error.message : 'Geregistreerde BAT-documenten konden niet veilig worden hersteld.');
        }
      } finally {
        if (!geannuleerd) setDocumentenBezig(false);
      }
    };

    void laadDocumenten();
    return () => { geannuleerd = true; };
  }, [actief, batch?.id, batch?.status, batch?.documentversie, lezen.repository]);

  if (!actief) return null;

  const maakBatch = async () => {
    if (bezig || herstelBezig || herstelFout || pakket || batch) return;
    setBezig(true);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');

      const brievenVoorBatch: ProductiekernBatchBrief[] = [];
      for (const briefId of ids) {
        const [brief, versies] = await Promise.all([
          lezen.repository.haalBrief(briefId),
          lezen.repository.haalBriefversies(briefId),
        ]);
        if (!brief) throw new Error(`Definitieve Productiekern-brief ${briefId} ontbreekt.`);
        if (brief.signaalId !== signaalId) throw new Error('Brief hoort bij een ander acquisitiesignaal.');
        if (brief.status !== 'definitief' || !brief.briefnummer?.trim()) {
          throw new Error(`Brief ${briefId} is niet definitief of mist een BR-nummer.`);
        }
        const versie = versies.find((item) => item.status === 'actief' && item.versienummer === brief.actieveVersie);
        if (!versie) throw new Error(`Actieve immutable versie voor ${brief.briefnummer} ontbreekt.`);
        brievenVoorBatch.push({ brief, versie, geadresseerdeKey: `${brief.signaalId}|${versie.id}` });
      }

      brievenVoorBatch.sort((a, b) =>
        (a.brief.briefnummer ?? '').localeCompare(b.brief.briefnummer ?? '') || a.versie.id.localeCompare(b.versie.id));
      const versieScope = brievenVoorBatch.map((item) => item.versie.id).join('.');
      const gestart = await startProductiekernPrintbatch({
        brieven: brievenVoorBatch,
        actorId: auth.data.user.id,
        datum: lokaleDatum(),
        operationScope: `focus:${signaalId}:${versieScope}`,
      }, writes.atomischePrintbatchRepository);

      setBatch(gestart.batch);
      setBatchBrieven(gestart.brieven);
      setPakket(bouwProductiekernBatchProductiepakket({ batch: gestart.batch, brieven: gestart.brieven }));
      toast.success(`Printbatch ${gestart.batch.batchnummer} aangemaakt.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printbatch aanmaken is mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const documentenGeldig = !!batch && batch.status !== 'concept' && batchDocumenten.length === 4 && !documentenBezig && !documentenFout;

  return (
    <div className="rounded-md border bg-muted/20 p-2.5 space-y-2" data-testid="productiekern-printbatch-acties">
      {herstelBezig ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="productiekern-batch-herstellen">
          <Loader2 className="h-4 w-4 animate-spin" />
          Bestaande printbatch controleren…
        </div>
      ) : herstelFout ? (
        <div className="text-xs text-destructive" role="alert" data-testid="productiekern-batch-herstel-fout">
          Printbatch geblokkeerd: {herstelFout}
        </div>
      ) : !batch ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs">
            <p className="font-medium">{ids.length} definitieve {ids.length === 1 ? 'brief' : 'brieven'} klaar voor BAT</p>
            <p className="text-[11px] text-muted-foreground">BAT en alle briefversies worden in één transactie vastgelegd.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => void maakBatch()} disabled={bezig}>
            {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Printbatch maken (BAT)
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>Printbatch</span>
            <span className="font-mono-data font-semibold">{batch.batchnummer}</span>
          </div>

          {batch.status === 'concept' && pakket && (
            <ProductiekernProductiepakketVastleggen batch={batch} pakket={pakket} onVastgelegd={setBatch} />
          )}

          {batch.status !== 'concept' && documentenBezig && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="productiekern-documenten-herstellen">
              <Loader2 className="h-4 w-4 animate-spin" />
              Geregistreerde productiebestanden controleren…
            </div>
          )}

          {batch.status !== 'concept' && documentenFout && (
            <div className="text-xs text-destructive" role="alert" data-testid="productiekern-documenten-fout">
              Print/post geblokkeerd: {documentenFout}
            </div>
          )}

          {documentenGeldig && (
            <ProductiekernVastgelegdeDocumentenDownload documenten={batchDocumenten} />
          )}

          {documentenGeldig && (
            <ProductiekernPrintPostBevestiging
              batch={batch}
              brieven={batchBrieven}
              onBatchChange={setBatch}
            />
          )}

          <p className="text-[11px] text-muted-foreground">
            {batch.status === 'concept'
              ? 'Eerst worden de vier artifacts duurzaam en append-only opgeslagen; pas daarna is deze BAT printgereed.'
              : documentenGeldig
                ? 'Dit zijn exact de formeel geregistreerde Storage-bestanden. Downloaden verandert geen fysieke status; print en post vereisen afzonderlijke bevestiging.'
                : 'Fysieke print- en postbevestiging blijft gesloten totdat de formele geregistreerde documentset volledig is gevalideerd.'}
          </p>
        </div>
      )}
    </div>
  );
}
