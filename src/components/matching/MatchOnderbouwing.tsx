import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { MatchVoorwaarde, ProfielRoute } from '@/lib/matching/rolMandaatAdapter';
import type { RendementsOordeel } from '@/lib/matching/rendementsOordeel';
import { bepaalMatchBewijskwaliteit, MATCH_ONDERDELEN, type MatchOnderdeel } from '@/lib/matching/matchBewijskwaliteit';
const ONDERDEEL_LABELS:Record<MatchOnderdeel,string>={vastgoed:'Vastgoedtype en subcategorie',strategie:'Strategie',locatie:'Locatie',budget:'Budget',rendement:'Rendement / Factor'};
const STATUS_LABELS={passend:'Passend',afwijkend:'Wijkt af',controle:'Controle nodig',niet_ingevuld:'Niet ingevuld'};

const VOORWAARDE_LABELS: Record<MatchVoorwaarde['soort'], string> = {
  hard: 'Harde aankoopvoorwaarde', uitsluiting: 'Uitsluiting', profiel: 'Voorwaarde zoekprofiel',
  aanvullend: 'Aanvullend aankoopcriterium', rendement: 'Rendementsdoel',
  strategie: 'Investeringsstrategie', voorkeur: 'Voorkeur',
};

/**
 * Zelfde onderbouwing voor kopers bij een object en objecten bij een relatie.
 * Toont alleen onderbouwde feiten. Alle aannames blijven zichtbaar als controle.
 */
