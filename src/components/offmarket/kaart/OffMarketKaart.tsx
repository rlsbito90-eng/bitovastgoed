import { lazy, Suspense } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { OffMarketPrioriteit, OffMarketSignaal } from '@/lib/offMarket/types';

const LazyOffMarketKaartRuntime = lazy(() => import('./OffMarketKaartRuntime'));

const PRIO_COLOR: Record<OffMarketPrioriteit, string> = {
  urgent: '#dc2626',
  hoog: '#ea580c',
  midden: '#ca8a04',
  laag: '#475569',
};

export function heeftLocatie(s: OffMarketSignaal): boolean {
  const lat = (s as any).lat as number | null;
  const lng = (s as any).lng as number | null;
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && !(lat === 0 && lng === 0);
}

export function bouwGeoJson(signalen: OffMarketSignaal[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: signalen.filter(heeftLocatie).map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [(s as any).lng as number, (s as any).lat as number] },
      properties: {
        id: s.id,
        titel: s.titel,
        prioriteit: s.prioriteit,
        kleur: PRIO_COLOR[s.prioriteit as OffMarketPrioriteit] ?? '#475569',
      },
    })),
  };
}

interface Props {
  signalen: OffMarketSignaal[];
}

export default function OffMarketKaart(props: Props) {
  return (
    <Suspense
      fallback={(
        <div className="w-full h-[calc(100vh-220px)] min-h-[480px] rounded-lg border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
          Kaart laden…
        </div>
      )}
    >
      <LazyOffMarketKaartRuntime {...props} />
    </Suspense>
  );
}
