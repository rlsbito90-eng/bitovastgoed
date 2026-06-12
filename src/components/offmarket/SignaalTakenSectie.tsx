// Taken die zijn gekoppeld aan een off-market signaal.
// Reuse: TaakFormDialog met defaultOffMarketSignaalId.
import { useMemo, useState } from 'react';
import { Plus, CheckSquare, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import { PrioriteitBadge } from '@/components/StatusBadges';
import { deadlineLabel, isTaakTeLaat } from '@/lib/taakHelpers';
import { bouwSignaalTaakContext } from '@/lib/offMarket/eigenaar';
import type { Taak } from '@/data/mock-data';

interface Props {
  signaalId: string;
}

export default function SignaalTakenSectie({ signaalId }: Props) {
  const { taken } = useDataStore();
  const { data: signaal } = useOffMarketSignaal(signaalId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Taak | null>(null);

  const lijst = useMemo(
    () =>
      taken
        .filter((t) => t.offMarketSignaalId === signaalId)
        .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')),
    [taken, signaalId],
  );

  return (
    <section className="section-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          Taken ({lijst.length})
        </h2>
        <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nieuwe taak
        </Button>
      </div>

      {lijst.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen taken gekoppeld aan dit signaal.</p>
      ) : (
        <ul className="divide-y divide-border/70 -mx-2">
          {lijst.map((t) => (
            <li key={t.id} className="px-2 py-2.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => { setEditing(t); setOpen(true); }}
                className="text-left min-w-0 flex-1 hover:text-accent"
              >
                <p className="text-sm text-foreground truncate flex items-center gap-1.5">
                  {t.titel}
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                </p>
                <p
                  className={`text-xs mt-0.5 tabular-nums ${
                    isTaakTeLaat(t) ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {deadlineLabel(t)}{isTaakTeLaat(t) ? ' · te laat' : ''} · {t.status}
                </p>
              </button>
              <PrioriteitBadge prioriteit={t.prioriteit} />
            </li>
          ))}
        </ul>
      )}

      <TaakFormDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        taak={editing}
        defaultOffMarketSignaalId={signaalId}
      />
    </section>
  );
}
