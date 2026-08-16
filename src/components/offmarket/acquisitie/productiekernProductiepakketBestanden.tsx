import { pdf } from '@react-pdf/renderer';

import type { BatchAdreslabelRij } from '@/lib/offMarket/acquisitie/batchAdreslabelRijen';
import { serializeerBatchAdreslabelsCsv } from '@/lib/offMarket/acquisitie/batchAdreslabelsCsv';
import type { BatchControlelijst } from '@/lib/offMarket/acquisitie/batchControlelijst';
import type { BatchProductiepakketManifest } from '@/lib/offMarket/acquisitie/batchProductiepakket';
import type { BatchVoorbladModel } from '@/lib/offMarket/acquisitie/batchVoorblad';
import type { BriefRenderInvoer } from '@/lib/offMarket/acquisitie/briefRenderInvoer';
import type { Batchdocumenttype } from '@/lib/offMarket/acquisitie/productiekernContract';

import ProductiekernBrievenPDF from './ProductiekernBrievenPDF';
import {
  ProductiekernBatchControlelijstPDF,
  ProductiekernBatchVoorbladPDF,
} from './ProductiekernBatchDocumenten';

export interface ProductiekernGegenereerdBestand {
  documenttype: Batchdocumenttype;
  bestandsnaam: string;
  blob: Blob;
  mimeType: 'application/pdf' | 'text/csv';
}

function vindBestandsnaam(manifest: BatchProductiepakketManifest, suffix: string): string {
  const gevonden = manifest.documentBestanden.find((naam) => naam.endsWith(suffix));
  if (!gevonden) throw new Error(`Productiepakket mist bestand ${suffix}.`);
  return gevonden;
}

/**
 * Rendert exact de vier bestanden uit één gevalideerd Productiekern-manifest.
 * Pure browserhandeling: geen download, Storage, database, print of poststatus.
 */
export async function genereerProductiekernProductiepakketBestanden(input: {
  manifest: BatchProductiepakketManifest;
  voorblad: BatchVoorbladModel;
  controlelijst: BatchControlelijst;
  labels: readonly BatchAdreslabelRij[];
  brieven: readonly BriefRenderInvoer[];
}): Promise<ProductiekernGegenereerdBestand[]> {
  if (!input.manifest.gereedVoorRender) {
    throw new Error(`Productiepakket is niet rendergereed. ${input.manifest.blokkades.join(' ')}`.trim());
  }

  const [voorbladBlob, controleBlob, brievenBlob] = await Promise.all([
    pdf(<ProductiekernBatchVoorbladPDF model={input.voorblad} />).toBlob(),
    pdf(<ProductiekernBatchControlelijstPDF lijst={input.controlelijst} />).toBlob(),
    pdf(<ProductiekernBrievenPDF brieven={input.brieven} />).toBlob(),
  ]);
  const labelsCsv = serializeerBatchAdreslabelsCsv(input.labels);
  const labelsBlob = new Blob([labelsCsv], { type: 'text/csv;charset=utf-8' });

  const bestanden: ProductiekernGegenereerdBestand[] = [
    {
      documenttype: 'batchvoorblad',
      bestandsnaam: vindBestandsnaam(input.manifest, '-voorblad.pdf'),
      blob: voorbladBlob,
      mimeType: 'application/pdf',
    },
    {
      documenttype: 'controlelijst',
      bestandsnaam: vindBestandsnaam(input.manifest, '-controlelijst.pdf'),
      blob: controleBlob,
      mimeType: 'application/pdf',
    },
    {
      documenttype: 'brieven_pdf',
      bestandsnaam: vindBestandsnaam(input.manifest, '-brieven.pdf'),
      blob: brievenBlob,
      mimeType: 'application/pdf',
    },
    {
      documenttype: 'adreslabels',
      bestandsnaam: vindBestandsnaam(input.manifest, '-adreslabels.csv'),
      blob: labelsBlob,
      mimeType: 'text/csv',
    },
  ];

  if (new Set(bestanden.map((bestand) => bestand.documenttype)).size !== 4) {
    throw new Error('Productiepakket bevat niet exact vier unieke documenttypen.');
  }
  if (new Set(bestanden.map((bestand) => bestand.bestandsnaam)).size !== 4) {
    throw new Error('Productiepakket bevat dubbele bestandsnamen.');
  }
  return bestanden;
}

export function downloadProductiekernBestand(bestand: ProductiekernGegenereerdBestand): void {
  const url = URL.createObjectURL(bestand.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = bestand.bestandsnaam;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
