import { useState } from 'react';
import { ArchiveRestore, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { BatchdocumentContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import { downloadProductiekernStorageObject } from '@/lib/offMarket/acquisitie/productiekernBrowserStorage';

interface Props {
  documenten: readonly BatchdocumentContract[];
  disabled?: boolean;
}

function metadataTekst(document: BatchdocumentContract, sleutel: string): string {
  const waarde = document.metadata[sleutel];
  if (typeof waarde !== 'string' || !waarde.trim()) throw new Error(`Batchdocument mist metadata ${sleutel}.`);
  return waarde.trim();
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

/**
 * Downloadt exact de reeds geregistreerde private Storage-objecten. Deze knop
 * rendert geen nieuwe documenten en verandert geen BAT-, print- of poststatus.
 */
export default function ProductiekernVastgelegdeDocumentenDownload({ documenten, disabled = false }: Props) {
  const [bezig, setBezig] = useState(false);

  async function download() {
    if (disabled || bezig) return;
    if (documenten.length !== 4) {
      toast.error('De formele documentset is niet volledig.');
      return;
    }

    setBezig(true);
    try {
      // Bewust sequentieel: de gebruiker krijgt dezelfde vaste documentvolgorde
      // als de gevalideerde set en een Storage-fout stopt verdere downloads.
      for (const document of documenten) {
        const pad = metadataTekst(document, 'pad');
        const bestandsnaam = metadataTekst(document, 'bestandsnaam');
        const blob = await downloadProductiekernStorageObject(pad);
        downloadBlob(blob, bestandsnaam);
      }
      toast.success('De vier geregistreerde productiebestanden zijn gedownload.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Geregistreerde productiebestanden downloaden is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => void download()}
      disabled={disabled || bezig || documenten.length !== 4}
      data-testid="productiekern-vastgelegde-documenten-download"
      title="Downloadt de vier reeds formeel geregistreerde bestanden uit private Storage; rendert niets opnieuw."
    >
      {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
      Geregistreerde bestanden downloaden
    </Button>
  );
}
