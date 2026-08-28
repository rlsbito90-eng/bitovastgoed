import { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import type { TaskLinkEntityType } from '@/lib/tasks/links';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type TaskLinkSelection = Record<TaskLinkEntityType, string[]>;

export const EMPTY_TASK_LINK_SELECTION: TaskLinkSelection = {
  relatie: [], deal: [], object: [], signaal: [],
};

export function countTaskLinks(value: TaskLinkSelection): number {
  return Object.values(value).reduce((sum, ids) => sum + ids.length, 0);
}

export function taskLinkSelectionFromLegacy(input: {
  relatieId?: string | null;
  dealId?: string | null;
  objectId?: string | null;
  offMarketSignaalId?: string | null;
}): TaskLinkSelection {
  return {
    relatie: input.relatieId ? [input.relatieId] : [],
    deal: input.dealId ? [input.dealId] : [],
    object: input.objectId ? [input.objectId] : [],
    signaal: input.offMarketSignaalId ? [input.offMarketSignaalId] : [],
  };
}

export default function TaskLinksPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TaskLinkSelection;
  onChange: (next: TaskLinkSelection) => void;
}) {
  const { relaties, deals, objecten, getObjectById } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalen();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const total = countTaskLinks(value);

  const groups = useMemo(() => ([
    {
      type: 'relatie' as const,
      label: 'Relaties',
      rows: relaties.map((r: any) => ({ id: r.id, label: r.bedrijfsnaam || r.naam || r.email || 'Relatie' })),
    },
    {
      type: 'deal' as const,
      label: 'Deals',
      rows: deals.map((d: any) => ({
        id: d.id,
        label: getObjectById(d.objectId)?.titel || getObjectById(d.objectId)?.adres || d.titel || `Deal ${String(d.id).slice(0, 8)}`,
      })),
    },
    {
      type: 'object' as const,
      label: 'Objecten',
      rows: objecten.map((o: any) => ({ id: o.id, label: o.titel || o.adres || o.straat || 'Object' })),
    },
    {
      type: 'signaal' as const,
      label: 'Radar-signalen',
      rows: signalen.map((s: any) => ({ id: s.id, label: s.titel || s.adres || s.omschrijving || 'Radar-signaal' })),
    },
  ]), [relaties, deals, objecten, signalen, getObjectById]);

  const toggle = (type: TaskLinkEntityType, id: string) => {
    const current = value[type];
    onChange({
      ...value,
      [type]: current.includes(id) ? current.filter(x => x !== id) : [...current, id],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle>Koppelingen bewerken</DialogTitle>
          <DialogDescription>
            Koppel één of meerdere relaties, deals, objecten en Radar-signalen aan deze taak.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Zoek relatie, deal, object of signaal…"
              className="h-11 w-full rounded-xl border border-border bg-background/55 pl-9 pr-3 text-sm text-foreground outline-none focus:border-foreground/25"
            />
          </div>

          {groups.map(group => {
            const rows = group.rows
              .filter(row => !q || row.label.toLowerCase().includes(q))
              .slice(0, 30);
            if (rows.length === 0) return null;
            return (
              <section key={group.type} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  <span className="text-xs text-muted-foreground">{value[group.type].length}</span>
                </div>
                <div className="divide-y divide-border/55 overflow-hidden rounded-xl border border-border/70 bg-background/30">
                  {rows.map(row => (
                    <label key={row.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/25">
                      <input
                        type="checkbox"
                        checked={value[group.type].includes(row.id)}
                        onChange={() => toggle(group.type, row.id)}
                        className="h-4 w-4"
                      />
                      <span className="min-w-0 truncate">{row.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-11 rounded-xl bg-foreground text-sm font-medium text-background"
        >
          Gereed · {total} gekoppeld
        </button>
      </DialogContent>
    </Dialog>
  );
}
