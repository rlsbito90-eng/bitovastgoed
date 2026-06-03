import { ArrowLeft, Pencil, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { OffMarketPriorityBadge, OffMarketStatusBadge } from '@/components/offmarket/OffMarketBadges';
import {
  ASSETTYPE_LABEL, BRON_TYPE_LABEL, SIGNAALTYPE_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  onEdit: () => void;
  onArchive: () => void;
}

export default function SignaalDetailHeader({ signaal, onEdit, onArchive }: Props) {
  const sub = [
    ASSETTYPE_LABEL[signaal.assettype],
    SIGNAALTYPE_LABEL[signaal.type_signaal],
    BRON_TYPE_LABEL[signaal.bron_type],
  ].filter(Boolean).join(' · ');

  const isArchief = !!signaal.gearchiveerd_op;

  return (
    <div className="space-y-3">
      <Link to="/off-market" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Terug naar Off-Market Radar
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight break-words">
            {signaal.titel}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{sub}</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-3">
            <OffMarketStatusBadge status={signaal.status} />
            <OffMarketPriorityBadge prioriteit={signaal.prioriteit} />
            {isArchief && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
                Gearchiveerd
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Bewerken
          </Button>
          {!isArchief && (
            <Button variant="outline" size="sm" onClick={onArchive}>
              <Archive className="h-4 w-4" /> Archiveren
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
