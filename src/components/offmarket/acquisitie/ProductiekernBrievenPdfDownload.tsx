import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { BriefRenderInvoer } from '@/lib/offMarket/acquisitie/briefRenderInvoer';

import ProductiekernBrievenPDF from './ProductiekernBrievenPDF';

interface ProductiekernBrievenPdfDownloadProps {
  brieven: readonly BriefRenderInvoer[];
  bestandsnaam: string;
  disabled?: boolean;
}

/**
 * Eerste concrete frontend-uitvoer voor de acquisitieproductiekern.
 * Downloadt alleen een lokaal opgebouwde PDF uit immutable renderpayloads.
 * Er vindt expliciet geen database-, Storage-, print- of postregistratie plaats.
 */
export default function ProductiekernBrievenPdfDownload({
  brieven,
  bestandsnaam,
  disabled = false,
}: ProductiekernBrievenPdfDownloadProps) {
  const [bezig, setBezig] = useState(false);

  async function download() {
    if (brieven.length === 0 || bezig || disabled) return;

    setBezig(true);
    try {
      const blob = await pdf(
        <ProductiekernBrievenPDF brieven={brieven} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = bestandsnaam;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`PDF gegenereerd (${brieven.length} brieven).`);
    } catch (error) {
      console.error('Productiekern PDF genereren mislukt', error);
      toast.error('Productiekern PDF genereren mislukt.');
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
      disabled={disabled || bezig || brieven.length === 0}
      data-testid="productiekern-brieven-pdf-download"
      title="Genereert uitsluitend lokaal een PDF; registreert nog niets als geprint of gepost."
    >
      {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Productiekern PDF
    </Button>
  );
}
