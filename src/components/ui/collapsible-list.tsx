import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Aantal items dat standaard wordt getoond. */
  initial?: number;
  /** Label op de "Toon alles"-knop; krijgt resterend aantal items. */
  moreLabel?: (resterend: number) => string;
  /** Label op de "Toon minder"-knop. */
  lessLabel?: string;
  /** Optionele key-extractor (anders index). */
  getKey?: (item: T, index: number) => string | number;
  className?: string;
  /** Optionele wrapper-className voor de lijst zelf (bijv. divide-y). */
  listClassName?: string;
}

/**
 * Inklapbare lijst volgens de Bito UI/UX-standaard.
 * - Toont standaard de eerste `initial` items (default 5).
 * - Knop "Toon alles (N)" om uit te klappen, "Toon minder" om in te klappen.
 * - Geen persistente state: na unmount/remount weer ingeklapt.
 * - Pure UI; haalt en muteert geen data.
 *
 * Opt-in: bestaande lijsten worden NIET automatisch gemigreerd.
 */
export function CollapsibleList<T>({
  items,
  renderItem,
  initial = 5,
  moreLabel = (n) => `Toon alles (${n + initial})`,
  lessLabel = "Toon minder",
  getKey,
  className,
  listClassName,
}: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const total = items.length;
  const showAll = expanded || total <= initial;
  const visible = showAll ? items : items.slice(0, initial);
  const verborgen = Math.max(0, total - initial);

  return (
    <div className={cn("space-y-2", className)}>
      <div className={listClassName}>
        {visible.map((item, i) => {
          const key = getKey ? getKey(item, i) : i;
          return <div key={key}>{renderItem(item, i)}</div>;
        })}
      </div>
      {verborgen > 0 && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? lessLabel : moreLabel(verborgen)}
          </Button>
        </div>
      )}
    </div>
  );
}

export default CollapsibleList;
