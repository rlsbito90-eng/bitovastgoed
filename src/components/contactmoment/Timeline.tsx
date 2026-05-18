// src/components/contactmoment/Timeline.tsx
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Activity, MessageSquare } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  TIMELINE_CATEGORY_LABELS,
  categoryOf,
  groupHeaderDate,
  type ContactMoment,
  type TimelineCategory,
} from '@/lib/contactMoments';
import TimelineItem from './TimelineItem';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import LogActionDropdown from './LogActionDropdown';

interface Props {
  relatieId?: string;
  objectId?: string;
  dealId?: string;
  acquisitieTargetId?: string;
}

const CATEGORIES: TimelineCategory[] = ['alle', 'contact', 'notities', 'taken', 'documenten', 'biedingen', 'systeem'];

export default function Timeline({ relatieId, objectId, dealId, acquisitieTargetId }: Props) {
  const store = useDataStore();
  const [filter, setFilter] = useState<TimelineCategory>('alle');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ContactMoment | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const contextEntity = relatieId ? 'relatie' : objectId ? 'object' : dealId ? 'deal' : acquisitieTargetId ? 'acquisitie' : undefined;

  const items = useMemo(() => {
    return store.getContactMomentsFor({ relatieId, objectId, dealId, acquisitieTargetId });
  }, [store, relatieId, objectId, dealId, acquisitieTargetId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => {
      if (filter !== 'alle' && categoryOf(i.type) !== filter) return false;
      if (!q) return true;
      const hay = `${i.title} ${i.description ?? ''} ${i.outcome ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  // Group by ISO date
  const groups = useMemo(() => {
    const m = new Map<string, ContactMoment[]>();
    for (const it of filtered) {
      const arr = m.get(it.momentDate) ?? [];
      arr.push(it);
      m.set(it.momentDate, arr);
    }
    // already sorted globally; preserve insertion order which is desc
    return Array.from(m.entries());
  }, [filtered]);

  const openEdit = (item: ContactMoment) => {
    setEditing(item);
    setEditOpen(true);
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="section-title flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Tijdlijn
        </h2>
        <LogActionDropdown
          relatieId={relatieId}
          objectId={objectId}
          dealId={dealId}
          acquisitieTargetId={acquisitieTargetId}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Zoek in tijdlijn…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                filter === c
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {TIMELINE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
          {items.length === 0
            ? 'Nog geen tijdlijnitems. Log een contactmoment om te starten.'
            : 'Geen items voor dit filter.'}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([date, list]) => (
            <div key={date}>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium pl-7 mb-1">
                {groupHeaderDate(date)}
              </p>
              <div className="space-y-0.5">
                {list.map(it => (
                  <TimelineItem key={it.id} item={it} onEdit={openEdit} contextEntity={contextEntity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ContactMomentFormDialog
          open={editOpen}
          onOpenChange={(v) => { setEditOpen(v); if (!v) setEditing(null); }}
          contactMoment={editing}
        />
      )}
    </section>
  );
}
