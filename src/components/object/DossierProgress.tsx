// DossierProgress-strip: begeleidt gebruiker na een lichte quick-create naar
// het aanvullen van dossieronderdelen. Puur presentatie + navigatie: leest
// alleen object-velden en tellingen, muteert niets, raakt geen relatievelden.

import { ReactNode } from 'react';
import { Check, ChevronRight, LineChart, Users, Building2, Scale, Sparkles, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export type DossierAnchor =
  | 'financieel'
  | 'verhuur'
  | 'pand'
  | 'juridisch'
  | 'aanbieding'
  | 'documenten';

interface DossierProgressProps {
  object: Record<string, any>;
  fotosCount: number;
  documentenCount: number;
  huurdersCount: number;
  onGoto: (anchor: DossierAnchor) => void;
}

interface CTA {
  anchor: DossierAnchor;
  label: string;
  labelDone: string;
  icon: ReactNode;
  complete: boolean;
}

/** Presence-check: waarde is aanwezig als niet null/undefined/'' en niet NaN. */
function has(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number' && Number.isNaN(v)) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

export function buildDossierCtas(
  object: Record<string, any>,
  fotosCount: number,
  documentenCount: number,
  huurdersCount: number,
): CTA[] {
  const o = object ?? {};
  const financieelOk =
    has(o.vraagprijs) ||
    has(o.huurinkomsten) ||
    has(o.brutoAanvangsrendement) ||
    has(o.nettoAanvangsrendement) ||
    has(o.noi);
  const verhuurOk =
    huurdersCount > 0 ||
    (has(o.aantalHuurders) && Number(o.aantalHuurders) > 0) ||
    (has(o.verhuurStatus) && o.verhuurStatus !== 'leeg');
  const pandOk = has(o.oppervlakte) || has(o.bouwjaar) || has(o.energielabel) || has(o.onderhoudsstaat);
  const juridischOk =
    has(o.eigendomssituatie) ||
    has(o.erfpachtinformatie) ||
    has(o.bestemmingsinformatie) ||
    has(o.kadastraalNummer) ||
    has(o.kadastraleGemeente);
  const aanbiedingOk = documentenCount > 0;
  const mediaOk = fotosCount > 0;

  return [
    { anchor: 'financieel', label: 'Financieel aanvullen', labelDone: 'Financieel', icon: <LineChart className="h-4 w-4" />, complete: financieelOk },
    { anchor: 'verhuur',    label: 'Verhuur invullen',     labelDone: 'Verhuur',    icon: <Users className="h-4 w-4" />,     complete: verhuurOk },
    { anchor: 'pand',       label: 'Pand aanvullen',        labelDone: 'Pand',       icon: <Building2 className="h-4 w-4" />, complete: pandOk },
    { anchor: 'juridisch',  label: 'Juridisch aanvullen',   labelDone: 'Juridisch',  icon: <Scale className="h-4 w-4" />,     complete: juridischOk },
    { anchor: 'aanbieding', label: '1-pager voorbereiden',  labelDone: 'Aanbieding', icon: <Sparkles className="h-4 w-4" />,  complete: aanbiedingOk },
    { anchor: 'documenten', label: 'Media uploaden',        labelDone: 'Media',      icon: <Upload className="h-4 w-4" />,    complete: mediaOk },
  ];
}

export default function DossierProgress({
  object, fotosCount, documentenCount, huurdersCount, onGoto,
}: DossierProgressProps) {
  const ctas = buildDossierCtas(object, fotosCount, documentenCount, huurdersCount);
  const doneCount = ctas.filter(c => c.complete).length;
  const total = ctas.length;
  const percent = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;
  const openCtas = ctas.filter(c => !c.complete);

  return (
    <section
      aria-label="Dossiervoortgang"
      data-testid="dossier-progress"
      className="section-card p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/80">
            Dossiervoortgang
          </p>
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight mt-0.5 flex items-center gap-2">
            {allDone ? (
              <>
                <Check className="h-4 w-4 text-success" aria-hidden />
                Dossier compleet
              </>
            ) : (
              <>Dossier aanvullen</>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allDone
              ? 'Alle hoofdonderdelen zijn ingevuld.'
              : `${doneCount} van ${total} onderdelen ingevuld.`}
          </p>
        </div>
        <div className="hidden sm:block shrink-0 text-right">
          <span className="font-mono-data text-sm text-muted-foreground">{percent}%</span>
        </div>
      </div>

      <Progress value={percent} className="h-1.5" aria-label={`Voortgang ${percent}%`} />

      {allDone ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {ctas.map(c => (
            <button
              key={c.anchor}
              type="button"
              onClick={() => onGoto(c.anchor)}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            >
              {c.icon}
              <span>{c.labelDone}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <div className="flex flex-nowrap sm:flex-wrap gap-2 px-1 pb-1">
            {openCtas.map(c => (
              <button
                key={c.anchor}
                type="button"
                onClick={() => onGoto(c.anchor)}
                className="group inline-flex items-center gap-2 min-h-[44px] px-3 rounded-md border border-border/60 bg-card/60 hover:bg-accent/10 hover:border-accent/40 text-sm text-foreground transition-colors whitespace-nowrap"
              >
                <span className="text-accent">{c.icon}</span>
                <span className="font-medium">{c.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
              </button>
            ))}
            {ctas.filter(c => c.complete).map(c => (
              <span
                key={c.anchor}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-md text-xs text-muted-foreground/80 whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                <span>{c.labelDone}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
