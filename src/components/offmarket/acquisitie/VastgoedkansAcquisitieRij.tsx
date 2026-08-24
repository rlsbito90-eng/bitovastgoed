import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import { PRIORITEIT_LABEL, STATUS_LABEL, kansTitel } from '@/lib/vastgoedkansen';
import type { WerkbakContext } from '@/lib/offMarket/acquisitie/werkbak';
import AcquisitieDossierRij from './AcquisitieDossierRij';
import PandenverkennerProductiekernActies from '@/components/acquisitie/PandenverkennerProductiekernActies';

interface Props {
  kans: Vastgoedkans;
  ctx: WerkbakContext;
  geselecteerd: boolean;
  toegevoegdOp: string | null;
  onToggle: () => void;
  onVerwijder: () => void;
  verwijderBezig?: boolean;
}

function volledigObjectadres(kans: Vastgoedkans): string | null {
  if (!kans.adres?.trim() || !kans.postcode?.trim() || !kans.plaats?.trim()) return null;
  return `${kans.adres.trim()}\n${kans.postcode.trim()} ${kans.plaats.trim()}`;
}

function faseVoorKans(kans: Vastgoedkans, ctx: WerkbakContext): string {
  if (ctx.werkbak === 'afgehandeld') return 'afgerond';
  if (ctx.werkbak === 'wachten') return 'gepost';
  if (ctx.actieSubfilter === 'printen_posten') return 'gereed_voor_print';
  if (ctx.actieSubfilter === 'brief_voorbereiden') return 'brief_voorbereiden';
  if (ctx.actieSubfilter === 'opvolgen') return 'opvolging_open';
  return 'onderzoek_nodig';
}

function eigenaarTekst(kans: Vastgoedkans): string {
  if (kans.eigenaarNaam?.trim()) return `Eigenaar: ${kans.eigenaarNaam.trim()}`;
  return volledigObjectadres(kans) ? 'Algemene eigenaarspost mogelijk' : 'Objectadres onvolledig';
}

export default function VastgoedkansAcquisitieRij({
  kans,
  ctx,
  geselecteerd,
  toegevoegdOp,
  onToggle,
  onVerwijder,
  verwijderBezig = false,
}: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rijRef = useRef<HTMLDivElement | null>(null);
  const focusVastgoedkansId = searchParams.get('vastgoedkans');
  const isFocus = focusVastgoedkansId === kans.id;

  useEffect(() => {
    if (!isFocus || !rijRef.current) return;
    const id = window.setTimeout(() => rijRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 40);
    return () => window.clearTimeout(id);
  }, [isFocus]);

  const verzendadres = kans.eigenaarNaam?.trim() ? null : volledigObjectadres(kans);
  const geadresseerden = verzendadres || kans.eigenaarNaam?.trim()
    ? [{
        key: `vastgoedkans:${kans.id}`,
        naam: kans.eigenaarNaam?.trim() || 'Aan de eigenaar van',
        bedrijfsnaam: null,
        verzendadres,
        volledigPostadres: Boolean(verzendadres || kans.eigenaarNaam?.trim()),
      }]
    : [];

  return (
    <AcquisitieDossierRij
      geselecteerd={geselecteerd}
      onToggle={onToggle}
      signaalId={`vastgoedkans:${kans.id}`}
      fase={faseVoorKans(kans, ctx)}
      werkbak={ctx.werkbak}
      actieCategorie={ctx.actieCategorie}
      geadresseerden={geadresseerden}
      hoofdinhoud={(
        <div
          ref={rijRef}
          data-vastgoedkans-id={kans.id}
          className="flex items-start gap-3 min-w-0 flex-1"
          data-testid="acquisitie-vastgoedkans-rij"
        >
          <Checkbox
            checked={geselecteerd}
            onCheckedChange={onToggle}
            aria-label={`Selecteer ${kansTitel(kans)} voor bulkacties`}
            data-testid="acquisitie-rij-bulkcheck-vastgoedkans"
            className="mt-1"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium text-foreground break-words">{kansTitel(kans)}</p>
              <span className="inline-flex rounded border border-accent/35 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent whitespace-nowrap">Pandenverkenner</span>
              {isFocus && <span className="inline-flex rounded border border-accent/50 bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">Geselecteerd dossier</span>}
              <span className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">{STATUS_LABEL[kans.status]}</span>
              <span className="inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</span>
              {kans.briefKenmerk && <span className="inline-flex rounded border border-border bg-background px-1.5 py-0.5 font-mono-data text-[10px] font-medium text-foreground">{kans.briefKenmerk}</span>}
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {[kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ') || 'Adres ontbreekt'}{' · '}{eigenaarTekst(kans)}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {ctx.procesDatum && <span>{ctx.procesDatum.label}</span>}
              {toegevoegdOp && <span>Toegevoegd {toegevoegdOp.slice(0, 10)}</span>}
              {kans.typeVastgoed && <span>{kans.typeVastgoed}</span>}
            </div>
            {kans.korteOmschrijving && kans.korteOmschrijving !== kansTitel(kans) && <p className="text-[11px] text-muted-foreground line-clamp-2">{kans.korteOmschrijving}</p>}
            <PandenverkennerProductiekernActies vastgoedkansId={kans.id} compact />
          </div>
        </div>
      )}
      acties={(
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/vastgoedkansen/${kans.id}`)} data-testid="acquisitie-vastgoedkans-open"><ExternalLink className="h-3.5 w-3.5" />Open</Button>
          {ctx.actieSubfilter === 'brief_voorbereiden' && <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/vastgoedkansen/${kans.id}`)}><FileText className="h-3.5 w-3.5" />Brief</Button>}
          <Button type="button" size="sm" variant="ghost" onClick={onVerwijder} disabled={verwijderBezig} data-testid="acquisitie-vastgoedkans-uit-selectie"><X className="h-3.5 w-3.5" />Uit selectie</Button>
        </>
      )}
    />
  );
}