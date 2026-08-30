import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

import GeadresseerdenLijst, { isEmailContactwaarde, weergavenaamGeadresseerde } from './GeadresseerdenLijst';
import RadarDossierRouteringsUitleg from './RadarDossierRouteringsUitleg';
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

interface SignaalPresentatie {
  aiScore: number | null;
  kadasteradvies: string | null;
}

const ADVIES_LABEL: Record<string, string> = {
  laag: 'Laag',
  voorzichtig: 'Voorzichtig',
  aanbevolen: 'Aanbevolen',
  sterk_aanbevolen: 'Sterk aanbevolen',
};

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

function tekstVoorTestId(node: ReactNode, gezocht: string): string | null {
  let gevonden: string | null = null;
  Children.forEach(node, (child) => {
    if (gevonden || !isValidElement(child)) return;
    const element = child as ReactElement<any>;
    if (element.props['data-testid'] === gezocht) {
      const tekst = tekstUitNode(element);
      if (tekst) gevonden = tekst;
      return;
    }
    gevonden = tekstVoorTestId(element.props.children, gezocht);
  });
  return gevonden;
}

function bevatTestId(node: ReactNode, gezocht: string): boolean {
  let gevonden = false;
  Children.forEach(node, (child) => {
    if (gevonden || !isValidElement(child)) return;
    const element = child as ReactElement<any>;
    if (element.props['data-testid'] === gezocht) {
      gevonden = true;
      return;
    }
    gevonden = bevatTestId(element.props.children, gezocht);
  });
  return gevonden;
}

function vindSignaalPresentatie(node: ReactNode): SignaalPresentatie {
  let resultaat: SignaalPresentatie = { aiScore: null, kadasteradvies: null };
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<any>;
    const signaal = element.props?.signaal;
    if (signaal && typeof signaal === 'object') {
      if (typeof signaal.ai_score === 'number' && Number.isFinite(signaal.ai_score)) {
        resultaat.aiScore = signaal.ai_score;
      }
      if (typeof signaal.kadasteradvies === 'string' && signaal.kadasteradvies) {
        resultaat.kadasteradvies = signaal.kadasteradvies;
      }
    }
    const childResultaat = vindSignaalPresentatie(element.props.children);
    if (resultaat.aiScore == null && childResultaat.aiScore != null) resultaat.aiScore = childResultaat.aiScore;
    if (!resultaat.kadasteradvies && childResultaat.kadasteradvies) resultaat.kadasteradvies = childResultaat.kadasteradvies;
  });
  return resultaat;
}

function eigenaarLabel(geadresseerden: GeadresseerdeVoorDossierRij[]): string | null {
  const eerste = geadresseerden[0];
  if (!eerste) return null;
  const label = weergavenaamGeadresseerde(eerste).trim();
  return label && label !== '(zonder naam)' ? label : null;
}

function isOpvolgingsActie(werkbak: string, actieCategorie?: string | null): boolean {
  return werkbak === 'actie' && Boolean(actieCategorie?.startsWith('opvolging_'));
}

function zonderOpvolgingNodig(tekst: string | null): string | null {
  if (!tekst) return null;
  const schoon = tekst.replace(/\s*Opvolging nodig\s*/gi, ' ').replace(/\s+/g, ' ').trim();
  return schoon || null;
}

