import { ReactNode, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** Externe trigger om sectie open te dwingen (bv. hash-deep-link). */
  forceOpen?: boolean;
  children: ReactNode;
}

function isDesktop(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(min-width: 1024px)').matches;
  } catch {
    return false;
  }
}

/**
 * Collapsible beheerkaart op de AdminPage.
 * Mobiel standaard ingeklapt, desktop standaard uitgeklapt.
 * Body wordt via `hidden` verborgen i.p.v. unmount, zodat queries/state behouden blijven.
 */
export default function AdminSectionCard({
  id,
  title,
  subtitle,
  icon,
  badge,
  defaultOpen,
  forceOpen,
  children,
}: Props) {
  const [open, setOpen] = useState<boolean>(() => defaultOpen ?? isDesktop());

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const headerId = `${id}-header`;
  const bodyId = `${id}-body`;

  return (
    <section
      id={id}
      data-testid={`admin-section-${id}`}
      className="section-card bg-card border border-border rounded-lg overflow-hidden scroll-mt-20"
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-semibold text-foreground truncate flex items-center gap-2">
            <span className="truncate">{title}</span>
            {badge && <span className="shrink-0">{badge}</span>}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        id={bodyId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        className="px-4 sm:px-5 pb-5 pt-1 border-t border-border/60"
      >
        {children}
      </div>
    </section>
  );
}
