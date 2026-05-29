// Compacte toolbar boven de accordions: snel Alles uitklappen / inklappen
// of overschakelen naar Strategie-view (componenten/strategie/cockpit-focus).

import { Button } from '@/components/ui/button';
import { ChevronsDownUp, ChevronsUpDown, Target } from 'lucide-react';

export function AccordionToolbar({
  onExpandAll,
  onCollapseAll,
  onStrategieView,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onStrategieView: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pr-1 hidden sm:inline">
        Weergave
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onExpandAll}
        className="h-7 px-2 text-xs"
        title="Alle secties uitklappen"
      >
        <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
        Alles uitklappen
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCollapseAll}
        className="h-7 px-2 text-xs"
        title="Alle secties inklappen"
      >
        <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
        Alles inklappen
      </Button>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Button
        size="sm"
        variant="ghost"
        onClick={onStrategieView}
        className="h-7 px-2 text-xs"
        title="Focus op componentstrategie en uitkomst"
      >
        <Target className="h-3.5 w-3.5 mr-1" />
        Strategie-view
      </Button>
    </div>
  );
}

export default AccordionToolbar;
