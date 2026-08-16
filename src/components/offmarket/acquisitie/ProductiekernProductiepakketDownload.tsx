import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { BatchAdreslabelRij } from '@/lib/offMarket/acquisitie/batchAdreslabelRijen';
import type { BatchControlelijst } from '@/lib/offMarket/acquisitie/batchControlelijst';
import type { BatchProductiepakketManifest } from '@/lib/offMarket/acquisitie/batchProductiepakket';
import type { BatchVoorbladModel } from '@/lib/offMarket/acquisitie/batchVoorblad';
import type { BriefRenderInvoer } from '@/lib/offMarket/acquisitie/briefRenderInvoer';
import {
  downloadProductiekernBestand,
  genereerProductiekernProductiepakketBestanden,
} from './productiekernProductiepakketBestanden';

interface Props {
  manifest: BatchProductiepakketManifest;
  voorblad: BatchVoorbladModel;
  controlelijst: BatchControlelijst;
  labels: readonly BatchAdreslabelRij[];
  brieven: readonly BriefRenderInvoer[];
  disabled?: boolean;
}

/**
 * Genereert het volledige productiepakket uitsluitend lokaal in de browser.
 * Geen database-, Storage-, print-, post- of auditmutaties.
 */
export default function ProductiekernProductiepakketDownload({
  manifest,
  voorblad,
  controlelijst,
  labels,
  brieven,
  disabled = false,
}: Props) {
  const [bezig, setBezig] = useState(false);

  async function download() {
    if (disabled || bezig) return;
    if (!manifest.gereedVoorRender) {
      toast.error('Productiepakket is niet rendergereed.', {
        description: manifest.blokkades.join(' '),
      });
      return;
    }

    setBezig(true);
    try {
      const bestanden = await genereerProductiekernProductiepakketBestanden({
        manifest,
        voorblad,
        controlelijst,
        labels,
        brieven,
      });
      for (const bestand of bestanden) downloadProductiekernBestand(bestand);
      toast.success(`Productiepakket ${manifest.batchnummer} gegenereerd (4 bestanden).`);
    } catch (error) {
      console.error('Productiekern productiepakket genereren mislukt', error);
      toast.error(error instanceof Error
        ? error.message
        : 'Productiekern productiepakket genereren mislukt.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={download}
      disabled={disabled || bezig || !manifest.gereedVoorRender}
      data-testid="productiekern-productiepakket-download"
      title="Genereert vier lokale productiebestanden; registreert niets als geprint of gepost."
    >
      {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Productiepakket downloaden
    </Button>
  );
}
