import { useState } from 'react';
import { ArchiveRestore, Download, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { maakProductiekernSignedDownloadUrl } from '@/lib/offMarket/acquisitie/productiekernBrowserStorage';
import type { BatchdocumentContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import { bouwProductiekernZip } from '@/lib/offMarket/acquisitie/productiekernZip';

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

function pakketBestandsnaam(documenten: readonly BatchdocumentContract[], bestanden: readonly VoorbereidBestand[]): string {
  const batchnummer = bestanden[0]?.bestandsnaam.match(/^(BAT\d+)/)?.[1] ?? 'BAT-productie';
  const versie = documenten[0]?.documentversie ?? 1;
  return `${batchnummer}-v${versie}-productiebestanden.zip`;
}

/**
 * Downloadt exact de vier reeds geregistreerde private Storage-objecten als één
 * browser-lokale ZIP. Er wordt geen nieuwe BAT, documentversie of Storage-object
 * aangemaakt. Downloaden verandert evenmin print- of poststatus.
 *
 * Losse tijdelijke links blijven alleen als secundaire herstelroute beschikbaar.
 */
export default function ProductiekernVastgelegdeDocumentenDownload({ documenten, disabled = false }: Props) {
  const [bezig, setBezig] = useState(false);
  const [voorbereid, setVoorbereid] = useState<VoorbereidBestand[]>([]);
  const [toonLosseBestanden, setToonLosseBestanden] = useState(false);

  async function maakSignedBestanden(): Promise<VoorbereidBestand[]> {
    if (documenten.length !== 4) throw new Error('De formele documentset is niet volledig.');
    const documenttypen = new Set(documenten.map((document) => document.documenttype));
    if (documenttypen.size !== 4) throw new Error('De formele documentset bevat dubbele documenttypen.');

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
    return nieuw;
  }

  async function downloadPakket() {
    if (disabled || bezig) return;
    setBezig(true);
    try {
      const nieuw = await maakSignedBestanden();
      setVoorbereid(nieuw);

      const zipBestanden = await Promise.all(nieuw.map(async (bestand) => {
        const response = await fetch(bestand.url);
        if (!response.ok) throw new Error(`Download van ${bestand.bestandsnaam} is mislukt.`);
        return {
          naam: bestand.bestandsnaam,
          bytes: new Uint8Array(await response.arrayBuffer()),
        };
      }));

      const zip = bouwProductiekernZip(zipBestanden);
      const url = URL.createObjectURL(zip);
      const link = document.createElement('a');
      link.href = url;
      link.download = pakketBestandsnaam(documenten, nieuw);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Safari kan de blob-URL nog kort na de synthetische klik nodig hebben.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('Productiebestanden als één ZIP gedownload. De fysieke status is niet gewijzigd.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Productiebestanden downloaden is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  async function toonOfVernieuwLosseBestanden() {
    if (disabled || bezig) return;
    if (voorbereid.length === 4) {
      setToonLosseBestanden((waarde) => !waarde);
      return;
    }
    setBezig(true);
    try {
      const nieuw = await maakSignedBestanden();
      setVoorbereid(nieuw);
      setToonLosseBestanden(true);
    } catch (error) {
      setVoorbereid([]);
      toast.error(error instanceof Error ? error.message : 'Tijdelijke downloadlinks maken is mislukt.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="productiekern-vastgelegde-documenten-download">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void downloadPakket()}
          disabled={disabled || bezig || documenten.length !== 4}
          title="Download de vier reeds geregistreerde BAT-productiebestanden samen als één ZIP."
          data-testid="productiekern-productiebestanden-downloaden"
        >
          {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Productiebestanden downloaden (4)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void toonOfVernieuwLosseBestanden()}
          disabled={disabled || bezig || documenten.length !== 4}
          className="h-8 px-2 text-xs"
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
          {toonLosseBestanden ? 'Losse bestanden verbergen' : 'Losse bestanden'}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Eén pakketdownload van de bestaande BAT-bestanden. Downloaden wijzigt geen print- of verzendstatus.
      </p>

      {toonLosseBestanden && voorbereid.length === 4 && (
        <div className="space-y-1.5 rounded-md border bg-muted/20 p-2" data-testid="productiekern-downloadlinks-gereed">
          <p className="text-[11px] text-muted-foreground">
            Secundaire herstelroute: tijdelijke links naar de vier losse geregistreerde bestanden.
          </p>
          <div className="flex flex-wrap gap-2">
            {voorbereid.map((bestand) => (
              <a
                key={bestand.documentId}
                href={bestand.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                data-testid={`productiekern-download-${bestand.documenttype}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {bestand.bestandsnaam}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
