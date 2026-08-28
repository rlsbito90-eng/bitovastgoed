import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, CheckCircle2, Circle, Clock, MoreHorizontal,
  ExternalLink, ListChecks, SlidersHorizontal, Sunrise, Sun, Moon,
  CheckSquare, Square, X, CalendarDays, Trash2,
} from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import type { TaakPrioriteit, TaakStatus, Taak } from '@/data/mock-data';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import TaakAfrondenDialog from '@/components/forms/TaakAfrondenDialog';
import QuickTaskCapture from '@/components/tasks/QuickTaskCapture';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { isTaakTeLaat, deadlineLabel, TAAK_TYPES } from '@/lib/taakHelpers';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SortDropdown from '@/components/SortDropdown';
import { useSortPreference } from '@/hooks/useSortPreference';
import { byDate, byNumber, byString, combine } from '@/lib/sorting/comparators';
import { smartTaakCompare, getTaakDeadlineMs, getTaakPrioriteitRank } from '@/lib/sorting/urgency';
import type { SortOption } from '@/lib/sorting/types';
import { maakCrmReturnState } from '@/lib/crmReturnContext';
import { loadTakenViewState, saveTakenViewState, type TakenTab } from '@/lib/takenViewState';
import {
  listTaskPlanning,
  taskPlanningMap,
  updateTaskPlanning,
  type TaskPlanningMeta,
  type TaskPlanningBucket,
} from '@/lib/tasks/planning';
import {
  isOpenTaskStatus,
  isTaskOverdue,
  isTaskPlannedToday,
  isTaskInTodayView,
  isTaskUpcoming,
  localDateKey,
  planningForTask,
  taskSourceLabel,
  taskWorkDate,
} from '@/lib/tasks/workView';
import {
  bulkUpdateTaskPlanning,
  bulkUpdateTaskPriority,
  bulkUpdateTaskStatus,
} from '@/lib/tasks/bulk';

const TABS: { value: TakenTab; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'vandaag', label: 'Vandaag' },
  { value: 'komend', label: 'Komend' },
  { value: 'openstaand', label: 'Openstaand' },
  { value: 'later', label: 'Later' },
  { value: 'wachten', label: 'Wachten' },
  { value: 'alles', label: 'Alles' },
  { value: 'afgerond', label: 'Afgerond' },
];

function taskTime(task: Taak): string | null {
  const raw = (task as any).deadlineTijd ?? (task as any).deadline_tijd;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.slice(0, 5);
}

function taskHour(task: Taak): number | null {
  const time = taskTime(task);
  if (!time) return null;
  const hour = Number(time.slice(0, 2));
  return Number.isFinite(hour) ? hour : null;
}

