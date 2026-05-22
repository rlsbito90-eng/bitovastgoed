import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Lichte, inklapbare sectie voor de Vastgoedrekenen-module.
 * Gebruikt React-state (geen native <details>) zodat user-toggle blijft bewaard
 * ook al herberekent defaultOpen.
 */
export function Section({
  title,
  status,
  defaultOpen,
  hidden,
  children,
  tone,
  id,
}: {
  title: string;
  status?: ReactNode;
  defaultOpen?: boolean;
  hidden?: boolean;
  children: ReactNode;
  tone?: 'default' | 'primary';
  id?: string;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  if (hidden) return null;
  const borderCls = tone === 'primary' ? 'border-primary/40' : '';
  return (
    <div id={id} className={`rounded-lg border bg-card overflow-hidden ${borderCls}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="font-medium text-sm truncate">{title}</span>
        </div>
        {status && (
          <span className="text-xs text-muted-foreground text-right shrink-0 max-w-[55%] sm:max-w-[60%] leading-snug whitespace-normal break-words">
            {status}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t bg-card">{children}</div>}
    </div>
  );
}
