// Inline prioriteit-dropdown voor Signaal-Cockpit.
// Trigger = OffMarketPriorityBadge (pill). Gebruikt bestaande
// useUpdateOffMarketSignaal — geen nieuwe API, geen schemawijziging.
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
        className="h-auto w-auto p-0 border-0 bg-transparent hover:opacity-80 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
      >
        <OffMarketPriorityBadge prioriteit={prioriteit} />
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
