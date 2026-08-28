import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, CheckCircle2, Circle, Clock, MoreHorizontal,
  ExternalLink, ListChecks, SlidersHorizontal, Sunrise, Sun, Moon,
} from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import type { TaakPrioriteit, TaakStatus, Taak } from '@/data/mock-data';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import TaakAfrondenDialog from '@/components/forms/TaakAfrondenDialog';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import {
  isTaakTeLaat, isTaakVandaag, deadlineLabel,
  TAAK_TYPES,
} from '@/lib/taakHelpers';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import SortDropdown from '@/components/SortDropdown';
import { useSortPreference } from '@/hooks/useSortPreference';
import { byDate, byNumber, byString, combine } from '@/lib/sorting/comparators';
import { smartTaakCompare, getTaakDeadlineMs, getTaakPrioriteitRank } from '@/lib/sorting/urgency';
import type { SortOption } from '@/lib/sorting/types';
import { maakCrmReturnState } from '@/lib/crmReturnContext';
import {
  loadTakenViewState, saveTakenViewState, type TakenTab,
} from '@/lib/takenViewState';
import {
  listTaskPlanning,
  taskPlanningMap,
  updateTaskPlanning,
  type TaskPlanningMeta,
  type TaskPlanningBucket,
} from '@/lib/tasks/planning';

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

const isOpenState = (s: TaakStatus) => s !== 'afgerond' && s !== 'geannuleerd';

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function taakTijd(taak: Taak): string | null {
  const raw = (taak as any).deadlineTijd ?? (taak as any).deadline_tijd;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.slice(0, 5);
}

function taakUur(taak: Taak): number | null {
  const tijd = taakTijd(taak);
  if (!tijd) return null;
  const uur = Number(tijd.slice(0, 2));
  return Number.isFinite(uur) ? uur : null;
}