export function MatchOnderbouwing({ route, rendement }: {
  route: ProfielRoute;
  rendement?: RendementsOordeel;
}) {
  const kwaliteit=bepaalMatchBewijskwaliteit(route,rendement);
  const bewijs = route.toelichting.matcht;
  const controle = route.toelichting.controleer;
  const afwijkend = route.toelichting.afwijkend;
  const belangrijkeControle = controle.filter(x =>
    !x.startsWith('Uiteindelijke koper eventueel later')).slice(0, 2);
  const eersteBewijs = bewijs.find(x =>
    !x.startsWith('Landelijk zoekgebied') && !x.startsWith('Vraagprijs binnen budget'))
    ?? bewijs[0];
  const voorwaarden = route.toelichting.voorwaarden ?? [];
  const hoofdvoorwaarde = voorwaarden.find(v => v.soort !== 'voorkeur');
  const eersteControle = afwijkend[0] ?? belangrijkeControle[0];
  const rendementAandacht = rendement && rendement.status !== 'niet_van_toepassing' &&
    rendement.status !== 'indicatief_voldoet';

  return <div className="min-w-0 space-y-2" data-testid="match-onderbouwing">
    <div className="space-y-1.5 text-xs leading-5">
      {kwaliteit && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground" aria-label="Aansluiting en onderbouwing">
        <span className="font-medium text-foreground">{kwaliteit.aansluiting===null?'Aansluiting: onvoldoende toetsbare onderdelen':`Aansluiting: ${kwaliteit.aansluiting}%`}</span>
        <span>{kwaliteit.beoordeeld} van {kwaliteit.totaal} onderdelen beoordeeld (indicatief)</span>
      </div>}
      {eersteBewijs
        ? <p className="flex items-start gap-2 text-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span className="min-w-0 break-words">{eersteBewijs}</span>
          </p>
        : <p className="text-muted-foreground">Nog onvoldoende bevestigde aanknopingspunten.</p>}
      {hoofdvoorwaarde && <div className="min-w-0 rounded-md border border-border/70 px-2.5 py-2">
        <p className="font-medium text-foreground">{VOORWAARDE_LABELS[hoofdvoorwaarde.soort]} · te controleren</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground line-clamp-2">{hoofdvoorwaarde.tekst}</p>
      </div>}
      {eersteControle
        ? <p className="flex items-start gap-2 text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{eersteControle}</span>
          </p>
        : rendementAandacht
          ? <p className="flex items-start gap-2 text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{rendement?.uitleg}</span>
            </p>
          : null}
      {rendement && rendement.status!=='niet_van_toepassing' && (eersteControle || !rendementAandacht) && (
        <p className="flex items-start gap-2 text-muted-foreground">
          {rendementAandacht
            ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />}
          <span className="min-w-0 break-words line-clamp-3">{rendement.uitleg}</span>
        </p>
      )}
      {rendement?.prijsindicatie && <div className="min-w-0 border-t border-border/70 pt-2">
        <p className="font-medium text-foreground">Indicatieve aankoopgrens op {rendement.prijsindicatie.grondslag}</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{rendement.prijsindicatie.maximum.toLocaleString('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0})}</p>
        {rendement.prijsindicatie.verschilVraagprijs!==null && rendement.prijsindicatie.verschilVraagprijs>0 && <p className="text-muted-foreground">
          Vraagprijs ligt {rendement.prijsindicatie.verschilVraagprijs.toLocaleString('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0})} hoger.
        </p>}
        <p className="text-muted-foreground">Exclusief aankoopkosten; geen bod of volledige waardering.{rendement.prijsindicatie.overigeCriteriaOngetoetst?' Andere criteria zijn hierin niet doorgerekend.':''}</p>
      </div>}
    </div>
    <details className="group rounded-md border border-border/70 bg-muted/20 text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
        Bekijk alle matchcriteria ({bewijs.length} passend · {controle.length + afwijkend.length + (rendementAandacht ? 1 : 0)} aandacht)
      </summary>
      <div className="space-y-2 border-t border-border/70 px-3 py-3 leading-5">
        {kwaliteit&&<div className="space-y-1">
          <p className="font-medium text-foreground">Onderbouwing per onderdeel</p>
          {MATCH_ONDERDELEN.map(k=><div key={k} className="flex flex-wrap justify-between gap-x-3 text-muted-foreground"><span>{ONDERDEEL_LABELS[k]}</span><span>{STATUS_LABELS[kwaliteit.onderdelen[k]]}</span></div>)}
          <p className="text-muted-foreground">Aansluiting = passende onderdelen / beoordeelde onderdelen. Niet-ingevulde en nog te controleren onderdelen tellen niet als passend. Het percentage is geen aankoopkans; vrije voorwaarden en risico’s blijven apart te toetsen.</p>
        </div>}
        {bewijs.length > 0 && <div>
          <p className="font-medium text-foreground">Aanknopingspunten</p>
          {bewijs.map((x, i) => <p key={i} className="break-words text-muted-foreground">✓ {x}</p>)}
        </div>}
        {(controle.length > 0 || afwijkend.length > 0 || rendement) && <div>
          <p className="font-medium text-foreground">Nog te beoordelen</p>
          {controle.map((x, i) => <p key={i} className="break-words text-muted-foreground">{x}</p>)}
          {afwijkend.map((x, i) => <p key={i} className="break-words text-destructive">{x}</p>)}
          {rendement && rendement.status !== 'niet_van_toepassing' &&
            <p className="break-words text-muted-foreground">Rendement: {rendement.uitleg}</p>}
        </div>}
        {voorwaarden.length > 0 && <div className="space-y-2">
          <p className="font-medium text-foreground">Vastgelegde aankoopvoorwaarden en voorkeuren</p>
          {voorwaarden.map((v, i) => <div key={i} className="min-w-0">
            <p className="font-medium text-foreground">{VOORWAARDE_LABELS[v.soort]}{v.soort === 'voorkeur' ? ' · niet-bindend' : ' · te controleren'}</p>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground">{v.tekst}</p>
          </div>)}
        </div>}
        <p className="border-t border-border/60 pt-2 text-muted-foreground">
          Een matchvoorstel is geen bevestigde aankoopbereidheid. Specifieke koopvoorwaarden
          en de haalbaarheid van de transactie blijven afzonderlijk te controleren.
        </p>
      </div>
    </details>
  </div>;
}