function opvolgStatusRegel(procesDatum: string | null, heeftRespons: boolean): string | null {
  if (heeftRespons) return procesDatum;
  if (!procesDatum) return 'Geen respons';
  const datum = procesDatum.replace(/\.$/, '');
  return `Geen respons · ${datum}`;
}

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
  const navigate = useNavigate();
  const opvolging = isOpvolgingsActie(werkbak, actieCategorie);
  const productie: ProductieIdentiteit = { briefnummers: [], batchnummers: [] };
  if (opvolging) verzamelProductieIdentiteit(hoofdinhoud, productie);

  const eigenaar = eigenaarLabel(geadresseerden);
  const meerdereGeadresseerden = geadresseerden.length > 1;
  const briefstatus = opvolging
    ? zonderOpvolgingNodig(tekstVoorTestId(hoofdinhoud, 'acquisitie-rij-briefstatus'))
    : null;
  const procesDatum = opvolging ? tekstVoorTestId(hoofdinhoud, 'acquisitie-rij-procesdatum') : null;
  const toegevoegd = opvolging ? tekstVoorTestId(hoofdinhoud, 'acquisitie-rij-toegevoegd') : null;
  const heeftRespons = opvolging && bevatTestId(hoofdinhoud, 'acquisitie-rij-respons');
  const statusRegel = opvolging ? opvolgStatusRegel(procesDatum, heeftRespons) : null;
  const presentatie = opvolging ? vindSignaalPresentatie(hoofdinhoud) : { aiScore: null, kadasteradvies: null };
  const adviesLabel = presentatie.kadasteradvies ? ADVIES_LABEL[presentatie.kadasteradvies] ?? null : null;
  const aiAdviesLabel = presentatie.aiScore != null && adviesLabel
    ? `AI ${Math.round(presentatie.aiScore)} · ${adviesLabel}`
    : presentatie.aiScore != null ? `AI ${Math.round(presentatie.aiScore)}` : adviesLabel;
  const werkvoorraadLabel = tekstVoorTestId(hoofdinhoud, 'acquisitie-rij-werkvoorraadstatus');
  const gebundeldBijPartij = werkvoorraadLabel === 'Gebundeld bij partij';

  const legacyEmail = geadresseerden.find((g) => isEmailContactwaarde(g.verzendadres))?.verzendadres?.trim() ?? null;
  const isEmailVerzonden = fase === 'email_verzonden';
  const contactKanaalLabel = legacyEmail ? (isEmailVerzonden ? 'E-mail verstuurd' : 'E-mailcontact') : null;
  const heeftContactOfVerzending = Boolean(contactKanaalLabel || briefstatus || productie.briefnummers.length > 0 || productie.batchnummers.length > 0);
  const verbergFormeleBriefstatus = opvolging && (productie.briefnummers.length > 0 || Boolean(isEmailVerzonden && briefstatus?.toLowerCase().includes('geen brief')));

  const hoofdinhoudClass = opvolging
    ? [
        "[&_[data-testid='acquisitie-rij-briefnummer']]:hidden",
        "[&_[data-testid='acquisitie-rij-batchnummer']]:hidden",
        "[&_[data-testid='acquisitie-rij-eigenaarproces']]:hidden",
        "[&_[data-testid='acquisitie-rij-procesdatum']]:hidden",
        "[&_[data-testid='acquisitie-rij-toegevoegd']]:hidden",
        "[&_[data-testid='acquisitie-rij-redentekst']]:hidden",
        "[&_[data-testid='acquisitie-rij-opvolging-nodig']]:hidden",
        "[&_[data-testid='acquisitie-rij-ai-score']]:hidden",
        "[&_[data-testid='kadasteradvies-badge']]:hidden",
        "[&_[data-testid='bag-kaart-badge']]:hidden",
        verbergFormeleBriefstatus ? "[&_[data-testid='acquisitie-rij-briefstatus']]:hidden" : '',
      ].filter(Boolean).join(' ')
    : '';

  return (
    <SelecteerbareDossierRij geselecteerd={geselecteerd} onToggle={onToggle} signaalId={signaalId} fase={fase} werkbak={werkbak} actieCategorie={actieCategorie}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className={hoofdinhoudClass}>{hoofdinhoud}</div>
          {gebundeldBijPartij && (
            <div className="mt-2">
              <RadarDossierRouteringsUitleg
                signaalId={signaalId}
                gebundeld
                onOpenSignaal={(id) => navigate(`/off-market/${id}`)}
              />
            </div>
          )}

          {opvolging ? (
            <div className="mt-2 space-y-2" data-testid="acquisitie-opvolgen-compact">
              {(eigenaar || contactKanaalLabel || statusRegel || aiAdviesLabel) && (
                <div className="rounded-md border border-border/70 bg-muted/15 px-2.5 py-2 text-[11px]" data-testid="acquisitie-opvolgen-samenvatting">
                  {eigenaar && <p className="font-medium text-foreground break-words">{eigenaar}{meerdereGeadresseerden ? ` · +${geadresseerden.length - 1} geadresseerde${geadresseerden.length - 1 === 1 ? '' : 'n'}` : ''}</p>}
                  {(contactKanaalLabel || statusRegel || aiAdviesLabel) && (
                    <div className={`${eigenaar ? 'mt-1.5' : ''} flex flex-wrap items-center gap-1.5`}>
                      {contactKanaalLabel && <span className="font-medium text-foreground" data-testid="acquisitie-opvolgen-contactkanaal">{contactKanaalLabel}</span>}
                      {statusRegel && <span className="text-muted-foreground" data-testid="acquisitie-opvolgen-statusregel">{statusRegel}</span>}
                      {aiAdviesLabel && <span data-testid="acquisitie-opvolgen-ai-advies" className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100/70 px-2 py-0.5 font-medium text-emerald-950">{aiAdviesLabel}</span>}
                    </div>
                  )}
                </div>
              )}

              {heeftContactOfVerzending && (
                <details className="group rounded-md border border-border/70 bg-background" data-testid="acquisitie-opvolgen-brief-verzending" data-no-row-select="true">
                  <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-foreground marker:hidden">
                    {legacyEmail ? 'Contact & verzending' : 'Brief & verzending'}<span className="ml-1 text-muted-foreground group-open:hidden">›</span><span className="ml-1 hidden text-muted-foreground group-open:inline">⌄</span>
                  </summary>
                  <div className="border-t border-border/60 px-2.5 py-2 text-[10px] text-muted-foreground">
                    {legacyEmail && <p className="mb-1.5" data-testid="acquisitie-opvolgen-email-detail"><span className="font-medium text-foreground">E-mail:</span> {legacyEmail}</p>}
                    {briefstatus && <p className="mb-1.5" data-testid="acquisitie-opvolgen-briefstatus-detail"><span className="font-medium text-foreground">Briefstatus:</span> {briefstatus}</p>}
                    {productie.briefnummers.length > 0 && <div className="flex flex-wrap items-center gap-1.5" data-testid="acquisitie-opvolgen-briefnummers"><span className="mr-1 font-medium text-foreground">Brief:</span>{productie.briefnummers.map((nummer) => <span key={nummer} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono-data">{nummer}</span>)}</div>}
                    {productie.batchnummers.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="acquisitie-opvolgen-batchnummers"><span className="mr-1 font-medium text-foreground">Batch:</span>{productie.batchnummers.map((nummer) => <span key={nummer} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono-data">{nummer}</span>)}</div>}
                    {productie.briefnummers.length === 0 && productie.batchnummers.length === 0 && !legacyEmail && <p>Er is nog geen formeel BR- of BAT-nummer gekoppeld.</p>}
                    {(productie.briefnummers.length > 0 || productie.batchnummers.length > 0) && <p className="mt-2 leading-relaxed">Batch is alleen herkomstinformatie; de opvolglijst blijft op werkvolgorde staan.</p>}
                  </div>
                </details>
              )}

              {(geadresseerden.length > 0 || toegevoegd) && (
                <details className="group rounded-md border border-border/70 bg-background" data-testid="acquisitie-opvolgen-historie-details" data-no-row-select="true">
                  <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-foreground marker:hidden">Historie &amp; details<span className="ml-1 text-muted-foreground group-open:hidden">›</span><span className="ml-1 hidden text-muted-foreground group-open:inline">⌄</span></summary>
                  <div className="border-t border-border/60 px-2.5 pb-2">
                    {toegevoegd && <p className="pt-2 text-[10px] text-muted-foreground" data-testid="acquisitie-opvolgen-toegevoegd-detail">{toegevoegd}</p>}
                    <GeadresseerdenLijst geadresseerden={geadresseerden} />
                  </div>
                </details>
              )}
            </div>
          ) : <GeadresseerdenLijst geadresseerden={geadresseerden} />}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0 [&_[data-testid='acquisitie-selectie-verwerk']]:order-first" data-no-row-select="true">{acties}</div>
      </div>
    </SelecteerbareDossierRij>
  );
}
