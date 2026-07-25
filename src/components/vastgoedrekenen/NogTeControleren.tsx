import { AlertTriangle, Info, Ban, ArrowRight } from 'lucide-react';
import type { ValidationAction, ValidationItem } from '@/lib/vastgoedrekenen/validation';

type ValidationCategory = NonNullable<ValidationItem['category']>;

function categoryOf(item: ValidationItem): ValidationCategory {
  return item.category ?? (item.level === 'info' ? 'later' : 'now');
}

function runAction(action: ValidationAction, onAction?: (action: ValidationAction) => void) {
  onAction?.(action);
  if (action.openTarget && action.targetId) {
    window.setTimeout(() => {
      document.getElementById(action.targetId ?? '')?.click();
    }, 380);
  }
}

function ItemList({
  items,
  onAction,
}: {
  items: ValidationItem[];
  onAction?: (action: ValidationAction) => void;
}) {
  return (
    <ol className="space-y-2">
      {items.map((item, idx) => {
        const Icon = item.level === 'blocker' ? Ban : item.level === 'warning' ? AlertTriangle : Info;
        const color = item.level === 'blocker'
          ? 'text-destructive'
          : item.level === 'warning'
            ? 'text-amber-800 dark:text-amber-200'
            : 'text-muted-foreground';
        return (
          <li key={`${item.title ?? item.message}-${idx}`} className="rounded-md border bg-background/80 p-2.5">
            <div className={`flex gap-2 text-xs ${color}`}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-semibold text-[10px]">{idx + 1}</span>
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span className="min-w-0">
                {item.title && <span className="block font-semibold text-foreground">{item.title}</span>}
                <span className="block mt-0.5 leading-relaxed">{item.message}</span>
              </span>
            </div>
            {item.details && item.details.length > 0 && (
              <dl className="mt-2 ml-7 sm:ml-12 overflow-hidden rounded-md border bg-muted/15 divide-y divide-border/60">
                {item.details.map((detail, detailIndex) => (
                  <div key={`${detail.label}-${detailIndex}`} className="grid grid-cols-1 gap-0.5 px-2.5 py-2 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{detail.label}</dt>
                    <dd className={`min-w-0 text-[11px] leading-snug ${
                      detail.tone === 'warning'
                        ? 'text-amber-900 dark:text-amber-200'
                        : detail.tone === 'info'
                          ? 'text-primary'
                          : 'text-foreground'
                    }`}>
                      <span className="block break-words">{detail.value}</span>
                      {detail.note && <span className="mt-0.5 block break-words text-[10px] text-muted-foreground">{detail.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {item.actions && item.actions.length > 0 && (
              <div className="mt-2 ml-12 flex flex-wrap gap-2">
                {item.actions.map((action) => (
                  <button
                    key={`${action.sectionId}-${action.targetId ?? ''}-${action.label}`}
                    type="button"
                    onClick={() => runAction(action, onAction)}
                    className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    {action.label}<ArrowRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function NogTeControleren({
  items,
  title = 'Beslisstatus en acties',
  onAction,
}: {
  items: ValidationItem[];
  title?: string;
  onAction?: (action: ValidationAction) => void;
}) {
  if (items.length === 0) return null;

  const now = items.filter((item) => categoryOf(item) === 'now');
  const later = items.filter((item) => categoryOf(item) === 'later');
  const notRelevant = items.filter((item) => categoryOf(item) === 'not_relevant');

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">Alleen punten onder “Nu nodig” beïnvloeden de actuele werkstroom.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-800 dark:text-amber-200">{now.length} nu</span>
          <span className="rounded-full border bg-muted/50 px-2 py-1 text-muted-foreground">{later.length} later</span>
          {notRelevant.length > 0 && <span className="rounded-full border bg-muted/30 px-2 py-1 text-muted-foreground">{notRelevant.length} niet relevant</span>}
        </div>
      </div>

      {now.length > 0 ? (
        <section className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Nu nodig</p>
            <p className="text-[10px] text-muted-foreground">Aanpassen of controleren voor een betrouwbaardere actuele uitkomst.</p>
          </div>
          <ItemList items={now} onAction={onAction} />
        </section>
      ) : (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          Geen directe herstelactie voor de huidige strategie en invoer.
        </div>
      )}

      {later.length > 0 && (
        <details className="rounded-md border bg-muted/20">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-foreground">
            Later controleren <span className="text-muted-foreground font-normal">({later.length})</span>
          </summary>
          <div className="border-t p-3">
            <p className="mb-2 text-[10px] text-muted-foreground">Dossier- en transactiekwaliteit; niet ieder punt is leidend voor de actuele berekening.</p>
            <ItemList items={later} onAction={onAction} />
          </div>
        </details>
      )}

      {notRelevant.length > 0 && (
        <details className="rounded-md border bg-muted/10">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground">
            Niet relevant voor dit scenario ({notRelevant.length})
          </summary>
          <div className="border-t p-3">
            <ItemList items={notRelevant} onAction={onAction} />
          </div>
        </details>
      )}
    </div>
  );
}
