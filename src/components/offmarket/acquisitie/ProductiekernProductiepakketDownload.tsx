import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { BatchAdreslabelRij } from '@/lib/offMarket/acquisitie/batchAdreslabelRijen';
import { serializeerBatchAdreslabelsCsv } from '@/lib/offMarket/acquisitie/batchAdreslabelsCsv';
import type { BatchControlelijst } from '@/lib/offMarket/acquisitie/batchControlelijst';
import type { BatchProductiepakketManifest } from '@/lib/offMarket/acquisitie/batchProductiepakket';
import type { BatchVoorbladModel } from '@/lib/offMarket/acquisitie/batchVoorblad';
import type { BriefRenderInvoer } from '@/lib/offMarket/acquisitie/briefRenderInvoer';

import ProductiekernBrievenPDF from './ProductiekernBrievenPDF';
import {
  ProductiekernBatchControlelijstPDF,
  ProductiekernBatchVoorbladPDF,
} from './ProductiekernBatchDocumenten';

interface Props {
  manifest: BatchProductiepakketManifest;
  voorblad: BatchVoorbladModel;
  controlelijst: BatchControlelijst;
  labels: readonly BatchAdreslabelRij[];
  brieven: readonly BriefRenderInvoer[];
  disabled?: boolean;
}

function downloadBlob(blob: Blob, bestandsnaam: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = bestandsnaam;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function vindBestandsnaam(manifest: BatchProductiepakketManifest, suffix: string): string {
  const gevonden = manifest.documentBestanden.find((naam) => naam.endsWith(suffix));
  if (!gevonden) throw new Error(`Productiepakket mist bestand ${suffix}.`);
  return gevonden;
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
      const [voorbladBlob, controleBlob, brievenBlob] = await Promise.all([
        pdf(<ProductiekernBatchVoorbladPDF model={voorblad} />).toBlob(),
        pdf(<ProductiekernBatchControlelijstPDF lijst={controlelijst} />).toBlob(),
        pdf(<ProductiekernBrievenPDF brieven={brieven} />).toBlob(),
      ]);
      const labelsCsv = serializeerBatchAdreslabelsCsv(labels);
      const labelsBlob = new Blob([labelsCsv], { type: 'text/csv;charset=utf-8' });

      downloadBlob(voorbladBlob, vindBestandsnaam(manifest, '-voorblad.pdf'));
      downloadBlob(controleBlob, vindBestandsnaam(manifest, '-controlelijst.pdf'));
      downloadBlob(brievenBlob, vindBestandsnaam(manifest, '-brieven.pdf'));
      downloadBlob(labelsBlob, vindBestandsnaam(manifest, '-adreslabels.csv'));

      toast.success(`Productiepakket ${manifest.batchnummer} gegenereerd (4 bestanden).`);
    } catch (error) {
      console.error('Productiekern productiepakket genereren mislukt', error);
      toast.error('Productiekern productiepakket genereren mislukt.');
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
