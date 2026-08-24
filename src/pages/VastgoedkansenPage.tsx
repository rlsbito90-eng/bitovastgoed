import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Archive, CheckSquare2, Database, Filter, MapPin, Pencil, PlayCircle, Plus, Radar, RotateCcw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { useVastgoedkansLijstTaken } from '@/hooks/useVastgoedkansLijstTaken';
import { useActieveVastgoedkansSelectieIds, useVoegVastgoedkansToeAanAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import {
  BRIEF_LABEL,
  EIGENAAR_LABEL,
  HERKOMST_LABEL,
  PRIORITEIT_LABEL,
  STATUS_LABEL,
  STATUS_VOLGORDE,
  kansTitel,
  type BriefStatus,
  type EigenaarOnderzoekStatus,
  type Vastgoedkans,
  type VastgoedkansHerkomst,
  type VastgoedkansStatus,
} from '@/lib/vastgoedkansen';
import {
  bewaarVastgoedkansLijstWorkspace,
  bewaarVastgoedkansWerkcontext,
  bepaalPrimaireWerkTab,
  bepaalVastgoedkansActieContext,
  filterEnSorteerVastgoedkansen,
  leesVastgoedkansLijstWorkspace,
  leesVastgoedkansWerkcontext,
  legeVastgoedkansFilters,
  telActieveVastgoedkansFilters,
  type VastgoedkansLijstFilters,
  type VastgoedkansSortering,
  type VastgoedkansWerkbak,
} from '@/lib/vastgoedkansWorkspace';
import {
  bepaalVastgoedkansActieContextMetTaak,
  bepaalVastgoedkansTaakConsistentie,
  filterEnSorteerVastgoedkansenMetTaken,
  VASTGOEDKANS_TAAK_PRIORITEIT_LABEL,
} from '@/lib/vastgoedkansTakenWerkvoorraad';
import { VASTGOEDKANS_STATUS_PRESENTATIE, vastgoedkansStatusChipClass, vastgoedkansStatusRowClass } from '@/lib/vastgoedkansStatusPresentation';
import VastgoedkansFormDialog from '@/components/forms/VastgoedkansFormDialog';
import PandenverkennerBulkBriefDialog from '@/components/acquisitie/PandenverkennerBulkBriefDialog';
import PandenverkennerBulkKadasterDialog from '@/components/acquisitie/PandenverkennerBulkKadasterDialog';

const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm';
const SORTERING_LABEL: Record<VastgoedkansSortering, string> = {
  recent: 'Recent gewijzigd',
  werkvolgorde: 'Werkvolgorde',
  prioriteit: 'Prioriteit',
  score: 'Score hoog → laag',
  adres: 'Plaats / adres',
  opvolgdatum: 'Actiedatum',
};
const HERKOMSTEN = Object.keys(HERKOMST_LABEL) as VastgoedkansHerkomst[];
const EIGENAAR_STATUSSEN = Object.keys(EIGENAAR_LABEL) as EigenaarOnderzoekStatus[];
const BRIEF_STATUSSEN = Object.keys(BRIEF_LABEL) as BriefStatus[];

const toggleInArray = <T,>(waarden: T[], waarde: T): T[] =>
  waarden.includes(waarde) ? waarden.filter((item) => item !== waarde) : [...waarden, waarde];

const actieBadgeClass = (urgentie: ReturnType<typeof bepaalVastgoedkansActieContext>['urgentie']): string => {
  if (urgentie === 'verlopen') return 'border-destructive/40 bg-destructive/10 text-destructive';
  if (urgentie === 'vandaag') return 'border-primary/40 bg-primary/10 text-primary';
  if (urgentie === 'gepland') return 'border-border bg-muted/40 text-foreground';
  if (urgentie === 'zonder_datum') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-border bg-muted/20 text-muted-foreground';
};

export default function VastgoedkansenPage() {
  const { kansen, archief, laden, bulkUpdateKansen, archiveKansen, restoreKansen } = useVastgoedkansen();
  const { taakPerKansId } = useVastgoedkansLijstTaken();
  const actieveAcquisitieIds = useActieveVastgoedkansSelectieIds();
  const voegToeAanAcquisitie = useVoegVastgoedkansToeAanAcquisitieSelectie();
  const init = useMemo(() => leesVastgoedkansLijstWorkspace(), []);
  const [werkbak, setWerkbakState] = useState<VastgoedkansWerkbak>(init.werkbak);
  const [q, setQ] = useState(init.zoekterm);
  const [sortering, setSortering] = useState<VastgoedkansSortering>(init.sortering);
  const [filters, setFilters] = useState<VastgoedkansLijstFilters>(init.filters);
  const [form, setForm] = useState<{ open: boolean; kans: Vastgoedkans | null }>({ open: false, kans: null });
  const [selectieModus, setSelectieModus] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [bevestigActie, setBevestigActie] = useState<'archiveren' | 'heropenen' | null>(null);
  const [bulkBezig, setBulkBezig] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPrioriteit, setBulkPrioriteit] = useState('');
  const [bulkBriefOpen, setBulkBriefOpen] = useState(false);
  const [bulkKadasterOpen, setBulkKadasterOpen] = useState(false);
  const [alleenControleNodig, setAlleenControleNodig] = useState(false);
  const hervat = useMemo(() => leesVastgoedkansWerkcontext(), [kansen.length]);
  const hervatKans = hervat ? kansen.find((kans) => kans.id === hervat.kansId) : null;

  useEffect(() => {
    bewaarVastgoedkansLijstWorkspace({ werkbak, zoekterm: q, sortering, filters });
  }, [werkbak, q, sortering, filters]);

  const setWerkbak = (volgende: VastgoedkansWerkbak) => {
    setAlleenControleNodig(false);
    setWerkbakState(volgende);
    setGeselecteerd(new Set());
  };

  const openControleNodig = () => {
    setWerkbakState('alles');
    setAlleenControleNodig(true);
    setGeselecteerd(new Set());
  };

  const counts = useMemo(
    () => Object.fromEntries(STATUS_VOLGORDE.map((status) => [status, kansen.filter((kans) => kans.status === status).length])),
    [kansen],
  );
  const controleNodigIds = useMemo(() => new Set(
    kansen
      .filter((kans) => bepaalVastgoedkansTaakConsistentie(kans, taakPerKansId.get(kans.id)))
      .map((kans) => kans.id),
  ), [kansen, taakPerKansId]);
  const basis = werkbak === 'archief' ? archief : kansen;
  const basisList = useMemo(
    () => werkbak === 'archief'
      ? filterEnSorteerVastgoedkansen(basis, { werkbak, zoekterm: q, sortering, filters })
      : filterEnSorteerVastgoedkansenMetTaken(basis, { werkbak, zoekterm: q, sortering, filters }, taakPerKansId),
    [basis, werkbak, q, sortering, filters, taakPerKansId],
  );
  const list = useMemo(
    () => alleenControleNodig ? basisList.filter((kans) => controleNodigIds.has(kans.id)) : basisList,
    [alleenControleNodig, basisList, controleNodigIds],
  );
  const listIds = useMemo(() => list.map((kans) => kans.id), [list]);
  const zichtbareIdSet = useMemo(() => new Set(listIds), [listIds]);
  const geselecteerdZichtbaar = useMemo(
    () => [...geselecteerd].filter((id) => zichtbareIdSet.has(id)),
    [geselecteerd, zichtbareIdSet],
  );
  const geselecteerdeKansen = useMemo(
    () => list.filter((kans) => geselecteerd.has(kans.id)),
    [list, geselecteerd],
  );
  const alleZichtbaarGeselecteerd = list.length > 0 && list.every((kans) => geselecteerd.has(kans.id));
  const actieveFilters = telActieveVastgoedkansFilters(filters);

  const toggleKans = (id: string) => setGeselecteerd((vorig) => {
    const volgende = new Set(vorig);
    if (volgende.has(id)) volgende.delete(id); else volgende.add(id);
    return volgende;
  });
  const toggleAlles = () => setGeselecteerd((vorig) => {
    const volgende = new Set(vorig);
    if (alleZichtbaarGeselecteerd) listIds.forEach((id) => volgende.delete(id));
    else listIds.forEach((id) => volgende.add(id));
    return volgende;
  });
  const stopSelecteren = () => { setSelectieModus(false); setGeselecteerd(new Set()); };

  const bewaarOpenContext = (kans: Vastgoedkans) => {
    bewaarVastgoedkansWerkcontext({
      tab: bepaalPrimaireWerkTab(kans),
      kansId: kans.id,
      werkbak,
      zoekterm: q,
      ids: listIds,
    });
  };

  const voegSelectieToeAanAcquisitie = async () => {
    const toeTeVoegen = geselecteerdZichtbaar.filter((id) => !actieveAcquisitieIds.has(id));
    if (toeTeVoegen.length === 0) {
      toast.info('Alle geselecteerde zichtbare Vastgoedkansen staan al in de acquisitieselectie.');
      return;
    }
    try {
      for (const id of toeTeVoegen) await voegToeAanAcquisitie.mutateAsync(id);
      toast.success(`${toeTeVoegen.length} Vastgoedkans${toeTeVoegen.length === 1 ? '' : 'en'} toegevoegd aan de acquisitieselectie.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Toevoegen aan acquisitieselectie mislukt.');
    }
  };

  const pasBulkStatusToe = async () => {
    if (!bulkStatus || geselecteerdZichtbaar.length === 0) return;
    setBulkBezig(true);
    try {
      await bulkUpdateKansen(geselecteerdZichtbaar, { status: bulkStatus as VastgoedkansStatus });
      toast.success(`Status bijgewerkt voor ${geselecteerdZichtbaar.length} vastgoedkans${geselecteerdZichtbaar.length === 1 ? '' : 'en'}.`);
      setGeselecteerd(new Set());
      setBulkStatus('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status wijzigen mislukt.');
    } finally {
      setBulkBezig(false);
    }
  };

  const pasBulkPrioriteitToe = async () => {
    const prioriteit = Number(bulkPrioriteit);
    if (!prioriteit || geselecteerdZichtbaar.length === 0) return;
    setBulkBezig(true);
    try {
      await bulkUpdateKansen(geselecteerdZichtbaar, { prioriteit });
      toast.success(`Prioriteit bijgewerkt voor ${geselecteerdZichtbaar.length} vastgoedkans${geselecteerdZichtbaar.length === 1 ? '' : 'en'}.`);
      setGeselecteerd(new Set());
      setBulkPrioriteit('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Prioriteit wijzigen mislukt.');
    } finally {
      setBulkBezig(false);
    }
  };

  const voerBulkActieUit = async () => {
    const ids = geselecteerdZichtbaar;
    if (!bevestigActie || ids.length === 0) return;
    setBulkBezig(true);
    try {
      if (bevestigActie === 'archiveren') {
        await archiveKansen(ids);
        toast.success(`${ids.length} vastgoedkans${ids.length === 1 ? '' : 'en'} gearchiveerd.`);
      } else {
        await restoreKansen(ids);
        toast.success(`${ids.length} vastgoedkans${ids.length === 1 ? '' : 'en'} heropend.`);
      }
      setGeselecteerd(new Set());
      setBevestigActie(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulkactie mislukt.');
    } finally {
      setBulkBezig(false);
    }
  };

  const wijzigFilter = <K extends keyof VastgoedkansLijstFilters>(key: K, waarde: VastgoedkansLijstFilters[K][number]) => {
    setFilters((vorig) => ({ ...vorig, [key]: toggleInArray(vorig[key] as any[], waarde) } as VastgoedkansLijstFilters));
  };

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <PageHeader
      title="Vastgoedkansen"
      subtitle="List Workspace voor beoordelen, selecteren en doorwerken naar acquisitie."
      actions={<div className="flex flex-wrap gap-2">
        <Button variant={selectieModus ? 'secondary' : 'outline'} onClick={() => selectieModus ? stopSelecteren() : setSelectieModus(true)}>
          {selectieModus ? <X className="mr-1.5 h-4 w-4" /> : <CheckSquare2 className="mr-1.5 h-4 w-4" />}
          {selectieModus ? 'Stop selecteren' : 'Selecteren'}
        </Button>
        <Button variant="outline" onClick={() => setForm({ open: true, kans: null })}><Plus className="mr-1.5 h-4 w-4" />Nieuwe kans</Button>
        <Button asChild><Link to="/vastgoedkansen/vinden"><Radar className="mr-1.5 h-4 w-4" />Panden vinden</Link></Button>
      </div>}
    />

    {hervatKans && werkbak !== 'archief' && <section className="section-card border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Verder waar je gebleven was</p>
          <p className="mt-1 truncate text-sm font-medium">{kansTitel(hervatKans)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{STATUS_LABEL[hervatKans.status]} · {hervat?.tab === 'kadaster' ? 'Kadaster & eigenaar' : hervat?.tab === 'brieven' ? 'Brieven & opvolging' : hervat?.tab === 'dossier' ? 'Dossier' : hervat?.tab === 'onderzoek' ? 'Onderzoek' : 'Overzicht'}</p>
        </div>
        <Button asChild><Link to={`/vastgoedkansen/${hervatKans.id}`}><PlayCircle className="mr-1.5 h-4 w-4" />Doorgaan</Link></Button>
      </div>
    </section>}

    <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
      {STATUS_VOLGORDE.map((status) => <button key={status} onClick={() => setWerkbak(status)} className={vastgoedkansStatusChipClass(status, werkbak === status && !alleenControleNodig)}>{STATUS_LABEL[status]} <span className="ml-1 opacity-70">{counts[status]}</span></button>)}
      <button onClick={() => setWerkbak('alles')} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${werkbak === 'alles' && !alleenControleNodig ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}>Alles {kansen.length}</button>
      <button onClick={openControleNodig} data-testid="vastgoedkansen-controle-nodig-filter" className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${alleenControleNodig ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'bg-card text-muted-foreground'}`}><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Controle nodig {controleNodigIds.size}</button>
      <button onClick={() => setWerkbak('archief')} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${werkbak === 'archief' && !alleenControleNodig ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}><Archive className="mr-1 inline h-3.5 w-3.5" />Archief {archief.length}</button>
    </div>

    <section className="section-card space-y-3 p-3 sm:p-4" data-testid="vastgoedkansen-list-workspace-controls">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="min-w-0 pl-9" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Zoek adres, plaats, type, eigenaar, actie, kansnummer of reden…" />
        </div>
        <select className={`${selectClass} min-w-[180px]`} value={sortering} onChange={(event) => setSortering(event.target.value as VastgoedkansSortering)} aria-label="Sorteer vastgoedkansen">
          {(Object.keys(SORTERING_LABEL) as VastgoedkansSortering[]).map((waarde) => <option key={waarde} value={waarde}>{SORTERING_LABEL[waarde]}</option>)}
        </select>
      </div>

      <details className="rounded-md border bg-muted/10 p-3" open={actieveFilters > 0}>
        <summary className="cursor-pointer text-sm font-medium"><Filter className="mr-1.5 inline h-4 w-4" />Filters{actieveFilters ? ` (${actieveFilters})` : ''}</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Prioriteit</legend><div className="flex flex-wrap gap-2">{[1,2,3,4,5].map((p) => <label key={p} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"><Checkbox checked={filters.prioriteiten.includes(p)} onCheckedChange={() => wijzigFilter('prioriteiten', p)} />P{p}</label>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Herkomst</legend><div className="flex flex-wrap gap-2">{HERKOMSTEN.map((waarde) => <label key={waarde} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"><Checkbox checked={filters.herkomsten.includes(waarde)} onCheckedChange={() => wijzigFilter('herkomsten', waarde)} />{HERKOMST_LABEL[waarde]}</label>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Eigenaar</legend><div className="flex flex-wrap gap-2">{EIGENAAR_STATUSSEN.map((waarde) => <label key={waarde} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"><Checkbox checked={filters.eigenaar.includes(waarde)} onCheckedChange={() => wijzigFilter('eigenaar', waarde)} />{EIGENAAR_LABEL[waarde]}</label>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Brief</legend><div className="flex flex-wrap gap-2">{BRIEF_STATUSSEN.map((waarde) => <label key={waarde} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"><Checkbox checked={filters.brief.includes(waarde)} onCheckedChange={() => wijzigFilter('brief', waarde)} />{BRIEF_LABEL[waarde]}</label>)}</div></fieldset>
        </div>
        {actieveFilters > 0 && <Button className="mt-3" size="sm" variant="ghost" onClick={() => setFilters(legeVastgoedkansFilters())}><X className="mr-1.5 h-3.5 w-3.5" />Wis filters</Button>}
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{list.length}</strong> zichtbaar van {alleenControleNodig ? controleNodigIds.size : basis.length}{alleenControleNodig ? ' · alleen controlepunten' : ''}</span>
        <span>Weergave wordt automatisch onthouden</span>
      </div>
    </section>

    {selectieModus && <section className="section-card space-y-3 p-3 sm:p-4" data-testid="vastgoedkansen-bulk-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Checkbox checked={alleZichtbaarGeselecteerd} onCheckedChange={toggleAlles} aria-label="Selecteer alle zichtbare vastgoedkansen" />
          <div><p className="text-sm font-medium">{geselecteerd.size} geselecteerd{geselecteerd.size !== geselecteerdZichtbaar.length ? ` · ${geselecteerdZichtbaar.length} zichtbaar` : ''}</p><p className="text-xs text-muted-foreground">Alle bulkacties gelden uitsluitend voor geselecteerde kansen in de huidige weergave.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {werkbak === 'archief'
            ? <Button variant="outline" disabled={geselecteerdZichtbaar.length === 0} onClick={() => setBevestigActie('heropenen')}><RotateCcw className="mr-1.5 h-4 w-4" />Heropenen</Button>
            : <>
              <Button variant="outline" disabled={geselecteerdZichtbaar.length === 0 || bulkBezig} onClick={() => setBulkKadasterOpen(true)}>Bulk Kadaster</Button>
              <Button variant="outline" disabled={geselecteerdZichtbaar.length === 0 || bulkBezig} onClick={() => setBulkBriefOpen(true)}>Brieven voorbereiden</Button>
              <Button variant="secondary" disabled={geselecteerdZichtbaar.length === 0 || voegToeAanAcquisitie.isPending || bulkBezig} onClick={() => void voegSelectieToeAanAcquisitie()}>Naar acquisitieselectie</Button>
              <Button variant="outline" disabled={geselecteerdZichtbaar.length === 0 || bulkBezig} onClick={() => setBevestigActie('archiveren')}><Archive className="mr-1.5 h-4 w-4" />Archiveren</Button>
            </>}
        </div>
      </div>

      {werkbak !== 'archief' && <div className="flex flex-wrap gap-3 border-t pt-3">
        <div className="flex gap-2">
          <select className={selectClass} value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} aria-label="Nieuwe bulkstatus"><option value="">Status kiezen…</option>{STATUS_VOLGORDE.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select>
          <Button variant="outline" disabled={!bulkStatus || geselecteerdZichtbaar.length === 0 || bulkBezig} onClick={() => void pasBulkStatusToe()}>Status toepassen</Button>
        </div>
        <div className="flex gap-2">
          <select className={selectClass} value={bulkPrioriteit} onChange={(event) => setBulkPrioriteit(event.target.value)} aria-label="Nieuwe bulkprioriteit"><option value="">Prioriteit kiezen…</option>{[1,2,3,4,5].map((p) => <option key={p} value={p}>{PRIORITEIT_LABEL[p]}</option>)}</select>
          <Button variant="outline" disabled={!bulkPrioriteit || geselecteerdZichtbaar.length === 0 || bulkBezig} onClick={() => void pasBulkPrioriteitToe()}>Prioriteit toepassen</Button>
        </div>
      </div>}
    </section>}

    <section className="section-card min-w-0 overflow-hidden">
      {laden ? <p className="p-8 text-sm text-muted-foreground">Laden…</p> : list.length === 0 ? <div className="p-10 text-center"><Database className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm text-muted-foreground">{werkbak === 'archief' ? 'Geen gearchiveerde vastgoedkansen in deze weergave.' : alleenControleNodig ? 'Geen open taken op afgesloten dossiers. Er is nu niets te controleren.' : 'Geen vastgoedkansen binnen deze werkbak en filters.'}</p></div> : <div className="divide-y divide-border/70">
        {list.map((kans) => {
          const leidendeTaak = werkbak === 'archief' ? null : taakPerKansId.get(kans.id) ?? null;
          const actie = bepaalVastgoedkansActieContextMetTaak(kans, leidendeTaak);
          const taakWaarschuwing = bepaalVastgoedkansTaakConsistentie(kans, leidendeTaak);
          return <div key={kans.id} className={`flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5 ${vastgoedkansStatusRowClass(kans.status)}`}>
            {selectieModus && <Checkbox className="mt-1 shrink-0" checked={geselecteerd.has(kans.id)} onCheckedChange={() => toggleKans(kans.id)} aria-label={`Selecteer ${kansTitel(kans)}`} />}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link to={`/vastgoedkansen/${kans.id}`} onClick={() => bewaarOpenContext(kans)} className="min-w-0 break-words text-sm font-medium hover:text-primary hover:underline">{kansTitel(kans)}</Link>
                {kans.kansnummer && <span className="text-[11px] font-mono-data text-muted-foreground">{kans.kansnummer}</span>}
                <Badge variant="outline" className={VASTGOEDKANS_STATUS_PRESENTATIE[kans.status].chip}>{STATUS_LABEL[kans.status]}</Badge>
                <Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge>
                {kans.algoritmeScore != null && <Badge variant="secondary">Score {kans.algoritmeScore}</Badge>}
                {werkbak === 'archief' && <Badge variant="secondary">Gearchiveerd</Badge>}
              </div>
              {kans.korteOmschrijving && <p className="mt-0.5 text-xs text-muted-foreground">{[kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ')}</p>}
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground"><span>{kans.typeVastgoed || 'Type onbekend'}</span><span>· {HERKOMST_LABEL[kans.herkomst]}</span><span>· Eigenaar: {kans.eigenaarNaam?.trim() || EIGENAAR_LABEL[kans.eigenaarStatus]}</span><span>· Brief: {BRIEF_LABEL[kans.briefStatus]}</span></p>
              {actie.urgentie !== 'geen_actie' && <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs" data-testid="vastgoedkans-volgende-actie">
                {leidendeTaak && <Badge variant="secondary">Taak</Badge>}
                {leidendeTaak && <Badge variant="outline">Prioriteit {VASTGOEDKANS_TAAK_PRIORITEIT_LABEL[leidendeTaak.prioriteit]}</Badge>}
                <Badge variant="outline" className={actieBadgeClass(actie.urgentie)}>{actie.urgentieLabel}</Badge>
                <span className="min-w-0 font-medium text-foreground">{actie.omschrijving || 'Opvolgen'}</span>
                {actie.datumLabel && <span className="text-muted-foreground">· {actie.datumLabel}</span>}
              </div>}
              {taakWaarschuwing && <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300" data-testid="vastgoedkans-taak-consistentie-waarschuwing"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{taakWaarschuwing.label} — controleer of de taak nog nodig is.</div>}
              {werkbak === 'archief' && kans.archivedAt && <p className="mt-1 text-xs text-muted-foreground">Gearchiveerd {new Date(kans.archivedAt).toLocaleDateString('nl-NL')}{kans.archivedReason ? ` · ${kans.archivedReason}` : ''}</p>}
              {kans.redenInteressant && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{kans.redenInteressant}</p>}
            </div>
            {!selectieModus && <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, kans })} aria-label="Bewerken" className="shrink-0"><Pencil className="h-4 w-4" /></Button>}
          </div>;
        })}
      </div>}
    </section>

    <div className="flex min-w-0 gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><p>Open een kans om binnen exact deze gefilterde en gesorteerde lijst met vorige/volgende door te werken.</p></div>
    <VastgoedkansFormDialog open={form.open} onOpenChange={(open) => setForm({ open, kans: open ? form.kans : null })} kans={form.kans} />
    <PandenverkennerBulkKadasterDialog open={bulkKadasterOpen} onOpenChange={setBulkKadasterOpen} kansen={geselecteerdeKansen} />
    <PandenverkennerBulkBriefDialog open={bulkBriefOpen} onOpenChange={setBulkBriefOpen} kansen={geselecteerdeKansen} />

    <AlertDialog open={bevestigActie !== null} onOpenChange={(open) => { if (!open && !bulkBezig) setBevestigActie(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{bevestigActie === 'heropenen' ? 'Vastgoedkansen heropenen?' : 'Vastgoedkansen archiveren?'}</AlertDialogTitle>
          <AlertDialogDescription>{bevestigActie === 'heropenen' ? `${geselecteerdZichtbaar.length} geselecteerde vastgoedkans${geselecteerdZichtbaar.length === 1 ? '' : 'en'} worden teruggezet in de actieve werkvoorraad.` : `${geselecteerdZichtbaar.length} geselecteerde vastgoedkans${geselecteerdZichtbaar.length === 1 ? '' : 'en'} verdwijnen uit de actieve werkvoorraad, maar blijven met historie beschikbaar in Archief.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={bulkBezig}>Annuleren</AlertDialogCancel>
          <AlertDialogAction disabled={bulkBezig} onClick={(event) => { event.preventDefault(); void voerBulkActieUit(); }}>{bulkBezig ? 'Bezig…' : bevestigActie === 'heropenen' ? 'Heropenen' : 'Archiveren'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
