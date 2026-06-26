import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Optioneel icoon (bv. lucide-icon) bovenaan. */
  icon?: ReactNode;
  /** Korte titel — verplicht. */
  title: string;
  /** Optionele toelichting onder de titel. */
  description?: string;
  /** Optionele actie (CTA), bv. een <Button> of bestaande knop. */
  action?: ReactNode;
  /** Compacte variant met minder padding voor kleinere containers. */
  compact?: boolean;
  className?: string;
}

/**
 * Gedeelde, presentatie-only empty state voor lijst- en sectiepagina's.
 *
 * Bouwt voort op de bestaande `.section-card` Liquid Glass surface en
 * gebruikt uitsluitend semantische design tokens. Centraal uitgelijnd,
 * werkt op mobiel en desktop binnen elke lijstcontainer.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="empty-state"
      className={cn(
        "section-card flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8 gap-2" : "px-6 py-12 sm:py-16 gap-3",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground",
            compact ? "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4" : "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5",
          )}
        >
          {icon}
        </div>
      )}
      <h3
        className={cn(
          "font-medium text-foreground",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
