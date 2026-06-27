// Inline prioriteit-dropdown voor Signaal-Cockpit.
// Trigger = control-wrapper rond badge + chevron, zodat duidelijk is dat
// het veld klikbaar is. Gebruikt bestaande useUpdateOffMarketSignaal.
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { OffMarketPriorityBadge } from '@/components/offmarket/OffMarketBadges';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import {
  PRIORITEIT_LABEL, PRIORITEIT_VOLGORDE,
  type OffMarketPrioriteit,
} from '@/lib/offMarket/types';

interface Props {
  signaalId: string;
  prioriteit: OffMarketPrioriteit;
}

export default function PrioriteitWijzigDropdown({ signaalId, prioriteit }: Props) {
  const update = useUpdateOffMarketSignaal();

  const zet = async (nieuw: OffMarketPrioriteit) => {
    if (nieuw === prioriteit || update.isPending) return;
    try {
      await update.mutateAsync({ id: signaalId, patch: { prioriteit: nieuw } });
      toast.success(`Prioriteit: ${PRIORITEIT_LABEL[nieuw]}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Prioriteit bijwerken mislukt');
    }
  };

  return (
    <Select value={prioriteit} onValueChange={(v) => zet(v as OffMarketPrioriteit)}>
      <SelectTrigger
        aria-label="Prioriteit wijzigen"
        data-testid="prioriteit-wijzig-dropdown"
        className="h-auto min-h-[36px] sm:min-h-[32px] w-auto gap-1.5 px-2 py-1 rounded-md border border-border bg-card/60 hover:border-accent/50 hover:bg-muted/60 focus:ring-1 focus:ring-ring focus:ring-offset-0 [&>svg]:hidden"
      >
        <span className="inline-flex items-center gap-1.5">
          <OffMarketPriorityBadge prioriteit={prioriteit} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {PRIORITEIT_VOLGORDE.map((p) => (
          <SelectItem key={p} value={p} data-testid={`prioriteit-optie-${p}`}>
            {PRIORITEIT_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
