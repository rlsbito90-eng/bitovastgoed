import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalActionBarProps {
  /** Primaire actie (rechts, dominant). Render zelf een Button of equivalent. */
  primary?: React.ReactNode;
  /** Secundaire acties (links/midden, lichter). */
  secondary?: React.ReactNode[];
  /** Callback voor de Annuleren/Sluiten-knop. Wanneer afwezig wordt geen cancel-knop getoond. */
  onCancel?: () => void;
  /** Label voor de cancel-knop. */
  cancelLabel?: string;
  className?: string;
}

/**
 * Sticky actiebalk voor modals/sheets volgens de Bito UI/UX-standaard.
 *
 * - Sticky onderaan binnen het scrollende modal/sheet-content.
 * - Subtiele bovenrand zodat scrollende inhoud niet "achter doorloopt".
 * - Respecteert safe-area-inset-bottom op mobiel.
 * - Cancel/Sluiten als nette knop (links), primaire actie rechts.
 *
 * Opt-in: bestaande DialogFooters worden NIET automatisch vervangen.
 */
export function ModalActionBar({
  primary,
  secondary,
  onCancel,
  cancelLabel = "Annuleren",
  className,
}: ModalActionBarProps) {
  const hasSecondary = Array.isArray(secondary) && secondary.length > 0;
  return (
    <div
      data-modal-action-bar=""
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10",
        "flex flex-wrap items-center justify-between gap-2",
        "border-t border-border bg-background/95 backdrop-blur",
        "px-4 sm:px-6 py-3",
        className,
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        {hasSecondary &&
          secondary!.map((node, i) => (
            <React.Fragment key={i}>{node}</React.Fragment>
          ))}
      </div>
      {primary && <div className="flex items-center gap-2 ml-auto">{primary}</div>}
    </div>
  );
}

export default ModalActionBar;
