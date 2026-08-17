import { useMemo, useState } from 'react';
import { ArchiveRestore, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { uploadProductiekernBatchArtifacts } from '@/lib/offMarket/acquisitie/productiekernBatchArtifactOpslag';
import { productiekernBrowserStorage } from '@/lib/offMarket/acquisitie/productiekernBrowserStorage';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import type { PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernProductiepakketPayload } from '@/lib/offMarket/acquisitie/productiekernProductiepakketSamenstelling';
import { registreerProductiekernBatchdocumenten } from '@/lib/offMarket/acquisitie/productiekernPrintbatch';
import { genereerProductiekernProductiepakketBestanden } from './productiekernProductiepakketBestanden';

interface Props {
  batch: PrintbatchContract;
  pakket: ProductiekernProductiepakketPayload;
  onVastgelegd: (batch: PrintbatchContract) => void;
}

/**
 * Eén expliciete gebruikersactie: render → private append-only Storage →
 * transactionele registratie. Alleen als alle vier uploads en de RPC slagen
 * wordt de BAT formeel `documenten_gegenereerd`.
 *
 * Lokale downloads zijn bewust een aparte read-only vervolgstap. Daardoor is
 * server-side productiebewijs nooit afhankelijk van browserdownloadgedrag en
 * kunnen Safari/WebKit-downloads via expliciete gebruikerslinks verlopen.
 */
export default function ProductiekernProductiepakketVastleggen({
  batch,
  pakket,
  onVastgelegd,
}: Props) {
  const [bezig, setBezig] = useState(false);
  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);

  if (!writes.activatie.schrijvenActief) return null;

  async function vastleggen() {
    if (bezig) return;
    if (batch.status !== 'concept' && batch.status !== 'documenten_gegenereerd') {
      toast.error('Deze printbatch kan geen nieuwe documentset meer krijgen.');
      return;
    }
    setBezig(true);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');

      const bestanden = await genereerProductiekernProductiepakketBestanden({
        manifest: pakket.manifest,
        voorblad: pakket.voorblad,
        controlelijst: pakket.controlelijst,
        labels: pakket.labels,
        brieven: pakket.brieven,
      });
      const attemptId = crypto.randomUUID();
      const aangemaaktOp = new Date().toISOString();
      const opgeslagenDocumenten = await uploadProductiekernBatchArtifacts({
        batch,
        actorId: auth.data.user.id,
        attemptId,
        bestanden,
        aangemaaktOp,
      }, productiekernBrowserStorage);

      await registreerProductiekernBatchdocumenten({
        batch,
        plan: {
          batchId: pakket.manifest.batchId,
          batchnummer: pakket.manifest.batchnummer,
          documentversie: pakket.manifest.documentversie,
          briefAantal: pakket.manifest.briefAantal,
          geadresseerdeAantal: pakket.labels.length,
          documenten: pakket.manifest.documentBestanden.map((bestandsnaam) => {
            const opgeslagen = opgeslagenDocumenten.find((document) =>
              String(document.metadata.bestandsnaam) === bestandsnaam);
            if (!opgeslagen) throw new Error(`Opgeslagen document ontbreekt in plan: ${bestandsnaam}.`);
            return {
              documenttype: opgeslagen.documenttype,
              bestandsnaam,
              documentversie: pakket.manifest.documentversie,
              briefVersieIds: [...pakket.manifest.briefVersieIds],
            };
          }),
          waarschuwingen: [],
        },
        opgeslagenDocumenten,
        actorId: auth.data.user.id,
        uitgevoerdOp: aangemaaktOp,
      }, writes.transactieRepository);

      onVastgelegd({ ...batch, status: 'documenten_gegenereerd' });
      toast.success(`Productiepakket ${batch.batchnummer} duurzaam vastgelegd. Downloaden is nu afzonderlijk beschikbaar.`);
    } catch (error) {
      console.error('Productiekern productiepakket vastleggen mislukt', error);
      toast.error(error instanceof Error ? error.message : 'Productiepakket vastleggen is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={() => void vastleggen()}
      disabled={bezig || !pakket.manifest.gereedVoorRender}
      data-testid="productiekern-productiepakket-vastleggen"
      title="Slaat de vier productiebestanden private en append-only op en registreert ze bij de BAT. Downloaden volgt als afzonderlijke read-only stap."
    >
      {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
      Productiepakket vastleggen
    </Button>
  );
}
