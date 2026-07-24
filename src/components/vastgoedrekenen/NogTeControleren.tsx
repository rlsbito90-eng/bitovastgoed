import { AlertTriangle, Info, Ban, ArrowRight } from 'lucide-react';
import type { ValidationAction, ValidationItem } from '@/lib/vastgoedrekenen/validation';

export default function NogTeControleren({
  items,
  title = 'Nog te controleren',
  onAction,
}: {
  items: ValidationItem[];
  title?: string;
  onAction?: (action: ValidationAction) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">{title}</p>
      <ol className="space-y-2">
        {items.map((item, idx) => {
          const Icon = item.level === 'blocker' ? Ban : item.level === 'warning' ? AlertTriangle : Info;
          const color = item.level === 'blocker' ? 'text-destructive' : item.level === 'warning' ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground';
          return (
            <li key={`${item.title ?? item.message}-${idx}`} className="rounded-md border bg-background/70 p-2.5">
              <div className={`flex gap-2 text-xs ${color}`}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-semibold text-[10px]">{idx + 1}</span>
                <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span className="min-w-0">
                  {item.title && <span className="block font-semibold text-foreground">{item.title}</span>}
                  <span className="block mt-0.5 leading-relaxed">{item.message}</span>
                </span>
              </div>
              {item.actions && item.actions.length > 0 && (
                <div className="mt-2 ml-12 flex flex-wrap gap-2">
                  {item.actions.map((action) => (
                    <button
                      key={`${action.sectionId}-${action.targetId ?? ''}-${action.label}`}
                      type="button"
                      onClick={() => onAction?.(action)}
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
    </div>
  );
}
