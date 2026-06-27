// Volledige statusdropdown voor off-market signalen.
// Toont alle statussen uit STATUS_LABEL en gebruikt de bestaande
// `useUpdateOffMarketSignaal`-mutatie. Geen DB-wijzigingen, geen nieuwe RPC.
import { toast } from 'sonner';
import { Pencil, ChevronDown } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { OffMarketStatusBadge } from '@/components/offmarket/OffMarketBadges';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import {
  STATUS_LABEL, STATUS_VOLGORDE,
  type OffMarketSignaal, type OffMarketStatus,
} from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  /**
   * 'inline'  → volledige selectknop (voor in Overzicht-actiebalk).
   * 'compact' → control-wrapper met badge + chevron (voor in rechter cockpit).
   */
  variant?: 'inline' | 'compact';
}

export default function StatusWijzigDropdown({ signaal, variant = 'inline' }: Props) {
  const update = useUpdateOffMarketSignaal();

  const zetStatus = async (nieuw: OffMarketStatus) => {
    if (nieuw === signaal.status || update.isPending) return;
    try {
      await update.mutateAsync({ id: signaal.id, patch: { status: nieuw } });
      toast.success(`Status: ${STATUS_LABEL[nieuw]}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Status bijwerken mislukt');
    }
  };

  if (variant === 'compact') {
    return (
      <Select value={signaal.status} onValueChange={(v) => zetStatus(v as OffMarketStatus)}>
        <SelectTrigger
          aria-label="Status wijzigen"
          data-testid="status-wijzig-compact"
          className="h-auto min-h-[36px] sm:min-h-[32px] w-auto gap-1.5 px-2 py-1 rounded-md border border-border bg-card/60 hover:border-accent/50 hover:bg-muted/60 focus:ring-1 focus:ring-ring focus:ring-offset-0 [&>svg]:hidden"
        >
          <span className="inline-flex items-center gap-1.5">
            <OffMarketStatusBadge status={signaal.status} />
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </span>
        </SelectTrigger>
        <SelectContent align="end">
          {STATUS_VOLGORDE.map((s) => (
            <SelectItem key={s} value={s} data-testid={`status-optie-${s}`}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={signaal.status} onValueChange={(v) => zetStatus(v as OffMarketStatus)}>
      <SelectTrigger
        aria-label="Status wijzigen"
        data-testid="status-wijzig-dropdown"
        className="h-8 w-auto min-w-[180px] text-xs"
      >
        <SelectValue placeholder="Status wijzigen">
          <span className="inline-flex items-center gap-1.5">
            <Pencil className="h-3 w-3 text-muted-foreground" />
            <span>Status: {STATUS_LABEL[signaal.status]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {STATUS_VOLGORDE.map((s) => (
          <SelectItem key={s} value={s} data-testid={`status-optie-${s}`}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
