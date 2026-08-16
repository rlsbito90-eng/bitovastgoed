import { useMemo, useState } from 'react';
import { PackageCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { bouwProductiekernBatchProductiepakket } from '@/lib/offMarket/acquisitie/productiekernBatchProductiepakket';
import type { PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernProductiepakketPayload } from '@/lib/offMarket/acquisitie/productiekernProductiepakketSamenstelling';
import { startProductiekernPrintbatch, type ProductiekernBatchBrief } from '@/lib/offMarket/acquisitie/productiekernPrintbatch';
import ProductiekernPrintPostBevestiging from './ProductiekernPrintPostBevestiging';
import ProductiekernProductiepakketDownload from './ProductiekernProductiepakketDownload';
import ProductiekernProductiepakketVastleggen from './ProductiekernProductiepakketVastleggen';

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
  const [pakket, setPakket] = useState<ProductiekernProductiepakketPayload | null>(null);
  const [batch, setBatch] = useState<PrintbatchContract | null>(null);
  const [batchBrieven, setBatchBrieven] = useState<ProductiekernBatchBrief[]>([]);

  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);
  const lezen = useMemo(() => maakStandaardProductiekernBrowserLeesSamenstelling(), []);
  const ids = useMemo(() => [...new Set(briefIds)].sort(), [briefIds]);

  if (!writes.activatie.schrijvenActief || !lezen.activatie.lezenActief || ids.length === 0) return null;

  const maakBatch = async () => {
    if (bezig || pakket || batch) return;
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

  return (
    <div className="rounded-md border bg-muted/20 p-2.5 space-y-2" data-testid="productiekern-printbatch-acties">
      {!pakket || !batch ? (
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
            <span className="font-mono-data font-semibold">{pakket.manifest.batchnummer}</span>
          </div>

          {batch.status === 'concept' ? (
            <ProductiekernProductiepakketVastleggen batch={batch} pakket={pakket} onVastgelegd={setBatch} />
          ) : (
            <ProductiekernProductiepakketDownload
              manifest={pakket.manifest}
              voorblad={pakket.voorblad}
              controlelijst={pakket.controlelijst}
              labels={pakket.labels}
              brieven={pakket.brieven}
            />
          )}

          {batch.status !== 'concept' && (
            <ProductiekernPrintPostBevestiging
              batch={batch}
              brieven={batchBrieven}
              onBatchChange={setBatch}
            />
          )}

          <p className="text-[11px] text-muted-foreground">
            {batch.status === 'concept'
              ? 'Eerst worden de vier artifacts duurzaam en append-only opgeslagen; pas daarna is deze BAT printgereed.'
              : 'Downloaden verandert geen fysieke status. Print en post worden uitsluitend via de afzonderlijke bevestigingen geregistreerd.'}
          </p>
        </div>
      )}
    </div>
  );
}
