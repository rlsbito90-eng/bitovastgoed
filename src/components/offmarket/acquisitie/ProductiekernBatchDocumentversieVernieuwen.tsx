import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { uploadProductiekernBatchArtifacts } from '@/lib/offMarket/acquisitie/productiekernBatchArtifactOpslag';
import { laadProductiekernBatch } from '@/lib/offMarket/acquisitie/productiekernBatchLezer';
import { bouwProductiekernBatchProductiepakket } from '@/lib/offMarket/acquisitie/productiekernBatchProductiepakket';
import { productiekernBrowserStorage } from '@/lib/offMarket/acquisitie/productiekernBrowserStorage';
import type { PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import { vernieuwProductiekernBatchdocumenten } from '@/lib/offMarket/acquisitie/productiekernPrintbatch';
import type { AcquisitieProductiekernRepository } from '@/lib/offMarket/acquisitie/productiekernRepository';
import { genereerProductiekernProductiepakketBestanden } from './productiekernProductiepakketBestanden';

interface Props {
  batch: PrintbatchContract;
  repository: AcquisitieProductiekernRepository;
}

const VERNIEUWINGSREDEN = 'Huisstijl- en kwaliteitsherstel van de geregistreerde productiebestanden.';

/**
 * Maakt voor een nog niet geprinte BAT één nieuwe append-only documentversie.
 * De oude documenten blijven vervallen historie; BR, BAT en briefversies wijzigen niet.
 */
export default function ProductiekernBatchDocumentversieVernieuwen({
  batch,
  repository,
}: Props) {
  const [bezig, setBezig] = useState(false);
  const queryClient = useQueryClient();
  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);

  if (!writes.activatie.schrijvenActief) return null;
  if (batch.status !== 'documenten_gegenereerd' || batch.printdatum) return null;

  async function vernieuwen() {
    if (bezig) return;
    setBezig(true);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user?.id) {
        throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');
      }

      const geladen = await laadProductiekernBatch(batch.id, repository);
      if (geladen.batch.status !== 'documenten_gegenereerd' || geladen.batch.printdatum) {
        throw new Error('Deze printbatch is intussen gewijzigd en kan niet meer worden vernieuwd.');
      }
      if (geladen.batch.documentversie !== batch.documentversie) {
        throw new Error('Er bestaat inmiddels al een nieuwere documentversie. Ververs het overzicht.');
      }

      const volgendeBatch: PrintbatchContract = {
        ...geladen.batch,
        documentversie: geladen.batch.documentversie + 1,
      };
      const pakket = bouwProductiekernBatchProductiepakket({
        batch: volgendeBatch,
        brieven: geladen.brieven,
      });
      const bestanden = await genereerProductiekernProductiepakketBestanden({
        manifest: pakket.manifest,
        voorblad: pakket.voorblad,
        controlelijst: pakket.controlelijst,
        labels: pakket.labels,
        brieven: pakket.brieven,
      });

      const aangemaaktOp = new Date().toISOString();
      const opgeslagenDocumenten = await uploadProductiekernBatchArtifacts({
        batch: volgendeBatch,
        actorId: auth.data.user.id,
        attemptId: crypto.randomUUID(),
        bestanden,
        aangemaaktOp,
      }, productiekernBrowserStorage);

      await vernieuwProductiekernBatchdocumenten({
        batch: geladen.batch,
        plan: {
          batchId: pakket.manifest.batchId,
          batchnummer: pakket.manifest.batchnummer,
          documentversie: pakket.manifest.documentversie,
          briefAantal: pakket.manifest.briefAantal,
          geadresseerdeAantal: pakket.labels.length,
          documenten: pakket.manifest.documentBestanden.map((bestandsnaam) => {
            const opgeslagen = opgeslagenDocumenten.find((document) =>
              String(document.metadata.bestandsnaam) === bestandsnaam);
            if (!opgeslagen) {
              throw new Error(`Opgeslagen document ontbreekt in vernieuwingsplan: ${bestandsnaam}.`);
            }
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
        reden: VERNIEUWINGSREDEN,
        uitgevoerdOp: aangemaaktOp,
      }, writes.transactieRepository);

      await queryClient.invalidateQueries({
        queryKey: ['off-market-acquisitie-productiekern'],
      });
      toast.success(`${batch.batchnummer} is vernieuwd naar documentversie ${volgendeBatch.documentversie}.`, {
        description: 'De eerdere versie blijft bewaard; de nieuwe kleurversie is nu de actieve printbron.',
      });
    } catch (error) {
      console.error('Productiekern documentversie vernieuwen mislukt', error);
      toast.error(error instanceof Error ? error.message : 'Nieuwe documentversie maken is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bezig}
          data-testid="productiekern-documentversie-vernieuwen-openen"
        >
          {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
          Nieuwe documentversie maken
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nieuwe productiebestanden in kleur maken?</AlertDialogTitle>
          <AlertDialogDescription>
            {batch.batchnummer} blijft dezelfde batch. Documentversie {batch.documentversie} blijft
            bewaard als historie en documentversie {batch.documentversie + 1} wordt de nieuwe actieve
            printbron. Er wordt niets als geprint of gepost gemarkeerd.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={bezig}
            onClick={() => void vernieuwen()}
            data-testid="productiekern-documentversie-vernieuwen-bevestigen"
          >
            Maak documentversie {batch.documentversie + 1}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