function planDatumLabel(value: string, today: string): string {
  if (value === today) return 'Gepland vandaag';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === dateKey(tomorrow)) return 'Gepland morgen';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return `Gepland ${value}`;
  return `Gepland ${parsed.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
}

export default function TakenPage() {
  const { taken, getRelatieById, getDealById, getObjectById, updateTaak, contactpersonen } = useDataStore();
  const initialView = useMemo(() => loadTakenViewState(), []);
  const [zoek, setZoek] = useState(initialView.zoek);
  const [prioriteitFilter, setPrioriteitFilter] = useState<TaakPrioriteit | ''>(initialView.prioriteitFilter);
  const [typeFilter, setTypeFilter] = useState<string>(initialView.typeFilter);
  const [statusFilter, setStatusFilter] = useState<TaakStatus | ''>(initialView.statusFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<Taak | null>(null);
  const [afrondenTaak, setAfrondenTaak] = useState<Taak | null>(null);
  const [tab, setTab] = useState<TakenTab>(initialView.tab);
  const [planningRows, setPlanningRows] = useState<TaskPlanningMeta[]>([]);
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
    if (taken.some((x) => x.id === openId)) {
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

  const handleFormOpenChange = (v: boolean) => {
    setFormOpen(v);
    if (!v) setEditTaak(null);
  };

  const now = new Date();
  const today = dateKey(now);
  const planningById = useMemo(() => taskPlanningMap(planningRows), [planningRows]);
  const planningFor = (taak: Taak): TaskPlanningMeta => planningById.get(taak.id) ?? {
    id: taak.id,
    planDatum: null,
    planningBucket: 'open',
  };

  const hardVandaag = (taak: Taak) => isTaakTeLaat(taak, now) || isTaakVandaag(taak, now);
  const isWerkVandaag = (taak: Taak) => {
    if (!isOpenState(taak.status) || taak.status === 'wacht_op_reactie') return false;
    if (hardVandaag(taak)) return true;
    const planning = planningFor(taak);
    return planning.planningBucket === 'open' && !!planning.planDatum && planning.planDatum <= today;
  };

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

  const filterFn = (t: Taak) => {
    const q = zoek.trim().toLowerCase();
    if (q) {
      const rel = t.relatieId ? getRelatieById(t.relatieId) : null;
      const deal = t.dealId ? getDealById(t.dealId) : null;
      const obj = t.objectId ? getObjectById(t.objectId) : (deal ? getObjectById(deal.objectId) : null);
      const relLabel = rel ? getRelatieNaamCompact(rel, contactpersonen).toLowerCase() : '';
      const hay = [t.titel, t.type, t.notities ?? '', relLabel, obj?.titel ?? '', rel?.bedrijfsnaam ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (prioriteitFilter && t.prioriteit !== prioriteitFilter) return false;
    if (typeFilter && t.type !== typeFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  };

  const stats = useMemo(() => {
    const open = taken.filter(t => isOpenState(t.status));
    const nietWachten = open.filter(t => t.status !== 'wacht_op_reactie');
    return {
      inbox: nietWachten.filter(t => !hardVandaag(t) && planningFor(t).planningBucket === 'inbox').length,
      vandaag: nietWachten.filter(isWerkVandaag).length,
      teLaat: nietWachten.filter(t => isTaakTeLaat(t, now)).length,
      komend: nietWachten.filter(t => {
        if (isWerkVandaag(t)) return false;
        const p = planningFor(t);
        if (p.planningBucket !== 'open') return false;
        if (p.planDatum) return p.planDatum > today;
        return !!t.deadline && t.deadline > today;
      }).length,
      openstaand: nietWachten.filter(t => {
        const p = planningFor(t);
        return !hardVandaag(t) && p.planningBucket === 'open' && !p.planDatum && !t.deadline;
      }).length,
      later: nietWachten.filter(t => !hardVandaag(t) && planningFor(t).planningBucket === 'later').length,
      wachten: taken.filter(t => t.status === 'wacht_op_reactie').length,
      afgerond: taken.filter(t => t.status === 'afgerond').length,
      open: open.length,
    };
  }, [taken, planningRows, today]);

  const zichtbaar = useMemo(() => {
    let list = taken.filter(filterFn);
    switch (tab) {
      case 'inbox':
        list = list.filter(t => isOpenState(t.status) && t.status !== 'wacht_op_reactie' && !hardVandaag(t) && planningFor(t).planningBucket === 'inbox');
        break;
      case 'vandaag':
        list = list.filter(isWerkVandaag);
        break;
      case 'komend':
        list = list.filter(t => {
          if (!isOpenState(t.status) || t.status === 'wacht_op_reactie' || isWerkVandaag(t)) return false;
          const p = planningFor(t);
          if (p.planningBucket !== 'open') return false;
          if (p.planDatum) return p.planDatum > today;
          return !!t.deadline && t.deadline > today;
        });
        break;
      case 'openstaand':
        list = list.filter(t => {
          if (!isOpenState(t.status) || t.status === 'wacht_op_reactie' || hardVandaag(t)) return false;
          const p = planningFor(t);
          return p.planningBucket === 'open' && !p.planDatum && !t.deadline;
        });
        break;
      case 'later':
        list = list.filter(t => isOpenState(t.status) && t.status !== 'wacht_op_reactie' && !hardVandaag(t) && planningFor(t).planningBucket === 'later');
        break;
      case 'wachten':
        list = list.filter(t => t.status === 'wacht_op_reactie');
        break;
      case 'alles':
        list = list.filter(t => isOpenState(t.status));
        break;
      case 'afgerond':
        list = list.filter(t => t.status === 'afgerond');
        break;
    }
    return [...list].sort(activeSort.compare);
  }, [taken, planningRows, tab, zoek, prioriteitFilter, typeFilter, statusFilter, activeSort, today]);

  const togglAfvinken = async (e: React.MouseEvent, taak: Taak) => {
    e.stopPropagation();
    if (taak.status === 'afgerond') {
      try { await updateTaak(taak.id, { status: 'open' }); toast.success('Taak heropend'); }
      catch (err: any) { toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`); }
      return;
    }
    setAfrondenTaak(taak);
  };

  const wijzigPlanning = async (
    e: React.MouseEvent,
    taak: Taak,
    patch: { planDatum?: string | null; planningBucket?: TaskPlanningBucket },
    melding: string,
  ) => {
    e.stopPropagation();
    try {
      await updateTaskPlanning(taak.id, patch);
      setPlanningRows(prev => {
        const current = prev.find(row => row.id === taak.id) ?? planningFor(taak);
        const next = { ...current, ...patch };
        return prev.some(row => row.id === taak.id)
          ? prev.map(row => row.id === taak.id ? next : row)
          : [...prev, next];
      });
      toast.success(melding);
    } catch (err: any) {
      toast.error(`Planning bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const planOverDagen = (e: React.MouseEvent, taak: Taak, dagen: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dagen);
    const label = dagen === 0 ? 'vandaag' : dagen === 1 ? 'morgen' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    return wijzigPlanning(e, taak, { planningBucket: 'open', planDatum: dateKey(d) }, `Gepland voor ${label}`);
  };

  const setWachten = async (e: React.MouseEvent, taak: Taak) => {
    e.stopPropagation();
    try { await updateTaak(taak.id, { status: 'wacht_op_reactie' }); toast.success('Op wachten gezet'); }
    catch (err: any) { toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`); }
  };

  const renderTaak = (taak: Taak) => {
    const rel = taak.relatieId ? getRelatieById(taak.relatieId) : null;
    const deal = taak.dealId ? getDealById(taak.dealId) : null;
    const obj = taak.objectId ? getObjectById(taak.objectId) : (deal ? getObjectById(deal.objectId) : null);
    const teLaat = isTaakTeLaat(taak, now);
    const isAfgerond = taak.status === 'afgerond';
    const isGeannuleerd = taak.status === 'geannuleerd';
    const isWachten = taak.status === 'wacht_op_reactie';
    const planning = planningFor(taak);
    const ctxParts: string[] = [];
    if (rel) ctxParts.push(getRelatieNaamCompact(rel, contactpersonen));
    if (obj?.titel) ctxParts.push(obj.titel);

    const planningLabel = planning.planningBucket === 'inbox'
      ? 'Inbox'
      : planning.planningBucket === 'later'
        ? 'Later'
        : planning.planDatum
          ? planDatumLabel(planning.planDatum, today)
          : !taak.deadline
            ? 'Openstaand'
            : null;

    return (
      <div
        key={taak.id}
        data-testid="taken-lijstregel"
        onClick={() => navigate(`/taken/${taak.id}`, { state: maakCrmReturnState('/taken', 'Mijn werk', 'taken-lijst') })}
        className="group px-4 sm:px-5 py-3.5 grid grid-cols-[auto,minmax(0,1fr)] gap-x-3 gap-y-2 sm:flex sm:items-center hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <button
          onClick={(e) => togglAfvinken(e, taak)}
          className="col-start-1 row-start-1 shrink-0 mt-0.5 sm:mt-0 text-muted-foreground hover:text-accent transition-colors"
          aria-label={isAfgerond ? 'Heropenen' : 'Afronden'}
        >
          {isAfgerond ? <CheckCircle2 className="h-5 w-5 text-success" /> : isWachten ? <Clock className="h-5 w-5 text-warning" /> : <Circle className="h-5 w-5" />}
        </button>
        <div className="col-start-2 row-start-1 min-w-0 flex-1">
          <p className={`text-sm font-medium break-words ${isAfgerond || isGeannuleerd ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {taak.titel}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {ctxParts.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                <span className="truncate max-w-[240px] sm:max-w-[320px]">{c}</span>
              </span>
            ))}
            {taak.type && <>{ctxParts.length > 0 && <span aria-hidden>·</span>}<span>{taak.type}</span></>}
            {planningLabel && <><span aria-hidden>·</span><span>{planningLabel}</span></>}
            {taak.deadline && <><span aria-hidden>·</span><span className={teLaat ? 'text-destructive font-medium' : ''}>Deadline {deadlineLabel(taak, now)}{teLaat ? ' · te laat' : ''}</span></>}
            {taak.notities && <><span aria-hidden>·</span><span className="truncate max-w-[240px] opacity-80">{taak.notities}</span></>}
          </div>
        </div>
        <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:shrink-0">
          <PrioriteitBadge prioriteit={taak.prioriteit} />
          {!isAfgerond && <TaakStatusBadge status={taak.status} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="ml-auto sm:ml-0 opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-muted transition" aria-label="Acties">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditTaak(taak); setFormOpen(true); }}><MoreHorizontal className="h-4 w-4 mr-2" /> Bewerken</DropdownMenuItem>
              <DropdownMenuSeparator />
              {!isAfgerond && <>
                <DropdownMenuItem onClick={(e) => togglAfvinken(e as any, taak)}><CheckCircle2 className="h-4 w-4 mr-2" /> Afronden</DropdownMenuItem>
                {!isWachten && <DropdownMenuItem onClick={(e) => setWachten(e as any, taak)}><Clock className="h-4 w-4 mr-2" /> Op wachten zetten</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Planning</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => planOverDagen(e as any, taak, 0)}>Vandaag</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => planOverDagen(e as any, taak, 1)}>Morgen</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => planOverDagen(e as any, taak, 7)}>Over een week</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => wijzigPlanning(e as any, taak, { planningBucket: 'open', planDatum: null }, 'Verplaatst naar Openstaand')}>Openstaand</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => wijzigPlanning(e as any, taak, { planningBucket: 'inbox', planDatum: null }, 'Verplaatst naar Inbox')}>Inbox</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => wijzigPlanning(e as any, taak, { planningBucket: 'later', planDatum: null }, 'Verplaatst naar Later')}>Later</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>}
              {rel && <DropdownMenuItem asChild><Link to={`/relaties/${rel.id}`} onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open relatie</Link></DropdownMenuItem>}
              {obj && <DropdownMenuItem asChild><Link to={`/objecten/${obj.id}`} onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open object</Link></DropdownMenuItem>}
              {deal && <DropdownMenuItem asChild><Link to={`/deals/${deal.id}`} onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open deal</Link></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: Taak[], options?: { danger?: boolean; icon?: React.ReactNode }) => {
    if (items.length === 0) return null;
    return (
      <section className="section-card overflow-hidden" key={title}>
        <header className="section-header">
          <h2 className={`section-title flex items-center gap-2 ${options?.danger ? 'text-destructive' : ''}`}>
            {options?.icon}{title}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
        </header>
        <div className="divide-y divide-border/70">{items.map(renderTaak)}</div>
      </section>
    );
  };

  const vandaagSecties = useMemo(() => {
    if (tab !== 'vandaag') return null;
    const teLaat = zichtbaar.filter(t => isTaakTeLaat(t, now));
    const vandaag = zichtbaar.filter(t => !isTaakTeLaat(t, now));
    const ochtend = vandaag.filter(t => { const h = taakUur(t); return h !== null && h < 12; });
    const middag = vandaag.filter(t => { const h = taakUur(t); return h !== null && h >= 12 && h < 18; });
    const later = vandaag.filter(t => { const h = taakUur(t); return h === null || h >= 18; });
    return { teLaat, ochtend, middag, later };
  }, [tab, zichtbaar, now]);

  const actieveFilters = Number(Boolean(prioriteitFilter)) + Number(Boolean(typeFilter)) + Number(Boolean(statusFilter));
  const datumLabel = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page-shell">
      <PageHeader
        title="Mijn werk"
        subtitle={<span className="text-sm text-muted-foreground"><span className="capitalize">{datumLabel}</span><span className="mx-1.5">·</span><span className="font-medium text-foreground tabular-nums">{stats.vandaag}</span> voor vandaag{stats.teLaat > 0 && <><span className="mx-1.5">·</span><span className="text-destructive font-medium">{stats.teLaat} te laat</span></>}</span>}
        actions={<button onClick={() => { setEditTaak(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm"><Plus className="h-4 w-4" /> Nieuwe taak</button>}
      />

      <div className="flex gap-1.5 -mx-1 px-1 overflow-x-auto pb-0.5">
        {TABS.map(t => {
          const active = tab === t.value;
          const count = t.value === 'inbox' ? stats.inbox : t.value === 'vandaag' ? stats.vandaag : t.value === 'komend' ? stats.komend : t.value === 'openstaand' ? stats.openstaand : t.value === 'later' ? stats.later : t.value === 'wachten' ? stats.wachten : t.value === 'alles' ? stats.open : stats.afgerond;
          return <button key={t.value} onClick={() => setTab(t.value)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${active ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40'}`}>{t.label}<span className="ml-1.5 tabular-nums opacity-80">{count}</span></button>;
        })}
      </div>

      <div className="flex gap-2.5 items-center">
        <div className="relative flex-1 max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Zoek in mijn werk…" className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} /></div>
        <button type="button" onClick={() => setFiltersOpen(v => !v)} className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${filtersOpen || actieveFilters > 0 ? 'border-foreground/30 text-foreground bg-muted/30' : 'border-input text-muted-foreground hover:text-foreground'}`}><SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filters</span>{actieveFilters > 0 && <span className="rounded-full bg-foreground text-background px-1.5 text-[10px] tabular-nums">{actieveFilters}</span>}</button>
        <div className="hidden sm:block"><SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} /></div>
      </div>

      {filtersOpen && (
        <div className="section-card p-3 flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
          <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value as TaakPrioriteit | '')}><option value="">Alle prioriteiten</option><option value="urgent">Urgent</option><option value="hoog">Hoog</option><option value="normaal">Normaal</option><option value="laag">Laag</option></select>
          <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Alle types</option>{TAAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaakStatus | '')}><option value="">Alle statussen</option><option value="open">Open</option><option value="wacht_op_reactie">Wachten op reactie</option><option value="in_uitvoering">In uitvoering</option><option value="afgerond">Afgerond</option><option value="geannuleerd">Geannuleerd</option></select>
          <div className="sm:hidden"><SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} /></div>
          {actieveFilters > 0 && <button type="button" className="h-10 px-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => { setPrioriteitFilter(''); setTypeFilter(''); setStatusFilter(''); }}>Wis filters</button>}
        </div>
      )}

      {zichtbaar.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="Niets in deze weergave" description={tab === 'vandaag' ? 'Je hebt hier nu geen taken voor vandaag of verlopen taken.' : tab === 'inbox' ? 'Je Inbox is leeg. Zet losse ideeën of nog te plannen acties hier tijdelijk neer.' : tab === 'later' ? 'Hier staan taken die bewust nog geen aandacht vragen.' : 'Wissel van weergave, pas je filters aan of maak direct een nieuwe taak aan.'} action={<button type="button" onClick={() => { setEditTaak(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm"><Plus className="h-4 w-4" /> Nieuwe taak</button>} />
      ) : tab === 'vandaag' && vandaagSecties ? (
        <div className="space-y-3">
          {renderSection('Te laat', vandaagSecties.teLaat, { danger: true, icon: <Clock className="h-4 w-4" /> })}
          {renderSection('Ochtend', vandaagSecties.ochtend, { icon: <Sunrise className="h-4 w-4 text-muted-foreground" /> })}
          {renderSection('Middag', vandaagSecties.middag, { icon: <Sun className="h-4 w-4 text-muted-foreground" /> })}
          {renderSection('Later vandaag', vandaagSecties.later, { icon: <Moon className="h-4 w-4 text-muted-foreground" /> })}
        </div>
      ) : (
        renderSection(TABS.find(t => t.value === tab)?.label ?? 'Taken', zichtbaar)
      )}

      <TaakFormDialog open={formOpen} onOpenChange={handleFormOpenChange} taak={editTaak} />
      <TaakAfrondenDialog open={!!afrondenTaak} onOpenChange={(v) => { if (!v) setAfrondenTaak(null); }} taak={afrondenTaak} />
    </div>
  );
}
