// Inline eigenaarstatus-dropdown voor Signaal-Cockpit.
// Trigger = control-wrapper rond badge + chevron, duidelijk klikbaar.
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { OffMarketEigenaarstatusBadge } from '@/components/offmarket/OffMarketBadges';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import {
  EIGENAARSTATUS_LABEL, EIGENAARSTATUS_VOLGORDE,
  type OffMarketEigenaarstatus,
} from '@/lib/offMarket/types';

interface Props {
  signaalId: string;
  eigenaarstatus: OffMarketEigenaarstatus;
}

export default function EigenaarstatusWijzigDropdown({ signaalId, eigenaarstatus }: Props) {
  const update = useUpdateOffMarketSignaal();

  const zet = async (nieuw: OffMarketEigenaarstatus) => {
    if (nieuw === eigenaarstatus || update.isPending) return;
    try {
      await update.mutateAsync({ id: signaalId, patch: { eigenaarstatus: nieuw } as any });
      toast.success(`Eigenaarstatus: ${EIGENAARSTATUS_LABEL[nieuw]}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Eigenaarstatus bijwerken mislukt');
    }
  };

  return (
    <Select value={eigenaarstatus} onValueChange={(v) => zet(v as OffMarketEigenaarstatus)}>
      <SelectTrigger
        aria-label="Eigenaarstatus wijzigen"
        data-testid="eigenaarstatus-wijzig-dropdown"
        className="h-10 min-h-10 w-auto gap-1.5 px-2 py-1.5 rounded-md border border-border bg-card/60 hover:border-accent/50 hover:bg-muted/60 focus:ring-1 focus:ring-ring focus:ring-offset-0 overflow-visible [&>svg]:hidden [&>span]:!line-clamp-none [&>span]:!overflow-visible"
      >
        <span className="inline-flex items-center gap-1.5 leading-none overflow-visible">
          <OffMarketEigenaarstatusBadge status={eigenaarstatus} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {EIGENAARSTATUS_VOLGORDE.map((s) => (
          <SelectItem key={s} value={s} data-testid={`eigenaarstatus-optie-${s}`}>
            {EIGENAARSTATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
