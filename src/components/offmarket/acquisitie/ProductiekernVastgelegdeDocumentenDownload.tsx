import { useEffect, useState } from 'react';
import { ArchiveRestore, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { BatchdocumentContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import { downloadProductiekernStorageObject } from '@/lib/offMarket/acquisitie/productiekernBrowserStorage';

interface Props {
  documenten: readonly BatchdocumentContract[];
  disabled?: boolean;
}

interface VoorbereidBestand {
  documentId: string;
  documenttype: string;
  bestandsnaam: string;
  url: string;
}

function metadataTekst(document: BatchdocumentContract, sleutel: string): string {
  const waarde = document.metadata[sleutel];
  if (typeof waarde !== 'string' || !waarde.trim()) throw new Error(`Batchdocument mist metadata ${sleutel}.`);
  return waarde.trim();
}

/**
 * Bereidt exact de reeds geregistreerde private Storage-objecten voor als
 * browser-object-URL's. De feitelijke download gebeurt daarna uitsluitend via
 * expliciete <a download>-links, zodat Safari/WebKit iedere download als een
 * afzonderlijke gebruikershandeling kan behandelen.
 *
 * Deze component rendert geen nieuwe documenten en verandert geen BAT-, print-
 * of poststatus.
 */
export default function ProductiekernVastgelegdeDocumentenDownload({ documenten, disabled = false }: Props) {
  const [bezig, setBezig] = useState(false);
  const [voorbereid, setVoorbereid] = useState<VoorbereidBestand[]>([]);

  useEffect(() => {
    return () => {
      for (const bestand of voorbereid) URL.revokeObjectURL(bestand.url);
    };
  }, [voorbereid]);

  async function voorbereiden() {
    if (disabled || bezig) return;
    if (documenten.length !== 4) {
      toast.error('De formele documentset is niet volledig.');
      return;
    }

    setBezig(true);
    try {
      const nieuw: VoorbereidBestand[] = [];
      for (const document of documenten) {
        const pad = metadataTekst(document, 'pad');
        const bestandsnaam = metadataTekst(document, 'bestandsnaam');
        const blob = await downloadProductiekernStorageObject(pad);
        nieuw.push({
          documentId: document.id,
          documenttype: document.documenttype,
          bestandsnaam,
          url: URL.createObjectURL(blob),
        });
      }

      setVoorbereid((vorig) => {
        for (const bestand of vorig) URL.revokeObjectURL(bestand.url);
        return nieuw;
      });
      toast.success('De vier geregistreerde productiebestanden zijn voorbereid. Download ze hieronder afzonderlijk.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Geregistreerde productiebestanden voorbereiden is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="productiekern-vastgelegde-documenten-download">
      {voorbereid.length !== 4 ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void voorbereiden()}
          disabled={disabled || bezig || documenten.length !== 4}
          title="Haalt de vier reeds formeel geregistreerde bestanden read-only uit private Storage en maakt expliciete downloadlinks klaar."
        >
          {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
          Geregistreerde bestanden voorbereiden
        </Button>
      ) : (
        <div className="space-y-1.5" data-testid="productiekern-downloadlinks-gereed">
          <p className="text-[11px] text-muted-foreground">
            Bestanden voorbereid. Download ieder bestand afzonderlijk; dit wijzigt geen productie- of verzendstatus.
          </p>
          <div className="flex flex-wrap gap-2">
            {voorbereid.map((bestand) => (
              <a
                key={bestand.documentId}
                href={bestand.url}
                download={bestand.bestandsnaam}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                data-testid={`productiekern-download-${bestand.documenttype}`}
              >
                <Download className="h-4 w-4" />
                {bestand.bestandsnaam}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
