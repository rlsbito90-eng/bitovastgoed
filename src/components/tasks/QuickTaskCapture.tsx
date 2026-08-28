import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, CalendarDays, Clock3, Link2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { createManualTaskWithReminder } from '@/lib/tasks/reminders';
import { updateTaskPlanning, type TaskPlanningBucket } from '@/lib/tasks/planning';
import { replaceTaskLinks, type TaskLinkEntityType } from '@/lib/tasks/links';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type QuickTaskTarget = 'today' | 'inbox' | 'open' | 'later';

type LinkedSelection = Record<TaskLinkEntityType, string[]>;

const EMPTY_LINKS: LinkedSelection = { relatie: [], deal: [], object: [], signaal: [] };
const TARGET_LABELS: Record<QuickTaskTarget, string> = {
  today: 'Vandaag', inbox: 'Inbox', open: 'Openstaand', later: 'Later',
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function planningForTarget(target: QuickTaskTarget, customDate: string | null, planTime: string | null) {
  let planDatum = customDate;
  let planningBucket: TaskPlanningBucket = 'open';
  if (!customDate) {
    if (target === 'today') planDatum = localDateKey(new Date());
    if (target === 'inbox') planningBucket = 'inbox';
    if (target === 'later') planningBucket = 'later';
  }
  return { planDatum, planTijd: planDatum ? planTime : null, planningBucket };
}

function planLabel(target: QuickTaskTarget, date: string | null, time: string | null) {
  let label = TARGET_LABELS[target];
  if (date) {
    const today = localDateKey(new Date());
    label = date === today ? 'Vandaag' : date === plusDays(1) ? 'Morgen' : new Date(`${date}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
  return time ? `${label} · ${time}` : label;
}

export default function QuickTaskCapture({ defaultTarget = 'inbox' }: { defaultTarget?: QuickTaskTarget }) {
  const { refresh } = useDataStore();
  const [titel, setTitel] = useState('');
  const [target, setTarget] = useState<QuickTaskTarget>(defaultTarget);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [planTime, setPlanTime] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [deadlineTime, setDeadlineTime] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkedSelection>(EMPTY_LINKS);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTarget(defaultTarget);
    setPlanDate(null);
    setPlanTime(null);
  }, [defaultTarget]);

  const linkCount = Object.values(links).reduce((sum, ids) => sum + ids.length, 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = titel.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      const taskId = await createManualTaskWithReminder({
        titel: trimmed,
        relatieId: links.relatie[0],
        dealId: links.deal[0],
        objectId: links.object[0],
        offMarketSignaalId: links.signaal[0],
        type: 'Algemeen',
        deadline: deadline || undefined,
        deadlineTijd: deadline ? (deadlineTime || undefined) : undefined,
        prioriteit: 'normaal',
        status: 'open',
        reminderSelection: 'default',
      });
      await updateTaskPlanning(taskId, planningForTarget(target, planDate, planTime));

      const linkRows = (Object.entries(links) as [TaskLinkEntityType, string[]][]).flatMap(([entityType, ids]) =>
        ids.map((entityId, index) => ({ entityType, entityId, isPrimary: index === 0 })),
      );
      if (linkRows.length > 0) await replaceTaskLinks(taskId, linkRows);

      await refresh();
      setTitel('');
      setLinks(EMPTY_LINKS);
      setDeadline(null);
      setDeadlineTime(null);
      toast.success(`Toegevoegd · ${planLabel(target, planDate, planTime)}`);
    } catch (error: any) {
      toast.error(`Taak toevoegen mislukt: ${error?.message ?? 'onbekende fout'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form
        onSubmit={submit}
        data-testid="quick-task-capture"
        className="glass-card flex min-w-0 items-center gap-2 rounded-[1.4rem] border border-white/10 bg-background/72 p-2 shadow-xl shadow-black/10 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/62"
      >
        <Plus className="ml-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={titel}
          onChange={(event) => setTitel(event.target.value)}
          placeholder="Voeg snel een taak toe…"
          aria-label="Nieuwe taak"
          className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => setLinksOpen(true)}
          aria-label="CRM-context koppelen"
          className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 text-xs font-medium text-muted-foreground backdrop-blur-xl hover:text-foreground sm:inline-flex"
        >
          <Link2 className="h-3.5 w-3.5" />{linkCount ? linkCount : 'Koppelen'}
        </button>
        <button
          type="button"
          onClick={() => setPlanningOpen(true)}
          aria-label="Planning kiezen"
          className="h-11 max-w-[132px] shrink-0 rounded-2xl border border-white/10 bg-muted/35 px-3 text-xs font-medium text-foreground/85 shadow-inner outline-none backdrop-blur-xl hover:bg-muted/50 dark:bg-white/[0.07] dark:text-foreground dark:border-white/10 sm:max-w-none"
        >
          {planLabel(target, planDate, planTime)}
        </button>
        <button
          type="submit"
          aria-label="Taak toevoegen"
          disabled={!titel.trim() || saving}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform hover:scale-[1.03] disabled:opacity-35"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>

      <Dialog open={planningOpen} onOpenChange={setPlanningOpen}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Wanneer?</DialogTitle>
            <DialogDescription>Werkplanning staat los van de harde deadline.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {([
              ['today', 'Vandaag'], ['tomorrow', 'Morgen'], ['open', 'Openstaand'], ['later', 'Later'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className="flex h-11 items-center justify-between rounded-xl border border-border/70 bg-card/45 px-3 text-sm hover:bg-muted/40" onClick={() => {
                if (value === 'today') { setTarget('today'); setPlanDate(localDateKey(new Date())); }
                if (value === 'tomorrow') { setTarget('open'); setPlanDate(plusDays(1)); }
                if (value === 'open') { setTarget('open'); setPlanDate(null); setPlanTime(null); }
                if (value === 'later') { setTarget('later'); setPlanDate(null); setPlanTime(null); }
              }}>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground"><span>Datum</span><input type="date" value={planDate ?? ''} onChange={e => { setTarget('open'); setPlanDate(e.target.value || null); }} className="h-11 w-full rounded-xl border border-border bg-card/55 px-3 text-foreground" /></label>
            <label className="space-y-1 text-xs text-muted-foreground"><span>Tijd</span><input type="time" value={planTime ?? ''} disabled={!planDate && target !== 'today'} onChange={e => setPlanTime(e.target.value || null)} className="h-11 w-full rounded-xl border border-border bg-card/55 px-3 text-foreground disabled:opacity-45" /></label>
          </div>
          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optionele deadline</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={deadline ?? ''} onChange={e => setDeadline(e.target.value || null)} className="h-11 rounded-xl border border-border bg-card/55 px-3 text-sm text-foreground" />
              <input type="time" value={deadlineTime ?? ''} disabled={!deadline} onChange={e => setDeadlineTime(e.target.value || null)} className="h-11 rounded-xl border border-border bg-card/55 px-3 text-sm text-foreground disabled:opacity-45" />
            </div>
          </div>
          <button type="button" onClick={() => setPlanningOpen(false)} className="h-11 rounded-xl bg-foreground text-sm font-medium text-background">Gereed</button>
        </DialogContent>
      </Dialog>

      <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Koppelen aan CRM</DialogTitle>
            <DialogDescription>Selecteer één of meerdere relaties, deals, objecten of Radar-signalen.</DialogDescription>
          </DialogHeader>
          {linksOpen && <ContextPicker value={links} onChange={setLinks} />}
          <button type="button" onClick={() => setLinksOpen(false)} className="h-11 rounded-xl bg-foreground text-sm font-medium text-background">Gereed · {linkCount} gekoppeld</button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContextPicker({ value, onChange }: { value: LinkedSelection; onChange: (next: LinkedSelection) => void }) {
  const { relaties, deals, objecten, getObjectById } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalen();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => ([
    { type: 'relatie' as const, label: 'Relaties', rows: relaties.map((r: any) => ({ id: r.id, label: r.bedrijfsnaam || r.naam || r.email || 'Relatie' })) },
    { type: 'deal' as const, label: 'Deals', rows: deals.map((d: any) => ({ id: d.id, label: getObjectById(d.objectId)?.titel || d.titel || `Deal ${String(d.id).slice(0, 8)}` })) },
    { type: 'object' as const, label: 'Objecten', rows: objecten.map((o: any) => ({ id: o.id, label: o.titel || o.adres || o.straat || 'Object' })) },
    { type: 'signaal' as const, label: 'Radar-signalen', rows: signalen.map((s: any) => ({ id: s.id, label: s.titel || s.adres || s.omschrijving || 'Radar-signaal' })) },
  ]), [relaties, deals, objecten, signalen, getObjectById]);

  const toggle = (type: TaskLinkEntityType, id: string) => {
    const current = value[type];
    onChange({ ...value, [type]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  };

  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Zoek relatie, deal, object of signaal…" className="h-11 w-full rounded-xl border border-border bg-card/55 px-3 text-sm text-foreground outline-none" />
      {groups.map(group => {
        const rows = group.rows.filter(row => !q || row.label.toLowerCase().includes(q)).slice(0, 20);
        if (rows.length === 0) return null;
        return <section key={group.type} className="space-y-1.5">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p><span className="text-xs text-muted-foreground">{value[group.type].length}</span></div>
          <div className="rounded-xl border border-border/70 bg-card/35 divide-y divide-border/60 overflow-hidden">
            {rows.map(row => <label key={row.id} className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30"><input type="checkbox" checked={value[group.type].includes(row.id)} onChange={() => toggle(group.type, row.id)} /><span className="min-w-0 truncate">{row.label}</span></label>)}
          </div>
        </section>;
      })}
    </div>
  );
}