function planDateLabel(value: string, today: string): string {
  if (value === today) return 'Gepland vandaag';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === localDateKey(tomorrow)) return 'Gepland morgen';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return `Gepland ${value}`;
  return `Gepland ${parsed.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
}

function upcomingGroupLabel(value: string, today: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === localDateKey(tomorrow)) return 'Morgen';
  return parsed.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function TakenPage() {
  const { taken, getRelatieById, getDealById, getObjectById, updateTaak, deleteTaak, contactpersonen, refresh } = useDataStore();
  const initialView = useMemo(() => loadTakenViewState(), []);
  const [zoek, setZoek] = useState(initialView.zoek);
  const [prioriteitFilter, setPrioriteitFilter] = useState<TaakPrioriteit | ''>(initialView.prioriteitFilter);
  const [typeFilter, setTypeFilter] = useState(initialView.typeFilter);
  const [statusFilter, setStatusFilter] = useState<TaakStatus | ''>(initialView.statusFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<Taak | null>(null);
  const [afrondenTaak, setAfrondenTaak] = useState<Taak | null>(null);
  const [verwijderTaak, setVerwijderTaak] = useState<Taak | null>(null);
  const [tab, setTab] = useState<TakenTab>(initialView.tab);
  const [planningRows, setPlanningRows] = useState<TaskPlanningMeta[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    saveTakenViewState({ zoek, prioriteitFilter, typeFilter, statusFilter, tab });
  }, [zoek, prioriteitFilter, typeFilter, statusFilter, tab]);

  useEffect(() => {
    let cancelled = false;
    void listTaskPlanning()
      .then(rows => { if (!cancelled) setPlanningRows(rows); })
      .catch(error => console.error('Taakplanning laden mislukt', error));
    return () => { cancelled = true; };
  }, [taken.length]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    if (taken.some(x => x.id === openId)) {
      navigate(`/taken/${openId}`, {
        replace: true,
        state: maakCrmReturnState('/taken', 'Mijn werk', 'taken-lijst'),
      });
    } else {
      toast.error('Taak niet gevonden');
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, taken, navigate, setSearchParams]);

  useEffect(() => {
    setSelectedIds(new Set());
    setShowAllOverdue(false);
  }, [tab]);

  const now = new Date();
  const today = localDateKey(now);
  const planningById = useMemo(() => taskPlanningMap(planningRows), [planningRows]);
  const planningFor = (task: Taak) => planningForTask(task, planningById);

  const sortOptions = useMemo<SortOption<Taak>[]>(() => [
    { value: 'slim', label: 'Slimme volgorde', compare: smartTaakCompare(now) },
    { value: 'deadline_asc', label: 'Deadline oplopend', compare: combine(byNumber<Taak>(t => getTaakDeadlineMs(t) ?? undefined, 'asc'), byString<Taak>(t => t.titel)) },
    { value: 'deadline_desc', label: 'Deadline aflopend', compare: combine(byNumber<Taak>(t => getTaakDeadlineMs(t) ?? undefined, 'desc'), byString<Taak>(t => t.titel)) },
    { value: 'prioriteit', label: 'Prioriteit', compare: combine((a, b) => getTaakPrioriteitRank(a.prioriteit) - getTaakPrioriteitRank(b.prioriteit), byNumber<Taak>(t => getTaakDeadlineMs(t) ?? undefined, 'asc')) },
    { value: 'status', label: 'Status', compare: combine(byString<Taak>(t => t.status), byNumber<Taak>(t => getTaakDeadlineMs(t) ?? undefined, 'asc')) },
    { value: 'type', label: 'Type taak', compare: combine(byString<Taak>(t => t.type), byString<Taak>(t => t.titel)) },
    { value: 'relatie', label: 'Relatie/bedrijf A-Z', compare: combine(byString<Taak>(t => t.relatieId ? (getRelatieById(t.relatieId)?.bedrijfsnaam ?? '') : ''), byNumber<Taak>(t => getTaakDeadlineMs(t) ?? undefined, 'asc')) },
    { value: 'gewijzigd', label: 'Laatst gewijzigd', compare: byDate<Taak>(t => (t as any).updatedAt ?? (t as any).createdAt, 'desc') },
    { value: 'nieuwste', label: 'Nieuwste eerst', compare: byDate<Taak>(t => (t as any).createdAt, 'desc') },
  ], [now, getRelatieById]);

  const [sortValue, setSortValue] = useSortPreference('taken', 'slim', sortOptions.map(o => o.value));
  const activeSort = sortOptions.find(o => o.value === sortValue) ?? sortOptions[0];

  const filterFn = (task: Taak) => {
    const q = zoek.trim().toLowerCase();
    if (q) {
      const rel = task.relatieId ? getRelatieById(task.relatieId) : null;
      const deal = task.dealId ? getDealById(task.dealId) : null;
      const obj = task.objectId ? getObjectById(task.objectId) : (deal ? getObjectById(deal.objectId) : null);
      const relLabel = rel ? getRelatieNaamCompact(rel, contactpersonen).toLowerCase() : '';
      const haystack = [task.titel, task.type, task.notities ?? '', relLabel, obj?.titel ?? '', rel?.bedrijfsnaam ?? '', taskSourceLabel(task)].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (prioriteitFilter && task.prioriteit !== prioriteitFilter) return false;
    if (typeFilter && task.type !== typeFilter) return false;
    if (statusFilter && task.status !== statusFilter) return false;
    return true;
  };

  const stats = useMemo(() => {
    const open = taken.filter(t => isOpenTaskStatus(t.status));
    const active = open.filter(t => t.status !== 'wacht_op_reactie');
    return {
      inbox: active.filter(t => !isTaskInTodayView(t, planningFor(t), now) && planningFor(t).planningBucket === 'inbox').length,
      vandaag: active.filter(t => isTaskPlannedToday(t, planningFor(t), now)).length,
      teLaat: active.filter(t => isTaskOverdue(t, now)).length,
      komend: active.filter(t => isTaskUpcoming(t, planningFor(t), now)).length,
      openstaand: active.filter(t => {
        const p = planningFor(t);
        return !isTaskInTodayView(t, p, now) && p.planningBucket === 'open' && !p.planDatum && !t.deadline;
      }).length,
      later: active.filter(t => !isTaskInTodayView(t, planningFor(t), now) && planningFor(t).planningBucket === 'later').length,
      wachten: taken.filter(t => t.status === 'wacht_op_reactie').length,
      afgerond: taken.filter(t => t.status === 'afgerond').length,
      open: open.length,
    };
  }, [taken, planningRows, today]);

  const zichtbaar = useMemo(() => {
    let list = taken.filter(filterFn);
    switch (tab) {
      case 'inbox':
        list = list.filter(t => isOpenTaskStatus(t.status) && t.status !== 'wacht_op_reactie' && !isTaskInTodayView(t, planningFor(t), now) && planningFor(t).planningBucket === 'inbox');
        break;
      case 'vandaag':
        list = list.filter(t => isTaskInTodayView(t, planningFor(t), now));
        break;
      case 'komend':
        list = list.filter(t => isTaskUpcoming(t, planningFor(t), now));
        break;
      case 'openstaand':
        list = list.filter(t => {
          if (!isOpenTaskStatus(t.status) || t.status === 'wacht_op_reactie') return false;
          const p = planningFor(t);
          return !isTaskInTodayView(t, p, now) && p.planningBucket === 'open' && !p.planDatum && !t.deadline;
        });
        break;
      case 'later':
        list = list.filter(t => isOpenTaskStatus(t.status) && t.status !== 'wacht_op_reactie' && !isTaskInTodayView(t, planningFor(t), now) && planningFor(t).planningBucket === 'later');
        break;
      case 'wachten':
        list = list.filter(t => t.status === 'wacht_op_reactie');
        break;
      case 'alles':
        list = list.filter(t => isOpenTaskStatus(t.status));
        break;
      case 'afgerond':
        list = list.filter(t => t.status === 'afgerond');
        break;
    }
    return [...list].sort(activeSort.compare);
  }, [taken, planningRows, tab, zoek, prioriteitFilter, typeFilter, statusFilter, activeSort, today]);

  const vandaagSecties = useMemo(() => {
    if (tab !== 'vandaag') return null;
    const teLaat = zichtbaar.filter(t => isTaskOverdue(t, now));
    const gepland = zichtbaar.filter(t => !isTaskOverdue(t, now));
    const ochtend = gepland.filter(t => { const h = taskHour(t); return h !== null && h < 12; });
    const middag = gepland.filter(t => { const h = taskHour(t); return h !== null && h >= 12 && h < 18; });
    const later = gepland.filter(t => { const h = taskHour(t); return h === null || h >= 18; });
    return { teLaat, ochtend, middag, later };
  }, [tab, zichtbaar, now]);

  const upcomingGroups = useMemo(() => {
    if (tab !== 'komend') return [] as { date: string; items: Taak[] }[];
    const map = new Map<string, Taak[]>();
    for (const task of zichtbaar) {
      const date = taskWorkDate(task, planningFor(task)) ?? 'later';
      map.set(date, [...(map.get(date) ?? []), task]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items }));
  }, [tab, zichtbaar, planningRows]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectItems = (items: Taak[]) => {
    const ids = items.map(t => t.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const exitSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const runBulk = async (action: () => Promise<void>, success: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await action();
      await refresh();
      setPlanningRows(await listTaskPlanning());
      toast.success(`${success} (${ids.length})`);
      exitSelection();
    } catch (error: any) {
      toast.error(`Bulkactie mislukt: ${error?.message ?? 'onbekende fout'}`);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkPlan = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const label = days === 0 ? 'Naar Vandaag' : days === 1 ? 'Naar Morgen' : 'Nieuwe werkdatum ingesteld';
    return runBulk(
      () => bulkUpdateTaskPlanning(Array.from(selectedIds), { planningBucket: 'open', planDatum: localDateKey(date) }),
      label,
    );
  };

  const toggleComplete = async (event: React.MouseEvent, task: Taak) => {
    event.stopPropagation();
    if (task.status === 'afgerond') {
      try { await updateTaak(task.id, { status: 'open' }); toast.success('Taak heropend'); }
      catch (error: any) { toast.error(`Bijwerken mislukt: ${error.message ?? 'onbekende fout'}`); }
      return;
    }
    setAfrondenTaak(task);
  };

  const updatePlanning = async (
    event: React.MouseEvent,
    task: Taak,
    patch: { planDatum?: string | null; planningBucket?: TaskPlanningBucket },
    message: string,
  ) => {
    event.stopPropagation();
    try {
      await updateTaskPlanning(task.id, patch);
      setPlanningRows(prev => {
        const current = prev.find(row => row.id === task.id) ?? planningFor(task);
        const next = { ...current, ...patch };
        return prev.some(row => row.id === task.id)
          ? prev.map(row => row.id === task.id ? next : row)
          : [...prev, next];
      });
      toast.success(message);
    } catch (error: any) {
      toast.error(`Planning bijwerken mislukt: ${error.message ?? 'onbekende fout'}`);
    }
  };

  const planAfterDays = (event: React.MouseEvent, task: Taak, days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const label = days === 0 ? 'vandaag' : days === 1 ? 'morgen' : date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    return updatePlanning(event, task, { planningBucket: 'open', planDatum: localDateKey(date) }, `Gepland voor ${label}`);
  };

  const setWaiting = async (event: React.MouseEvent, task: Taak) => {
    event.stopPropagation();
    try { await updateTaak(task.id, { status: 'wacht_op_reactie' }); toast.success('Op wachten gezet'); }
    catch (error: any) { toast.error(`Bijwerken mislukt: ${error.message ?? 'onbekende fout'}`); }
  };

  const confirmDelete = async () => {
    if (!verwijderTaak) return;
    try {
      await deleteTaak(verwijderTaak.id);
      setPlanningRows(prev => prev.filter(row => row.id !== verwijderTaak.id));
      toast.success('Taak verwijderd');
      setVerwijderTaak(null);
    } catch (error: any) {
      toast.error(`Verwijderen mislukt: ${error?.message ?? 'onbekende fout'}`);
    }
  };

  const renderTask = (task: Taak) => {
    const rel = task.relatieId ? getRelatieById(task.relatieId) : null;
    const deal = task.dealId ? getDealById(task.dealId) : null;
    const obj = task.objectId ? getObjectById(task.objectId) : (deal ? getObjectById(deal.objectId) : null);
    const overdue = isTaakTeLaat(task, now);
    const completed = task.status === 'afgerond';
    const cancelled = task.status === 'geannuleerd';
    const waiting = task.status === 'wacht_op_reactie';
    const planning = planningFor(task);
    const selected = selectedIds.has(task.id);
    const context: string[] = [];
    if (rel) context.push(getRelatieNaamCompact(rel, contactpersonen));
    if (obj?.titel) context.push(obj.titel);

    const planningLabel = planning.planningBucket === 'inbox'
      ? 'Inbox'
      : planning.planningBucket === 'later'
        ? 'Later'
        : planning.planDatum
          ? planDateLabel(planning.planDatum, today)
          : !task.deadline ? 'Openstaand' : null;

    return (
      <div
        key={task.id}
        data-testid="taken-lijstregel"
        onClick={() => selectionMode ? toggleSelection(task.id) : navigate(`/taken/${task.id}`, { state: maakCrmReturnState('/taken', 'Mijn werk', 'taken-lijst') })}
        className={`group px-4 sm:px-5 py-3.5 grid grid-cols-[auto,minmax(0,1fr)] gap-x-3 gap-y-2 sm:flex sm:items-center transition-colors cursor-pointer ${selected ? 'bg-accent/8' : 'hover:bg-muted/30'}`}
      >
        <button
          onClick={(event) => { event.stopPropagation(); selectionMode ? toggleSelection(task.id) : toggleComplete(event, task); }}
          className="col-start-1 row-start-1 shrink-0 mt-0.5 sm:mt-0 text-muted-foreground hover:text-accent transition-colors"
          aria-label={selectionMode ? (selected ? 'Deselecteren' : 'Selecteren') : (completed ? 'Heropenen' : 'Afronden')}
        >
          {selectionMode
            ? selected ? <CheckSquare className="h-5 w-5 text-accent" /> : <Square className="h-5 w-5" />
            : completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : waiting ? <Clock className="h-5 w-5 text-warning" /> : <Circle className="h-5 w-5" />}
        </button>

        <div className="col-start-2 row-start-1 min-w-0 flex-1">
          <p className={`text-sm font-medium break-words ${completed || cancelled ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.titel}</p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground/80">{taskSourceLabel(task)}</span>
            {context.map((item, index) => <span key={index} className="flex min-w-0 items-center gap-1.5"><span aria-hidden>·</span><span className="truncate max-w-[220px] sm:max-w-[320px]">{item}</span></span>)}
            {task.type && <><span aria-hidden>·</span><span>{task.type}</span></>}
            {planningLabel && <><span aria-hidden>·</span><span>{planningLabel}</span></>}
            {task.deadline && <><span aria-hidden>·</span><span className={overdue ? 'text-destructive font-medium' : ''}>Deadline {deadlineLabel(task, now)}{overdue ? ' · te laat' : ''}</span></>}
            {task.notities && <><span aria-hidden>·</span><span className="truncate max-w-[240px] opacity-80">{task.notities}</span></>}
          </div>
        </div>

        <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:shrink-0">
          <PrioriteitBadge prioriteit={task.prioriteit} />
          {!completed && <TaakStatusBadge status={task.status} />}
          {!selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
                <button className="ml-auto sm:ml-0 opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-muted transition" aria-label="Acties"><MoreHorizontal className="h-4 w-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" onClick={event => event.stopPropagation()}>
                <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
                <DropdownMenuItem onClick={event => { event.stopPropagation(); setEditTaak(task); setFormOpen(true); }}><MoreHorizontal className="h-4 w-4 mr-2" /> Bewerken</DropdownMenuItem>
                <DropdownMenuSeparator />
                {!completed && <>
                  <DropdownMenuItem onClick={event => toggleComplete(event as any, task)}><CheckCircle2 className="h-4 w-4 mr-2" /> Afronden</DropdownMenuItem>
                  {!waiting && <DropdownMenuItem onClick={event => setWaiting(event as any, task)}><Clock className="h-4 w-4 mr-2" /> Op wachten zetten</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Planning</DropdownMenuLabel>
                  <DropdownMenuItem onClick={event => planAfterDays(event as any, task, 0)}>Vandaag</DropdownMenuItem>
                  <DropdownMenuItem onClick={event => planAfterDays(event as any, task, 1)}>Morgen</DropdownMenuItem>
                  <DropdownMenuItem onClick={event => planAfterDays(event as any, task, 7)}>Over een week</DropdownMenuItem>
                  <DropdownMenuItem onClick={event => updatePlanning(event as any, task, { planningBucket: 'open', planDatum: null }, 'Verplaatst naar Openstaand')}>Openstaand</DropdownMenuItem>
                  <DropdownMenuItem onClick={event => updatePlanning(event as any, task, { planningBucket: 'inbox', planDatum: null }, 'Verplaatst naar Inbox')}>Inbox</DropdownMenuItem>
                  <DropdownMenuItem onClick={event => updatePlanning(event as any, task, { planningBucket: 'later', planDatum: null }, 'Verplaatst naar Later')}>Later</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>}
                {rel && <DropdownMenuItem asChild><Link to={`/relaties/${rel.id}`} onClick={event => event.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open relatie</Link></DropdownMenuItem>}
                {obj && <DropdownMenuItem asChild><Link to={`/objecten/${obj.id}`} onClick={event => event.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open object</Link></DropdownMenuItem>}
                {deal && <DropdownMenuItem asChild><Link to={`/deals/${deal.id}`} onClick={event => event.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open deal</Link></DropdownMenuItem>}
                {(rel || obj || deal) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={event => { event.stopPropagation(); setVerwijderTaak(task); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: Taak[], options?: { danger?: boolean; icon?: React.ReactNode; limit?: number }) => {
    if (items.length === 0) return null;
    const shown = options?.limit && !showAllOverdue ? items.slice(0, options.limit) : items;
    const allSelected = items.every(item => selectedIds.has(item.id));
    return (
      <section className="section-card overflow-hidden" key={title}>
        <header className="section-header">
          <h2 className={`section-title flex items-center gap-2 ${options?.danger ? 'text-destructive' : ''}`}>{options?.icon}{title}</h2>
          <div className="flex items-center gap-2">
            {selectionMode && <button type="button" onClick={() => selectItems(items)} className="text-xs font-medium text-accent">{allSelected ? 'Deselecteer' : 'Selecteer alles'}</button>}
            <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
          </div>
        </header>
        <div className="divide-y divide-border/70">{shown.map(renderTask)}</div>
        {options?.limit && items.length > options.limit && (
          <button type="button" onClick={() => setShowAllOverdue(v => !v)} className="w-full border-t border-border/70 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20">
            {showAllOverdue ? 'Toon minder' : `Bekijk alle ${items.length} achterstallige taken`}
          </button>
        )}
      </section>
    );
  };

  const actieveFilters = Number(Boolean(prioriteitFilter)) + Number(Boolean(typeFilter)) + Number(Boolean(statusFilter));
  const datumLabel = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  const filters = (
    <>
      <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value as TaakPrioriteit | '')}><option value="">Alle prioriteiten</option><option value="urgent">Urgent</option><option value="hoog">Hoog</option><option value="normaal">Normaal</option><option value="laag">Laag</option></select>
      <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Alle types</option>{TAAK_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
      <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaakStatus | '')}><option value="">Alle statussen</option><option value="open">Open</option><option value="wacht_op_reactie">Wachten op reactie</option><option value="in_uitvoering">In uitvoering</option><option value="afgerond">Afgerond</option><option value="geannuleerd">Geannuleerd</option></select>
      <SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} />
      {actieveFilters > 0 && <button type="button" className="h-10 px-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => { setPrioriteitFilter(''); setTypeFilter(''); setStatusFilter(''); }}>Wis filters</button>}
    </>
  );

  return (
    <div className="page-shell pb-24 sm:pb-8">
      <PageHeader
        title="Mijn werk"
        subtitle={<span className="text-sm text-muted-foreground"><span className="capitalize">{datumLabel}</span><span className="mx-1.5">·</span><span className="font-medium text-foreground tabular-nums">{stats.vandaag}</span> gepland vandaag{stats.teLaat > 0 && <><span className="mx-1.5">·</span><span className="text-destructive font-medium">{stats.teLaat} achterstallig</span></>}</span>}
        actions={<button onClick={() => { setEditTaak(null); setFormOpen(true); }} className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm"><Plus className="h-4 w-4" /> Nieuwe taak</button>}
      />

      <div className="flex gap-1.5 -mx-1 px-1 overflow-x-auto pb-0.5">
        {TABS.map(item => {
          const active = tab === item.value;
          const count = item.value === 'inbox' ? stats.inbox : item.value === 'vandaag' ? stats.vandaag : item.value === 'komend' ? stats.komend : item.value === 'openstaand' ? stats.openstaand : item.value === 'later' ? stats.later : item.value === 'wachten' ? stats.wachten : item.value === 'alles' ? stats.open : stats.afgerond;
          return <button key={item.value} onClick={() => setTab(item.value)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${active ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40'}`}>{item.label}<span className="ml-1.5 tabular-nums opacity-80">{count}</span></button>;
        })}
      </div>

      <QuickTaskCapture defaultTarget={tab === 'inbox' ? 'inbox' : tab === 'later' ? 'later' : tab === 'openstaand' ? 'open' : 'today'} />

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Zoek in mijn werk…" className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} /></div>
        <button type="button" onClick={() => setFiltersOpen(true)} className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${actieveFilters > 0 ? 'border-foreground/30 text-foreground bg-muted/30' : 'border-input text-muted-foreground hover:text-foreground'}`}><SlidersHorizontal className="h-4 w-4" /><span className="hidden md:inline">Filters</span>{actieveFilters > 0 && <span className="rounded-full bg-foreground text-background px-1.5 text-[10px] tabular-nums">{actieveFilters}</span>}</button>
        <button type="button" onClick={() => selectionMode ? exitSelection() : setSelectionMode(true)} className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${selectionMode ? 'border-accent text-accent bg-accent/5' : 'border-input text-muted-foreground hover:text-foreground'}`}>{selectionMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}<span className="hidden md:inline">{selectionMode ? 'Stop' : 'Selecteer'}</span></button>
        <div className="hidden lg:block"><SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} /></div>
      </div>

      {filtersOpen && <>
        <div className="fixed inset-0 z-40 bg-black/25 sm:hidden" onClick={() => setFiltersOpen(false)} />
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-card p-4 shadow-2xl sm:static sm:z-auto sm:rounded-xl sm:shadow-none sm:p-3">
          <div className="mb-3 flex items-center justify-between sm:hidden"><p className="font-semibold">Filters & sortering</p><button type="button" onClick={() => setFiltersOpen(false)} className="p-2 text-muted-foreground"><X className="h-5 w-5" /></button></div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">{filters}</div>
          <button type="button" onClick={() => setFiltersOpen(false)} className="mt-3 h-11 w-full rounded-md bg-foreground text-sm font-medium text-background sm:hidden">Gereed</button>
        </div>
      </>}

      {zichtbaar.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="Niets in deze weergave" description={tab === 'vandaag' ? 'Je hebt geen geplande of achterstallige taken in deze weergave.' : tab === 'inbox' ? 'Je Inbox is leeg. Zet losse ideeën of nog te plannen acties hier tijdelijk neer.' : tab === 'later' ? 'Hier staan taken die bewust nog geen aandacht vragen.' : 'Wissel van weergave, pas je filters aan of maak een nieuwe taak aan.'} action={<button type="button" onClick={() => { setEditTaak(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm"><Plus className="h-4 w-4" /> Nieuwe taak</button>} />
      ) : tab === 'vandaag' && vandaagSecties ? (
        <div className="space-y-3">
          {renderSection('Ochtend', vandaagSecties.ochtend, { icon: <Sunrise className="h-4 w-4 text-muted-foreground" /> })}
          {renderSection('Middag', vandaagSecties.middag, { icon: <Sun className="h-4 w-4 text-muted-foreground" /> })}
          {renderSection('Later vandaag', vandaagSecties.later, { icon: <Moon className="h-4 w-4 text-muted-foreground" /> })}
          {renderSection('Achterstallig', vandaagSecties.teLaat, { danger: true, icon: <Clock className="h-4 w-4" />, limit: 10 })}
        </div>
      ) : tab === 'komend' ? (
        <div className="space-y-3">
          {upcomingGroups.map(group => renderSection(upcomingGroupLabel(group.date, today), group.items, { icon: <CalendarDays className="h-4 w-4 text-muted-foreground" /> }))}
        </div>
      ) : (
        renderSection(TABS.find(item => item.value === tab)?.label ?? 'Taken', zichtbaar)
      )}

      {selectionMode && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur sm:bottom-5">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 px-2 text-sm font-semibold tabular-nums">{selectedIds.size} geselecteerd</span>
            <button type="button" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => bulkPlan(0)} className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40">Vandaag</button>
            <button type="button" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => bulkPlan(1)} className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40">Morgen</button>
            <button type="button" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => runBulk(() => bulkUpdateTaskPlanning(Array.from(selectedIds), { planningBucket: 'open', planDatum: null }), 'Naar Openstaand')} className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40">Openstaand</button>
            <button type="button" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => runBulk(() => bulkUpdateTaskPlanning(Array.from(selectedIds), { planningBucket: 'later', planDatum: null }), 'Naar Later')} className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40">Later</button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button type="button" disabled={selectedIds.size === 0 || bulkBusy} className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40">Prioriteit</button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => runBulk(() => bulkUpdateTaskPriority(Array.from(selectedIds), 'urgent'), 'Prioriteit aangepast')}>Urgent</DropdownMenuItem><DropdownMenuItem onClick={() => runBulk(() => bulkUpdateTaskPriority(Array.from(selectedIds), 'hoog'), 'Prioriteit aangepast')}>Hoog</DropdownMenuItem><DropdownMenuItem onClick={() => runBulk(() => bulkUpdateTaskPriority(Array.from(selectedIds), 'normaal'), 'Prioriteit aangepast')}>Normaal</DropdownMenuItem><DropdownMenuItem onClick={() => runBulk(() => bulkUpdateTaskPriority(Array.from(selectedIds), 'laag'), 'Prioriteit aangepast')}>Laag</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
            <button type="button" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => runBulk(() => bulkUpdateTaskStatus(Array.from(selectedIds), 'afgerond'), 'Taken afgerond')} className="shrink-0 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-40">Afronden</button>
          </div>
        </div>
      )}

      <TaakFormDialog open={formOpen} onOpenChange={value => { setFormOpen(value); if (!value) setEditTaak(null); }} taak={editTaak} />
      <TaakAfrondenDialog open={!!afrondenTaak} onOpenChange={value => { if (!value) setAfrondenTaak(null); }} taak={afrondenTaak} />
      <AlertDialog open={!!verwijderTaak} onOpenChange={open => { if (!open) setVerwijderTaak(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {verwijderTaak ? `“${verwijderTaak.titel}” wordt definitief verwijderd. Deze actie kan niet ongedaan worden gemaakt.` : 'Deze taak wordt definitief verwijderd.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
