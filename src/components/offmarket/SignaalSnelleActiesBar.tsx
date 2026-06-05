// Compacte snelle-actiebalk voor signaal-detailpagina.
// Mobiel: sticky onder de header. Hergebruikt useUpdateOffMarketSignaal.
import { toast } from 'sonner';
import { Heart, HelpCircle, X, Search, UserSearch } from 'lucide-react';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import type { OffMarketSignaal, OffMarketStatus } from '@/lib/offMarket/types';
import { STATUS_LABEL } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

interface Actie {
  status: OffMarketStatus;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const ACTIES: Actie[] = [
  { status: 'interessant',          label: 'Interessant',         Icon: Heart },
  { status: 'twijfel',              label: 'Twijfel',             Icon: HelpCircle },
  { status: 'niet_interessant',     label: 'Niet interessant',    Icon: X },
  { status: 'te_onderzoeken',       label: 'Start onderzoek',     Icon: Search },
  { status: 'eigenaar_achterhalen', label: 'Eigenaar achterhalen', Icon: UserSearch },
];

export default function SignaalSnelleActiesBar({ signaal }: Props) {
  const update = useUpdateOffMarketSignaal();

  const setStatus = async (status: OffMarketStatus) => {
    if (signaal.status === status || update.isPending) return;
    try {
      await update.mutateAsync({ id: signaal.id, patch: { status } });
      toast.success(`Status: ${STATUS_LABEL[status]}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Status bijwerken mislukt');
    }
  };

  return (
    <div
      data-testid="signaal-snelle-acties"
      className="sticky top-0 z-20 -mx-4 sm:mx-0 sm:static px-4 sm:px-0 py-2 sm:py-0 bg-background/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none border-b sm:border-0 border-border/60"
    >
      <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 sm:mx-0 sm:px-0">
        {ACTIES.map(({ status, label, Icon }) => {
          const actief = signaal.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={actief}
              disabled={actief || update.isPending}
              onClick={() => setStatus(status)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap ${
                actief
                  ? 'bg-accent text-accent-foreground border-accent cursor-default'
                  : 'bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
