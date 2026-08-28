import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { createManualTaskWithReminder } from '@/lib/tasks/reminders';
import { updateTaskPlanning, type TaskPlanningBucket } from '@/lib/tasks/planning';

export type QuickTaskTarget = 'today' | 'inbox' | 'open' | 'later';

const TARGET_LABELS: Record<QuickTaskTarget, string> = {
  today: 'Vandaag',
  inbox: 'Inbox',
  open: 'Openstaand',
  later: 'Later',
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function planningForTarget(target: QuickTaskTarget): {
  planDatum: string | null;
  planningBucket: TaskPlanningBucket;
} {
  if (target === 'today') {
    return { planDatum: localDateKey(new Date()), planningBucket: 'open' };
  }
  if (target === 'inbox') return { planDatum: null, planningBucket: 'inbox' };
  if (target === 'later') return { planDatum: null, planningBucket: 'later' };
  return { planDatum: null, planningBucket: 'open' };
}

export default function QuickTaskCapture({ defaultTarget = 'inbox' }: { defaultTarget?: QuickTaskTarget }) {
  const { refresh } = useDataStore();
  const [titel, setTitel] = useState('');
  const [target, setTarget] = useState<QuickTaskTarget>(defaultTarget);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTarget(defaultTarget);
  }, [defaultTarget]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = titel.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      const taskId = await createManualTaskWithReminder({
        titel: trimmed,
        type: 'Algemeen',
        prioriteit: 'normaal',
        status: 'open',
        reminderSelection: 'default',
      });
      await updateTaskPlanning(taskId, planningForTarget(target));
      await refresh();
      setTitel('');
      toast.success(`Toegevoegd aan ${TARGET_LABELS[target]}`);
    } catch (error: any) {
      toast.error(`Taak toevoegen mislukt: ${error?.message ?? 'onbekende fout'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="quick-task-capture"
      className="section-card flex min-w-0 items-center gap-2 p-2 sm:p-2.5"
    >
      <Plus className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        value={titel}
        onChange={(event) => setTitel(event.target.value)}
        placeholder="Voeg snel een taak toe…"
        aria-label="Nieuwe taak"
        className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        disabled={saving}
      />
      <select
        value={target}
        onChange={(event) => setTarget(event.target.value as QuickTaskTarget)}
        aria-label="Werkbak voor nieuwe taak"
        className="h-9 max-w-[116px] shrink-0 rounded-md border border-border bg-card px-2 text-xs font-medium text-muted-foreground outline-none focus:border-foreground/30 sm:max-w-none"
        disabled={saving}
      >
        <option value="today">Vandaag</option>
        <option value="inbox">Inbox</option>
        <option value="open">Openstaand</option>
        <option value="later">Later</option>
      </select>
      <button
        type="submit"
        disabled={!titel.trim() || saving}
        className="hidden h-9 shrink-0 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity disabled:opacity-40 sm:inline-flex"
      >
        {saving ? 'Opslaan…' : 'Toevoegen'}
      </button>
    </form>
  );
}
