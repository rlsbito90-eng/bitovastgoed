import { useState } from 'react';
import { ArchiveRestore, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { BatchdocumentContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import { maakProductiekernSignedDownloadUrl } from '@/lib/offMarket/acquisitie/productiekernBrowserStorage';

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
 * Maakt voor exact de reeds geregistreerde private Storage-objecten kortlevende
 * signed HTTPS-downloadroutes. De feitelijke opening/download gebeurt daarna
 * uitsluitend via expliciete links; er worden geen browser-local `blob:`-URL's
 * gebruikt en er vindt geen programmatische klik plaats.
 *
 * Deze component rendert geen nieuwe documenten en verandert geen BAT-, print-
 * of poststatus. De signed URL's verlopen automatisch.
 */
export default function ProductiekernVastgelegdeDocumentenDownload({ documenten, disabled = false }: Props) {
  const [bezig, setBezig] = useState(false);
  const [voorbereid, setVoorbereid] = useState<VoorbereidBestand[]>([]);

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
        const url = await maakProductiekernSignedDownloadUrl(pad);
        nieuw.push({
          documentId: document.id,
          documenttype: document.documenttype,
          bestandsnaam,
          url,
        });
      }

      setVoorbereid(nieuw);
      toast.success('Vier tijdelijke downloadlinks zijn klaar. Open ieder bestand afzonderlijk.');
    } catch (error) {
      setVoorbereid([]);
      toast.error(error instanceof Error ? error.message : 'Tijdelijke Productiekern-downloadlinks maken is mislukt.');
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
          title="Maakt voor de vier reeds geregistreerde private Storage-bestanden kortlevende HTTPS-downloadlinks."
        >
          {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
          Tijdelijke downloadlinks maken
        </Button>
      ) : (
        <div className="space-y-1.5" data-testid="productiekern-downloadlinks-gereed">
          <p className="text-[11px] text-muted-foreground">
            Links zijn tijdelijk geldig. Open ieder bestand afzonderlijk; dit wijzigt geen productie- of verzendstatus.
          </p>
          <div className="flex flex-wrap gap-2">
            {voorbereid.map((bestand) => (
              <a
                key={bestand.documentId}
                href={bestand.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                data-testid={`productiekern-download-${bestand.documenttype}`}
              >
                <ExternalLink className="h-4 w-4" />
                {bestand.bestandsnaam}
              </a>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void voorbereiden()}
            disabled={disabled || bezig}
            className="h-8 px-2 text-xs"
          >
            {bezig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
            Links vernieuwen
          </Button>
        </div>
      )}
    </div>
  );
}
