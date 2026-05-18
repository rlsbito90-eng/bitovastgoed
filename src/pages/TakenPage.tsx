import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, CheckCircle2, Circle, Clock, MoreHorizontal,
  ExternalLink, ChevronDown,
} from 'lucide-react';
import type { TaakPrioriteit, TaakStatus, Taak } from '@/data/mock-data';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import TaakAfrondenDialog from '@/components/forms/TaakAfrondenDialog';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import {
  isTaakTeLaat, isTaakVandaag, isTaakDezeWeek, deadlineLabel,
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
import { useMemo as useMemoReact } from 'react';

type Tab = 'focus' | 'vandaag' | 'te_laat' | 'deze_week' | 'wachten' | 'alles' | 'afgerond';

const TABS: { value: Tab; label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'vandaag', label: 'Vandaag' },
  { value: 'te_laat', label: 'Te laat' },
  { value: 'deze_week', label: 'Deze week' },
  { value: 'wachten', label: 'Wachten' },
  { value: 'alles', label: 'Alles' },
  { value: 'afgerond', label: 'Afgerond' },
];

const isOpenState = (s: TaakStatus) => s !== 'afgerond' && s !== 'geannuleerd';

export default function TakenPage() {
  const { taken, getRelatieById, getDealById, getObjectById, updateTaak, contactpersonen } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [prioriteitFilter, setPrioriteitFilter] = useState<TaakPrioriteit | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<TaakStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<Taak | null>(null);
  const [afrondenTaak, setAfrondenTaak] = useState<Taak | null>(null);
  const [tab, setTab] = useState<Tab>('focus');

  const now = new Date();

  const sortOptions = useMemoReact<SortOption<Taak>[]>(() => [
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

  // Search context-aware
  const filterFn = (t: Taak) => {
    const q = zoek.trim().toLowerCase();
    if (q) {
      const rel = t.relatieId ? getRelatieById(t.relatieId) : null;
      const deal = t.dealId ? getDealById(t.dealId) : null;
      const obj = t.objectId ? getObjectById(t.objectId) : (deal ? getObjectById(deal.objectId) : null);
      const relLabel = rel ? getRelatieNaamCompact(rel, contactpersonen).toLowerCase() : '';
      const hay = [
        t.titel, t.type, t.notities ?? '', relLabel,
        obj?.titel ?? '', rel?.bedrijfsnaam ?? '',
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (prioriteitFilter && t.prioriteit !== prioriteitFilter) return false;
    if (typeFilter && t.type !== typeFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  };

  const stats = useMemo(() => {
    const o = taken.filter(t => isOpenState(t.status));
    return {
      vandaag: o.filter(t => isTaakVandaag(t, now) && !isTaakTeLaat(t, now)).length,
      teLaat: o.filter(t => isTaakTeLaat(t, now)).length,
      dezeWeek: o.filter(t => isTaakDezeWeek(t, now)).length,
      wachten: taken.filter(t => t.status === 'wacht_op_reactie').length,
      afgerond: taken.filter(t => t.status === 'afgerond').length,
      open: o.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken]);

  const zichtbaar = useMemo(() => {
    let list = taken.filter(filterFn);
    switch (tab) {
      case 'focus':
        list = list.filter(t => isOpenState(t.status) && (
          isTaakTeLaat(t, now) || isTaakVandaag(t, now) || t.prioriteit === 'urgent' || t.prioriteit === 'hoog'
        ));
        break;
      case 'vandaag':
        list = list.filter(t => isOpenState(t.status) && isTaakVandaag(t, now));
        break;
      case 'te_laat':
        list = list.filter(t => isTaakTeLaat(t, now));
        break;
      case 'deze_week':
        list = list.filter(t => isOpenState(t.status) && isTaakDezeWeek(t, now));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, tab, zoek, prioriteitFilter, typeFilter, statusFilter, activeSort]);

  const togglAfvinken = async (e: React.MouseEvent, taak: Taak) => {
    e.stopPropagation();
    if (taak.status === 'afgerond') {
      try {
        await updateTaak(taak.id, { status: 'open' });
        toast.success('Taak heropend');
      } catch (err: any) {
        toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
      }
      return;
    }
    // Bij afronden: vraag of er een contactmoment gelogd moet worden.
    setAfrondenTaak(taak);
  };

  const snooze = async (e: React.MouseEvent, taak: Taak, dagen: number) => {
    e.stopPropagation();
    const d = new Date();
    d.setDate(d.getDate() + dagen);
    const iso = d.toISOString().slice(0, 10);
    try {
      await updateTaak(taak.id, { deadline: iso });
      toast.success(`Verplaatst naar ${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`);
    } catch (err: any) {
      toast.error(`Verplaatsen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const setWachten = async (e: React.MouseEvent, taak: Taak) => {
    e.stopPropagation();
    try {
      await updateTaak(taak.id, { status: 'wacht_op_reactie' });
      toast.success('Op wachten gezet');
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const renderTaak = (taak: Taak) => {
    const rel = taak.relatieId ? getRelatieById(taak.relatieId) : null;
    const deal = taak.dealId ? getDealById(taak.dealId) : null;
    const obj = taak.objectId ? getObjectById(taak.objectId) : (deal ? getObjectById(deal.objectId) : null);
    const teLaat = isTaakTeLaat(taak, now);
    const isAfgerond = taak.status === 'afgerond';
    const isGeannuleerd = taak.status === 'geannuleerd';
    const isWachten = taak.status === 'wacht_op_reactie';

    const ctxParts: string[] = [];
    if (rel) ctxParts.push(getRelatieNaamCompact(rel, contactpersonen));
    if (obj?.titel) ctxParts.push(obj.titel);

    return (
      <div
        key={taak.id}
        onClick={() => { setEditTaak(taak); setFormOpen(true); }}
        className="group px-4 sm:px-5 py-3.5 flex items-start sm:items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <button
          onClick={(e) => togglAfvinken(e, taak)}
          className="shrink-0 mt-0.5 sm:mt-0 text-muted-foreground hover:text-accent transition-colors"
          aria-label={isAfgerond ? 'Heropenen' : 'Afronden'}
        >
          {isAfgerond
            ? <CheckCircle2 className="h-5 w-5 text-success" />
            : isWachten
              ? <Clock className="h-5 w-5 text-warning" />
              : <Circle className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${isAfgerond || isGeannuleerd ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {taak.titel}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {ctxParts.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                <span className="truncate max-w-[200px]">{c}</span>
              </span>
            ))}
            {taak.type && (
              <>
                {ctxParts.length > 0 && <span aria-hidden>·</span>}
                <span>{taak.type}</span>
              </>
            )}
            {taak.deadline ? (
              <>
                <span aria-hidden>·</span>
                <span className={teLaat ? 'text-destructive font-medium' : ''}>
                  {deadlineLabel(taak, now)}{teLaat ? ' · te laat' : ''}
                </span>
              </>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span className="italic">Zonder datum</span>
              </>
            )}
            {taak.notities && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate max-w-[240px] opacity-80">{taak.notities}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PrioriteitBadge prioriteit={taak.prioriteit} />
          {!isAfgerond && <TaakStatusBadge status={taak.status} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                className="opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-muted transition"
                aria-label="Acties"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
              {!isAfgerond && (
                <>
                  <DropdownMenuItem onClick={(e) => togglAfvinken(e as any, taak)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Afronden
                  </DropdownMenuItem>
                  {!isWachten && (
                    <DropdownMenuItem onClick={(e) => setWachten(e as any, taak)}>
                      <Clock className="h-4 w-4 mr-2" /> Op wachten zetten
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Snooze</DropdownMenuLabel>
                  <DropdownMenuItem onClick={(e) => snooze(e as any, taak, 1)}>Morgen</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => snooze(e as any, taak, 2)}>Over 2 dagen</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => snooze(e as any, taak, 7)}>Volgende week</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {rel && (
                <DropdownMenuItem asChild>
                  <Link to={`/relaties/${rel.id}`} onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Open relatie
                  </Link>
                </DropdownMenuItem>
              )}
              {obj && (
                <DropdownMenuItem asChild>
                  <Link to={`/objecten/${obj.id}`} onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Open object
                  </Link>
                </DropdownMenuItem>
              )}
              {deal && (
                <DropdownMenuItem asChild>
                  <Link to={`/deals/${deal.id}`} onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Open deal
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Taken"
        subtitle={
          <span className="text-sm text-muted-foreground">
            Vandaag <span className="font-medium text-foreground tabular-nums">{stats.vandaag}</span>
            <span className="mx-1.5">·</span>
            <span className={stats.teLaat > 0 ? 'text-destructive' : ''}>Te laat <span className="font-medium tabular-nums">{stats.teLaat}</span></span>
            <span className="mx-1.5">·</span>
            Wachten <span className="font-medium text-foreground tabular-nums">{stats.wachten}</span>
            <span className="mx-1.5">·</span>
            Afgerond <span className="font-medium text-foreground tabular-nums">{stats.afgerond}</span>
          </span>
        }
        actions={
          <button onClick={() => { setEditTaak(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Nieuwe taak
          </button>
        }
      />

      {/* Tabs als chips */}
      <div className="flex flex-wrap gap-1.5 -mx-1 px-1 overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.value;
          const count =
            t.value === 'focus'    ? undefined :
            t.value === 'vandaag'  ? stats.vandaag :
            t.value === 'te_laat'  ? stats.teLaat :
            t.value === 'deze_week'? stats.dezeWeek :
            t.value === 'wachten'  ? stats.wachten :
            t.value === 'alles'    ? stats.open :
            stats.afgerond;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40'
              } ${t.value === 'te_laat' && !active && stats.teLaat > 0 ? 'text-destructive border-destructive/40' : ''}`}
            >
              {t.label}
              {count !== undefined && <span className="ml-1.5 tabular-nums opacity-80">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op taak, relatie, object, notitie…" className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value as TaakPrioriteit | '')}>
          <option value="">Alle prioriteiten</option>
          <option value="urgent">Urgent</option>
          <option value="hoog">Hoog</option>
          <option value="normaal">Normaal</option>
          <option value="laag">Laag</option>
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Alle types</option>
          {TAAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaakStatus | '')}>
          <option value="">Alle statussen</option>
          <option value="open">Open</option>
          <option value="wacht_op_reactie">Wachten op reactie</option>
          <option value="in_uitvoering">In uitvoering</option>
          <option value="afgerond">Afgerond</option>
          <option value="geannuleerd">Geannuleerd</option>
        </select>
        <div className="sm:ml-auto">
          <SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} />
        </div>
      </div>

      {zichtbaar.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Geen taken in deze weergave.</p>
        </div>
      ) : (
        <div className="section-card overflow-hidden">
          <header className="section-header">
            <h2 className="section-title flex items-center gap-2">
              {TABS.find(t => t.value === tab)?.label}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">{zichtbaar.length}</span>
          </header>
          <div className="divide-y divide-border/70">
            {zichtbaar.map(renderTaak)}
          </div>
        </div>
      )}

      <TaakFormDialog open={formOpen} onOpenChange={setFormOpen} taak={editTaak} />
      <TaakAfrondenDialog
        open={!!afrondenTaak}
        onOpenChange={(v) => { if (!v) setAfrondenTaak(null); }}
        taak={afrondenTaak}
      />
    </div>
  );
}
