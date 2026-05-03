import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ListNavigationInfo } from '@/lib/listNavigation';

interface Props {
  info: ListNavigationInfo;
  buildHref: (id: string) => string;
  itemLabel?: string; // bv. "relatie", "object"
}

/**
 * Herbruikbare Vorige/Volgende navigatie voor detailpagina's.
 * Werkt op basis van een eerder opgeslagen lijst-context (zie listNavigation.ts).
 */
export default function ListNavigator({ info, buildHref, itemLabel = 'item' }: Props) {
  const navigate = useNavigate();
  const { prevId, nextId, index, total } = info;

  const prevDisabled = !prevId;
  const nextDisabled = !nextId;

  const baseBtn =
    'inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md transition-colors text-foreground';
  const enabled = 'hover:bg-muted';
  const disabled = 'opacity-40 cursor-not-allowed';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => prevId && navigate(buildHref(prevId))}
              disabled={prevDisabled}
              className={`${baseBtn} ${prevDisabled ? disabled : enabled}`}
              aria-label="Vorige"
            >
              <ChevronLeft className="h-4 w-4" /> Vorige
            </button>
          </TooltipTrigger>
          {prevDisabled && (
            <TooltipContent>Dit is de eerste {itemLabel} in de lijst</TooltipContent>
          )}
        </Tooltip>

        {index >= 0 && total > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums px-1">
            {itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} {index + 1} van {total}
          </span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => nextId && navigate(buildHref(nextId))}
              disabled={nextDisabled}
              className={`${baseBtn} ${nextDisabled ? disabled : enabled}`}
              aria-label="Volgende"
            >
              Volgende <ChevronRight className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          {nextDisabled && (
            <TooltipContent>Dit is de laatste {itemLabel} in de lijst</TooltipContent>
          )}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
