// Tijdlijn van contactmomenten gekoppeld aan een off-market signaal.
import { useMemo, useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import TimelineItem from '@/components/contactmoment/TimelineItem';
import { useDataStore } from '@/hooks/useDataStore';
import { groupHeaderDate, type ContactMoment } from '@/lib/contactMoments';

interface Props {
  signaalId: string;
}

export default function SignaalTijdlijnSectie({ signaalId }: Props) {
  const store = useDataStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContactMoment | null>(null);

  const items = useMemo(
    () => store.getContactMomentsFor({ offMarketSignaalId: signaalId }),
    [store, signaalId],
  );

  const groups = useMemo(() => {
    const m = new Map<string, ContactMoment[]>();
    for (const it of items) {
      const arr = m.get(it.momentDate) ?? [];
      arr.push(it);
      m.set(it.momentDate, arr);
    }
    return Array.from(m.entries());
  }, [items]);

  return (
    <section className="section-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Tijdlijn ({items.length})
        </h2>
        <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Log contact
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen contactmomenten voor dit signaal.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, list]) => (
            <div key={date}>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium pl-7 mb-1">
                {groupHeaderDate(date)}
              </p>
              <div className="space-y-0.5">
                {list.map((it) => (
                  <TimelineItem
                    key={it.id}
                    item={it}
                    onEdit={(item) => { setEditing(item); setOpen(true); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContactMomentFormDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        contactMoment={editing}
        defaultOffMarketSignaalId={signaalId}
      />
    </section>
  );
}
