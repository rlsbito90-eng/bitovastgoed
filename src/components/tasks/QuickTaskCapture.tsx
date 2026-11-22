import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CalendarDays, Check, Clock3, Link2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { createManualTaskWithReminder } from '@/lib/tasks/reminders';
import { updateTaskPlanning, reminderAfterTimeChange, type TaskPlanningBucket, type WorkReminderMode } from '@/lib/tasks/planning';
import WorkPlanReminderSelect from '@/components/tasks/WorkPlanReminderSelect';
import { replaceTaskLinks, type TaskLinkEntityType, type TaskLinkInput } from '@/lib/tasks/links';
import TaskLinksPickerDialog, {
  countTaskLinks,
  EMPTY_TASK_LINK_SELECTION,
  type TaskLinkSelection,
} from '@/components/tasks/TaskLinksPickerDialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type QuickTaskTarget = 'today' | 'open';

const TARGET_LABELS: Record<QuickTaskTarget, string> = {
  today: 'Vandaag', open: 'Niet ingepland',
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

function planningForTarget(target: QuickTaskTarget, customDate: string | null, planTime: string | null, reminderMode: WorkReminderMode = 'none') {
  let planDatum = customDate;
  let planningBucket: TaskPlanningBucket = 'open';
  if (!customDate) {
    if (target === 'today') planDatum = localDateKey(new Date());

  }
  return { planDatum, planTijd: planDatum ? planTime : null, planningBucket,
    reminderMode: planDatum ? reminderMode : 'none' as WorkReminderMode };
}

function planLabel(target: QuickTaskTarget, date: string | null, time: string | null) {
  let label = TARGET_LABELS[target];
  if (date) {
    const today = localDateKey(new Date());
    label = date === today
      ? 'Vandaag'
      : date === plusDays(1)
        ? 'Morgen'
        : new Date(`${date}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
  return time ? `${label} · ${time}` : label;
}

function dateLabel(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export default function QuickTaskCapture({ defaultTarget = 'open' }: { defaultTarget?: QuickTaskTarget }) {
  const { refresh } = useDataStore();
  const [titel, setTitel] = useState('');
  const [target, setTarget] = useState<QuickTaskTarget>(defaultTarget);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [planTime, setPlanTime] = useState<string | null>(null);
  const [workReminderMode, setWorkReminderMode] = useState<WorkReminderMode>('none');
  const [reminderTouched,setReminderTouched] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [deadlineTime, setDeadlineTime] = useState<string | null>(null);
  const [deadlineExpanded, setDeadlineExpanded] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [taskLinks, setTaskLinks] = useState<TaskLinkSelection>(EMPTY_TASK_LINK_SELECTION);
  // Een gedeeltelijk geslaagde opslag mag bij opnieuw proberen geen tweede taak creëren.
  const pendingTaskIdRef = useRef<string | null>(null);
  const linkCount = countTaskLinks(taskLinks);

  useEffect(() => {
    setTarget(defaultTarget);
    setPlanDate(null);
    setPlanTime(null);
    setWorkReminderMode('none');
    setReminderTouched(false);
  }, [defaultTarget]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = titel.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      const restoringExistingTask = Boolean(pendingTaskIdRef.current);
      const taskId = pendingTaskIdRef.current ?? await createManualTaskWithReminder({
        titel: trimmed,
        relatieId: taskLinks.relatie[0] || undefined,
        objectId: taskLinks.object[0] || undefined,
        dealId: taskLinks.deal[0] || undefined,
        offMarketSignaalId: taskLinks.signaal[0] || undefined,
        type: 'Algemeen',
        deadline: deadline || undefined,
        deadlineTijd: deadline ? (deadlineTime || undefined) : undefined,
        prioriteit: 'normaal',
        status: 'open',
        reminderSelection: 'default',
      }, planningForTarget(target, planDate, planTime, workReminderMode));
      pendingTaskIdRef.current = taskId;
      if (linkCount > 0) {
        const rows = (Object.entries(taskLinks) as [TaskLinkEntityType, string[]][])
          .flatMap(([entityType, ids]): TaskLinkInput[] => ids.map((entityId, index) => ({
            entityType, entityId, isPrimary: index === 0,
          })));
        await replaceTaskLinks(taskId, rows);
      }
      // Alleen bij opnieuw proberen is een tweede planning-update nodig.
      // Nieuwe taken krijgen hun werkdatum atomair in dezelfde insert.
      if (restoringExistingTask) {
        await updateTaskPlanning(taskId, planningForTarget(target, planDate, planTime, workReminderMode));
      }
      await refresh();
      pendingTaskIdRef.current = null;
      setTitel('');
      setTaskLinks({ relatie: [], object: [], deal: [], signaal: [] });
      setWorkReminderMode('none');
      setReminderTouched(false);
      setDeadline(null);
      setDeadlineTime(null);
      setDeadlineExpanded(false);
      toast.success(`Toegevoegd · ${planLabel(target, planDate, planTime)}`);
    } catch (error: any) {
      toast.error(pendingTaskIdRef.current
        ? `Taak bestaat al, maar koppelingen of planning zijn niet volledig opgeslagen. Probeer opnieuw: ${error?.message ?? 'onbekende fout'}`
        : `Taak toevoegen mislukt: ${error?.message ?? 'onbekende fout'}`);
    } finally {
      setSaving(false);
    }
  };

  const today = localDateKey(new Date());
  const tomorrow = plusDays(1);
  const effectivePlanDate = planDate || (target === 'today' ? today : null);

  const choose = (value: 'today' | 'tomorrow' | 'open') => {
    if (value === 'today') {
      setTarget('today');
      setPlanDate(today);
      return;
    }
    if (value === 'tomorrow') {
      setTarget('open');
      setPlanDate(tomorrow);
      return;
    }
    if (value === 'open') {
      setTarget('open');
      setPlanDate(null);
      setPlanTime(null);
      setWorkReminderMode('none');
      setReminderTouched(false);
      return;
    }
  };

  const selectedChoice = planDate === tomorrow
    ? 'tomorrow'
    : planDate === today || (!planDate && target === 'today')
      ? 'today'
      : !planDate && target === 'open'
        ? 'open'
        : null;

  return (
    <>
      <form
        onSubmit={submit}
        data-testid="quick-task-capture"
        className="flex min-w-0 items-center gap-2 rounded-[1.4rem] p-2"
      >
        <button type="button" onClick={() => setLinksOpen(true)} disabled={saving}
          aria-label={linkCount ? `Koppelingen wijzigen, ${linkCount} gekoppeld` : 'Relatie, object of deal koppelen'}
          title="Relatie, object of deal koppelen"
          className="relative inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Link2 className={`h-4 w-4 ${linkCount ? 'text-accent' : ''}`} />
          {linkCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">{linkCount}</span>}
        </button>
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
          onClick={() => setPlanningOpen(true)}
          aria-label="Planning kiezen"
          className="quick-task-plan-button h-11 max-w-[124px] shrink-0 rounded-2xl px-3 text-xs font-medium outline-none sm:max-w-none"
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
        <DialogContent
          className="quick-task-planning-sheet !left-3 !right-3 !bottom-[max(.75rem,env(safe-area-inset-bottom))] !top-auto !w-auto !translate-x-0 !translate-y-0 gap-3 rounded-[1.75rem] p-4 sm:!left-1/2 sm:!right-auto sm:!top-1/2 sm:!bottom-auto sm:!w-full sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:rounded-2xl sm:p-5"
          style={{ maxWidth: '28rem' }}
        >
          <DialogHeader className="pr-12">
            <DialogTitle>Wanneer?</DialogTitle>
            <DialogDescription>Plan wanneer je eraan wilt werken. Een deadline is alleen nodig als er echt een uiterste datum is.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {([
              ['today', 'Vandaag'],
              ['tomorrow', 'Morgen'],
              ['open', 'Niet ingepland'],
            ] as const).map(([value, label]) => {
              const selected = selectedChoice === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => choose(value)}
                  className={`flex h-11 items-center justify-between rounded-xl border px-3 text-sm transition-colors ${
                    selected
                      ? 'border-foreground/20 bg-foreground/[0.07] text-foreground'
                      : 'border-border/65 bg-background/25 text-foreground/90 hover:bg-muted/25'
                  }`}
                >
                  <span>{label}</span>
                  {selected ? <Check className="h-4 w-4 text-accent" /> : null}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PickerField
              type="date"
              label="Datum"
              display={dateLabel(effectivePlanDate, 'Kies datum')}
              value={effectivePlanDate ?? ''}
              icon={<CalendarDays className="h-4 w-4" />}
              onChange={(value) => {
                setTarget('open');
                setPlanDate(value || null);
                if (!value) {
                  setPlanTime(null);
                  setWorkReminderMode('none');
                }
              }}
              onClear={effectivePlanDate ? () => {
                setTarget('open');
                setPlanDate(null);
                setPlanTime(null);
                setWorkReminderMode('none');
              } : undefined}
              clearLabel="Datum wissen"
            />
            <PickerField
              type="time"
              label="Tijd"
              display={planTime || 'Kies tijd'}
              value={planTime ?? ''}
              disabled={!effectivePlanDate}
              icon={<Clock3 className="h-4 w-4" />}
              onChange={(value) => {
                setPlanTime(value || null);
                setWorkReminderMode(reminderAfterTimeChange(workReminderMode,planTime,value,reminderTouched));
              }}
              onClear={planTime ? () => {
                setPlanTime(null);
                setWorkReminderMode(reminderAfterTimeChange(workReminderMode,planTime,null,reminderTouched));
              } : undefined}
              clearLabel="Tijd wissen"
            />
          </div>

          <WorkPlanReminderSelect value={workReminderMode}
            hasDate={Boolean(effectivePlanDate)} hasTime={Boolean(planTime)}
            onChange={mode=>{setReminderTouched(true);setWorkReminderMode(mode);}} />

          {!deadlineExpanded ? (
            <button
              type="button"
              onClick={() => setDeadlineExpanded(true)}
              className="flex h-10 items-center gap-2 rounded-xl px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Harde deadline toevoegen
            </button>
          ) : (
            <section className="rounded-2xl border border-border/60 bg-background/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Harde deadline</p>
                  <p className="text-xs text-muted-foreground">Alleen gebruiken als dit echt de uiterste datum is.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeadline(null);
                    setDeadlineTime(null);
                    setDeadlineExpanded(false);
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Verwijder
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PickerField
                  type="date"
                  label="Deadline"
                  display={dateLabel(deadline, 'Kies datum')}
                  value={deadline ?? ''}
                  icon={<CalendarDays className="h-4 w-4" />}
                  onChange={(value) => {
                    setDeadline(value || null);
                    if (!value) setDeadlineTime(null);
                  }}
                  onClear={deadline ? () => {
                    setDeadline(null);
                    setDeadlineTime(null);
                  } : undefined}
                  clearLabel="Deadline wissen"
                />
                <PickerField
                  type="time"
                  label="Tijd"
                  display={deadlineTime || 'Kies tijd'}
                  value={deadlineTime ?? ''}
                  disabled={!deadline}
                  icon={<Clock3 className="h-4 w-4" />}
                  onChange={(value) => setDeadlineTime(value || null)}
                  onClear={deadlineTime ? () => setDeadlineTime(null) : undefined}
                  clearLabel="Deadlinetijd wissen"
                />
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => setPlanningOpen(false)}
            className="h-11 rounded-xl bg-foreground text-sm font-medium text-background"
          >
            Gereed
          </button>
        </DialogContent>
      </Dialog>
      {linksOpen && <TaskLinksPickerDialog open={linksOpen}
        title="Koppelen aan taak" onOpenChange={setLinksOpen}
        value={taskLinks} onChange={setTaskLinks} />}
    </>
  );
}

function PickerField({
  type,
  label,
  display,
  value,
  onChange,
  icon,
  disabled = false,
  onClear,
  clearLabel,
}: {
  type: 'date' | 'time';
  label: string;
  display: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  disabled?: boolean;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className={`relative block min-w-0 rounded-xl border border-border/65 bg-background/25 px-3 py-2.5 ${onClear ? 'pr-10' : ''} ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate">{display}</span>
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
      {onClear && !disabled ? (
        <button
          type="button"
          aria-label={clearLabel || `${label} wissen`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
          className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
