import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

import GeadresseerdenLijst from './GeadresseerdenLijst';
import SelecteerbareDossierRij from './SelecteerbareDossierRij';

interface GeadresseerdeVoorDossierRij {
  key: string;
  naam?: string | null;
  bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  volledigPostadres: boolean;
}

interface AcquisitieDossierRijProps {
  geselecteerd: boolean;
  onToggle: () => void;
  signaalId: string;
  fase: string;
  werkbak: string;
  actieCategorie?: string | null;
  geadresseerden: GeadresseerdeVoorDossierRij[];
  hoofdinhoud: ReactNode;
  acties: ReactNode;
}

interface ProductieIdentiteit {
  briefnummers: string[];
  batchnummers: string[];
}

function tekstUitNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!isValidElement(node)) return '';
  return Children.toArray((node as ReactElement<any>).props.children)
    .map(tekstUitNode)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function verzamelProductieIdentiteit(node: ReactNode, resultaat: ProductieIdentiteit): void {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<any>;
    const testId = element.props['data-testid'];
    if (testId === 'acquisitie-rij-briefnummer') {
      const nummer = tekstUitNode(element);
      if (nummer && !resultaat.briefnummers.includes(nummer)) resultaat.briefnummers.push(nummer);
      return;
    }
    if (testId === 'acquisitie-rij-batchnummer') {
      const nummer = tekstUitNode(element);
      if (nummer && !resultaat.batchnummers.includes(nummer)) resultaat.batchnummers.push(nummer);
      return;
    }
    verzamelProductieIdentiteit(element.props.children, resultaat);
  });
}

function eigenaarLabel(geadresseerden: GeadresseerdeVoorDossierRij[]): string | null {
  const eerste = geadresseerden[0];
  if (!eerste) return null;
  return eerste.bedrijfsnaam?.trim() || eerste.naam?.trim() || null;
}

function isOpvolgingsActie(werkbak: string, actieCategorie?: string | null): boolean {
  return werkbak === 'actie' && Boolean(actieCategorie?.startsWith('opvolging_'));
}

/**
 * Volledige presentatielaag voor één dossier in de acquisitieselectie.
 *
 * Opvolging is bewust actiegericht: BR/BAT-identiteit en de volledige
 * geadresseerdenkaart blijven beschikbaar, maar staan secundair en inklapbaar.
 * Andere werkbakken behouden de bestaande presentatie ongewijzigd.
 *
 * Belangrijk: de bestaande hoofdinhoud wordt niet gekloond of herschreven.
 * Alleen de visuele zichtbaarheid van secundaire badges verandert in Opvolgen.
 * Zo blijven de bestaande React Query-/dropdowncomponenten exact dezelfde boom
 * houden als in de overige werkbakken.
 */
