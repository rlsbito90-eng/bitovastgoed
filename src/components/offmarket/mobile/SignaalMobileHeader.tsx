// Compacte mobiele header voor signaaldetail.
// Titel max 2 regels (line-clamp), adres/plaats apart, status + prioriteit badges,
// compacte Bewerken/Archiveren actieknoppen.
import { Pencil, Archive, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  OffMarketPriorityBadge,
  OffMarketStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import {
  BRON_TYPE_LABEL,
  SIGNAALTYPE_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  onEdit: () => void;
  onArchive: () => void;
}

export default function SignaalMobileHeader({ signaal, onEdit, onArchive }: Props) {
  const isArchief = !!signaal.gearchiveerd_op;
  const adresParts = [signaal.adres, signaal.plaats].filter(Boolean).join(', ');
  const sub = [
    SIGNAALTYPE_LABEL[signaal.type_signaal],
    BRON_TYPE_LABEL[signaal.bron_type],
  ].filter(Boolean).join(' · ');

  return (
    <section
      data-testid="signaal-mobile-header"
      className="section-card p-3.5 space-y-2.5"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1
            className="text-[17px] font-semibold text-foreground leading-snug break-words"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={signaal.titel}
          >
            {signaal.titel}
          </h1>
          {adresParts && (
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
              <span className="break-words">{adresParts}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onEdit}
            aria-label="Bewerken"
            className="h-8 w-8"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!isArchief && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onArchive}
              aria-label="Archiveren"
              className="h-8 w-8"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-1.5">
        <OffMarketStatusBadge status={signaal.status} />
        <OffMarketPriorityBadge prioriteit={signaal.prioriteit} />
        {sub && (
          <span className="text-[11px] text-muted-foreground">· {sub}</span>
        )}
        {isArchief && (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
            Gearchiveerd
          </span>
        )}
      </div>
    </section>
  );
}
