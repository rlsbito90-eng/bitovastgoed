import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ProfielRoute } from '@/lib/matching/rolMandaatAdapter';
import type { RendementsOordeel } from '@/lib/matching/rendementsOordeel';

/**
 * Zelfde onderbouwing voor kopers bij een object en objecten bij een relatie.
 * Toont alleen onderbouwde feiten. Alle aannames blijven zichtbaar als controle.
 */
export function MatchOnderbouwing({ route, rendement }: {
  route: ProfielRoute;
  rendement?: RendementsOordeel;
}) {
  const bewijs = route.toelichting.matcht;
  const controle = route.toelichting.controleer;
  const afwijkend = route.toelichting.afwijkend;
  const belangrijkeControle = controle.filter(x =>
    !x.startsWith('Uiteindelijke koper eventueel later')).slice(0, 2);
  const eersteBewijs = bewijs.find(x =>
    !x.startsWith('Landelijk zoekgebied') && !x.startsWith('Vraagprijs binnen budget'))
    ?? bewijs[0];
  const eersteControle = belangrijkeControle[0] ?? afwijkend[0];
  const rendementAandacht = rendement && rendement.status !== 'niet_van_toepassing' &&
    rendement.status !== 'indicatief_voldoet';

  return <div className="min-w-0 space-y-2" data-testid="match-onderbouwing">
    <div className="space-y-1.5 text-xs leading-5">
      {eersteBewijs
        ? <p className="flex items-start gap-2 text-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span className="min-w-0 break-words">{eersteBewijs}</span>
          </p>
        : <p className="text-muted-foreground">Nog onvoldoende bevestigde aanknopingspunten.</p>}
      {eersteControle
        ? <p className="flex items-start gap-2 text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{eersteControle}</span>
          </p>
        : rendementAandacht
          ? <p className="flex items-start gap-2 text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{rendement.uitleg}</span>
            </p>
          : null}
    </div>
    <details className="group rounded-md border border-border/70 bg-muted/20 text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
        Bekijk alle matchcriteria ({bewijs.length} passend · {controle.length + afwijkend.length + (rendementAandacht ? 1 : 0)} aandacht)
      </summary>
      <div className="space-y-2 border-t border-border/70 px-3 py-3 leading-5">
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
        <p className="border-t border-border/60 pt-2 text-muted-foreground">
          Een matchvoorstel is geen bevestigde aankoopbereidheid. Specifieke koopvoorwaarden
          en de haalbaarheid van de transactie blijven afzonderlijk te controleren.
        </p>
      </div>
    </details>
  </div>;
}