export default function AcquisitieDossierRij({
  geselecteerd,
  onToggle,
  signaalId,
  fase,
  werkbak,
  actieCategorie,
  geadresseerden,
  hoofdinhoud,
  acties,
}: AcquisitieDossierRijProps) {
  const opvolging = isOpvolgingsActie(werkbak, actieCategorie);
  const productie: ProductieIdentiteit = { briefnummers: [], batchnummers: [] };
  if (opvolging) verzamelProductieIdentiteit(hoofdinhoud, productie);

  const eigenaar = eigenaarLabel(geadresseerden);
  const meerdereGeadresseerden = geadresseerden.length > 1;
  const briefSamenvatting = productie.briefnummers.length > 1
    ? `${productie.briefnummers.length} brieven verzonden`
    : productie.briefnummers.length === 1
      ? 'Brief verstuurd'
      : fase === 'email_verzonden'
        ? 'E-mail verzonden'
        : 'Benadering geregistreerd';

  const verbergFormeleBriefstatus = opvolging && productie.briefnummers.length > 0;
  const hoofdinhoudClass = opvolging
    ? [
        "[&_[data-testid='acquisitie-rij-briefnummer']]:hidden",
        "[&_[data-testid='acquisitie-rij-batchnummer']]:hidden",
        verbergFormeleBriefstatus ? "[&_[data-testid='acquisitie-rij-briefstatus']]:hidden" : '',
      ].filter(Boolean).join(' ')
    : '';

  return (
    <SelecteerbareDossierRij
      geselecteerd={geselecteerd}
      onToggle={onToggle}
      signaalId={signaalId}
      fase={fase}
      werkbak={werkbak}
      actieCategorie={actieCategorie}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className={hoofdinhoudClass}>{hoofdinhoud}</div>

          {opvolging ? (
            <div className="mt-2 space-y-2" data-testid="acquisitie-opvolgen-compact">
              <div
                className="rounded-md border border-border/70 bg-muted/15 px-2.5 py-2 text-[11px]"
                data-testid="acquisitie-opvolgen-samenvatting"
              >
                {eigenaar && (
                  <p className="font-medium text-foreground break-words">
                    {eigenaar}
                    {meerdereGeadresseerden ? ` · +${geadresseerden.length - 1} geadresseerde${geadresseerden.length - 1 === 1 ? '' : 'n'}` : ''}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                  <span className="font-medium text-foreground">{briefSamenvatting}</span>
                  {productie.briefnummers.length > 0 && (
                    <span>{productie.briefnummers.length} BR</span>
                  )}
                  {productie.batchnummers.length > 0 && (
                    <span>{productie.batchnummers.length} {productie.batchnummers.length === 1 ? 'batch' : 'batches'}</span>
                  )}
                </div>
              </div>

              {(productie.briefnummers.length > 0 || productie.batchnummers.length > 0) && (
                <details
                  className="group rounded-md border border-border/70 bg-background"
                  data-testid="acquisitie-opvolgen-brief-verzending"
                  data-no-row-select="true"
                >
                  <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-foreground marker:hidden">
                    Brief &amp; verzending
                    <span className="ml-1 text-muted-foreground group-open:hidden">›</span>
                    <span className="ml-1 hidden text-muted-foreground group-open:inline">⌄</span>
                  </summary>
                  <div className="border-t border-border/60 px-2.5 py-2 text-[10px] text-muted-foreground">
                    {productie.briefnummers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5" data-testid="acquisitie-opvolgen-briefnummers">
                        <span className="mr-1 font-medium text-foreground">Brief:</span>
                        {productie.briefnummers.map((nummer) => (
                          <span key={nummer} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono-data">
                            {nummer}
                          </span>
                        ))}
                      </div>
                    )}
                    {productie.batchnummers.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="acquisitie-opvolgen-batchnummers">
                        <span className="mr-1 font-medium text-foreground">Batch:</span>
                        {productie.batchnummers.map((nummer) => (
                          <span key={nummer} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono-data">
                            {nummer}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 leading-relaxed">
                      Batch is alleen herkomstinformatie; de opvolglijst blijft op werkvolgorde staan.
                    </p>
                  </div>
                </details>
              )}

              {geadresseerden.length > 0 && (
                <details
                  className="group rounded-md border border-border/70 bg-background"
                  data-testid="acquisitie-opvolgen-historie-details"
                  data-no-row-select="true"
                >
                  <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-foreground marker:hidden">
                    Historie &amp; details
                    <span className="ml-1 text-muted-foreground group-open:hidden">›</span>
                    <span className="ml-1 hidden text-muted-foreground group-open:inline">⌄</span>
                  </summary>
                  <div className="border-t border-border/60 px-2.5 pb-2">
                    <GeadresseerdenLijst geadresseerden={geadresseerden} />
                  </div>
                </details>
              )}
            </div>
          ) : (
            <GeadresseerdenLijst geadresseerden={geadresseerden} />
          )}
        </div>
        <div
          className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0"
          data-no-row-select="true"
        >
          {acties}
        </div>
      </div>
    </SelecteerbareDossierRij>
  );
}
