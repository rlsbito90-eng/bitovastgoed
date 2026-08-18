import { useEffect, useState } from 'react';
import { ArchiveRestore, Download, ExternalLink, Loader2, PackageCheck } from 'lucide-react';
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
 * Bereidt exact de vier reeds geregistreerde private Storage-objecten voor als
 * één browser-lokale ZIP. De feitelijke download blijft bewust een afzonderlijke,
 * expliciete gebruikersklik op een normale <a download>-link. Daarmee blijft de
 * bekende Safari/WebKit-grens intact: nooit programmatisch klikken nadat async
 * Storage-fetches zijn afgerond.
 *
 * Er wordt geen nieuwe BAT, documentversie of Storage-object aangemaakt en
 * voorbereiden/downloaden verandert geen print- of poststatus.
 */
export default function ProductiekernVastgelegdeDocumentenDownload({ documenten, disabled = false }: Props) {
  const [bezig, setBezig] = useState(false);
  const [voorbereid, setVoorbereid] = useState<VoorbereidBestand[]>([]);
  const [pakketUrl, setPakketUrl] = useState<string | null>(null);
  const [pakketNaam, setPakketNaam] = useState<string | null>(null);
  const [toonLosseBestanden, setToonLosseBestanden] = useState(false);

  useEffect(() => () => {
    if (pakketUrl) URL.revokeObjectURL(pakketUrl);
  }, [pakketUrl]);

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

  async function voorbereidenPakket() {
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
      if (pakketUrl) URL.revokeObjectURL(pakketUrl);
      setPakketUrl(URL.createObjectURL(zip));
      setPakketNaam(pakketBestandsnaam(documenten, nieuw));
      toast.success('Productiepakket is klaar. Download het nu als één ZIP-bestand.');
    } catch (error) {
      setPakketUrl(null);
      setPakketNaam(null);
      toast.error(error instanceof Error ? error.message : 'Productiepakket voorbereiden is mislukt.');
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
        {pakketUrl && pakketNaam ? (
          <a
            href={pakketUrl}
            download={pakketNaam}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
            data-testid="productiekern-productiebestanden-downloaden"
          >
            <Download className="h-4 w-4" />
            Productiebestanden downloaden (4)
          </a>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void voorbereidenPakket()}
            disabled={disabled || bezig || documenten.length !== 4}
            title="Bereid de vier reeds geregistreerde BAT-productiebestanden voor als één ZIP."
            data-testid="productiekern-productiebestanden-voorbereiden"
          >
            {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Productiepakket voorbereiden
          </Button>
        )}
        {pakketUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void voorbereidenPakket()}
            disabled={disabled || bezig}
            className="h-8 px-2 text-xs"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            Pakket vernieuwen
          </Button>
        )}
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
        De vier bestaande BAT-bestanden worden één pakket. De uiteindelijke download is een expliciete klik en wijzigt geen print- of verzendstatus.
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
