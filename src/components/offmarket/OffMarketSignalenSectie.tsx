// Sectie op de RelatieDetailPage met gekoppelde off-market signalen.
import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { useSignalenVoorRelatie } from '@/hooks/useOffMarketLinks';
import { ASSETTYPE_LABEL } from '@/lib/offMarket/types';
import { formatSignaalTitel, cleanPlaats } from '@/lib/offMarket/adresNormalisatie';
import {
  OffMarketPriorityBadge,
  OffMarketStatusBadge,
} from '@/components/offmarket/OffMarketBadges';

interface Props {
  relatieId: string;
}

export default function OffMarketSignalenSectie({ relatieId }: Props) {
  const { data: signalen, isLoading } = useSignalenVoorRelatie(relatieId);
  const lijst = signalen ?? [];

  if (isLoading && lijst.length === 0) return null;
  if (!isLoading && lijst.length === 0) return null;

  return (
    <section className="section-card">
      <header className="section-header">
        <h2 className="section-title flex items-center gap-2">
          <Radar className="h-4 w-4 text-muted-foreground" />
          Off-market signalen ({lijst.length})
        </h2>
      </header>
      <div className="divide-y divide-border/70">
        {lijst.map((s) => (
          <Link
            key={s.id}
            to={`/off-market/${s.id}`}
            className="block px-5 py-3.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{formatSignaalTitel(s)}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {ASSETTYPE_LABEL[s.assettype]}
                  {cleanPlaats(s.plaats) ? ` · ${cleanPlaats(s.plaats)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <OffMarketPriorityBadge prioriteit={s.prioriteit} />
                <OffMarketStatusBadge status={s.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
