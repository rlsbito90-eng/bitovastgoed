// Inline eigenaarstatus-dropdown voor Signaal-Cockpit.
// Trigger = OffMarketEigenaarstatusBadge (pill). Gebruikt bestaande
// useUpdateOffMarketSignaal — geen nieuwe API, geen schemawijziging.
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
        className="h-auto w-auto p-0 border-0 bg-transparent hover:opacity-80 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
      >
        <OffMarketEigenaarstatusBadge status={eigenaarstatus} />
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
