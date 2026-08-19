import { lazy, Suspense } from 'react';
import type { BagVerkennerPand } from '@/lib/bag/pandenverkennerModel';
import type { BagKaartFilters } from '@/lib/bag/kaartModel';

const LazyBagPandenKaartRuntime = lazy(() => import('./BagPandenKaartRuntime'));

interface Props {
  scopeCode: string;
  filters: BagKaartFilters;
  geselecteerdeIds?: Set<string>;
  onKandidaatToggle?: (pand: BagVerkennerPand) => void;
}

export default function BagPandenKaart(props: Props) {
  return (
    <Suspense
      fallback={(
        <div className="min-h-[520px] rounded-lg border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
          Kaart laden…
        </div>
      )}
    >
      <LazyBagPandenKaartRuntime {...props} />
    </Suspense>
  );
}
