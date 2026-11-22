import { useState, useEffect, useMemo, useRef } from 'react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Taak, TaakPrioriteit, TaakStatus } from '@/data/mock-data';
import { Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { TAAK_TYPES, TAAK_STATUSES } from '@/lib/taakHelpers';
import { getNotificationPreferences } from '@/lib/notifications/repository';
import {
  TASK_REMINDER_OFFSETS,
  createManualTaskWithReminder,
  formatReminderOffset,
  getTaskReminderSelection,
  updateManualTaskWithReminder,
  type TaskReminderSelection,
  type ManualTaskPlanning,
} from '@/lib/tasks/reminders';
import { getTaskPlanning, updateTaskPlanning } from '@/lib/tasks/planning';
import TaakWerkplanningVelden from '@/components/tasks/TaakWerkplanningVelden';
import {
  listTaskLinks,
  replaceTaskLinks,
  type TaskLinkEntityType,
} from '@/lib/tasks/links';
import TaskLinksPickerDialog, {
  countTaskLinks,
  EMPTY_TASK_LINK_SELECTION,
  taskLinkSelectionFromLegacy,
  replacePrimaryTaskLink,
  type TaskLinkSelection,
} from '@/components/tasks/TaskLinksPickerDialog';
import EntityPicker, { type EntityPickerItem } from './EntityPicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (taskId: string) => void;
  taak?: Taak | null;
  defaultRelatieId?: string;
  defaultDealId?: string;
  defaultObjectId?: string;
  defaultOffMarketSignaalId?: string;
  /** Prefill voor nieuwe taak (genegeerd bij edit). */
  defaultTitel?: string;
  defaultType?: string;
  defaultPrioriteit?: TaakPrioriteit;
  /** ISO date YYYY-MM-DD voor deadline (genegeerd bij edit). */
  defaultDeadline?: string;
  /** Prefill notities/context (genegeerd bij edit). */
  defaultNotities?: string;
}

const emptyForm = {
  titel: '',
  relatieId: '',
  dealId: '',
  objectId: '',
  offMarketSignaalId: '',
  type: 'Algemeen',
  deadline: '',
  deadlineTijd: '',
  prioriteit: 'normaal' as TaakPrioriteit,
  status: 'open' as TaakStatus,
  notities: '',
};

const RECENT_KEY = 'taak-picker-recent';
const readRecent = (kind: string): string[] => {
  try {
    const raw = localStorage.getItem(`${RECENT_KEY}:${kind}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const pushRecent = (kind: string, id: string) => {
  if (!id) return;
  try {
    const cur = readRecent(kind).filter(x => x !== id);
    cur.unshift(id);
    localStorage.setItem(`${RECENT_KEY}:${kind}`, JSON.stringify(cur.slice(0, 8)));
  } catch { /* noop */ }
};

const norm = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

function mergeTaskLinks(base: TaskLinkSelection, rows: Awaited<ReturnType<typeof listTaskLinks>>): TaskLinkSelection {
  const next: TaskLinkSelection = {
    relatie: [...base.relatie],
    deal: [...base.deal],
    object: [...base.object],
    signaal: [...base.signaal],
  };
  rows.forEach(row => {
    if (!next[row.entityType].includes(row.entityId)) next[row.entityType].push(row.entityId);
  });
  return next;
}

function taskLinkRows(selection: TaskLinkSelection) {
  return (Object.entries(selection) as [TaskLinkEntityType, string[]][]).flatMap(([entityType, ids]) =>
    ids.map((entityId, index) => ({ entityType, entityId, isPrimary: index === 0 })),
  );
}

export default function TaakFormDialog({ open, onOpenChange, onSaved, taak, defaultRelatieId, defaultDealId, defaultObjectId, defaultOffMarketSignaalId, defaultTitel, defaultType, defaultPrioriteit, defaultDeadline, defaultNotities }: Props) {
  const { deleteTaak, refresh, relaties, deals, objecten, getObjectById, getRelatieById, contactpersonen } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const [reminderSelection, setReminderSelection] = useState<TaskReminderSelection>('default');
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState<number | null>(60);
  const [workPlan,setWorkPlan] = useState<ManualTaskPlanning>({planDatum:null,planTijd:null,planningBucket:'open',reminderMode:'none'});
  const [workPlanLoaded,setWorkPlanLoaded] = useState(true);
  const [workPlanError,setWorkPlanError] = useState<string|null>(null);
  const [workPlanDirty,setWorkPlanDirty] = useState(false);
  const [workReminderTouched,setWorkReminderTouched] = useState(false);
  const pendingCreatedTaskId = useRef<string|null>(null);
  const [taskLinks, setTaskLinks] = useState<TaskLinkSelection>(EMPTY_TASK_LINK_SELECTION);
  const [taskLinksOpen, setTaskLinksOpen] = useState(false);
  const [linksLoaded,setLinksLoaded] = useState(true);
  const [linksLoadError,setLinksLoadError] = useState<string|null>(null);
  const [linksDirty, setLinksDirty] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  const [deadlineExpanded,setDeadlineExpanded] = useState(false);
  const [notesExpanded,setNotesExpanded] = useState(false);
  const isEdit = !!taak;

  useEffect(() => {
    setDeadlineExpanded(Boolean(taak?.deadline||defaultDeadline));
    setNotesExpanded(Boolean(taak?.notities||defaultNotities));
    if (taak) {
      setForm({
        titel: taak.titel,
        relatieId: taak.relatieId || '',
        dealId: taak.dealId || '',
        objectId: taak.objectId || '',
        offMarketSignaalId: taak.offMarketSignaalId || '',
        type: taak.type,
        deadline: taak.deadline || '',
        deadlineTijd: taak.deadlineTijd ? taak.deadlineTijd.slice(0, 5) : '',
        prioriteit: taak.prioriteit,
        status: taak.status,
        notities: taak.notities || '',
      });
    } else {
      setForm({
        ...emptyForm,
        titel: defaultTitel || '',
        type: defaultType || emptyForm.type,
        prioriteit: defaultPrioriteit || emptyForm.prioriteit,
        deadline: defaultDeadline || '',
        relatieId: defaultRelatieId || '',
        dealId: defaultDealId || '',
        objectId: defaultObjectId || '',
        offMarketSignaalId: defaultOffMarketSignaalId || '',
        notities: defaultNotities || '',
      });
      setReminderSelection('default');
    }
  }, [taak, open, defaultRelatieId, defaultDealId, defaultObjectId, defaultOffMarketSignaalId, defaultTitel, defaultType, defaultPrioriteit, defaultDeadline, defaultNotities]);

  useEffect(() => {
    const base = taskLinkSelectionFromLegacy({
      relatieId: taak?.relatieId ?? defaultRelatieId,
      dealId: taak?.dealId ?? defaultDealId,
      objectId: taak?.objectId ?? defaultObjectId,
      offMarketSignaalId: taak?.offMarketSignaalId ?? defaultOffMarketSignaalId,
    });
    setTaskLinks(base);
    setLinksDirty(false);
    setLinksLoadError(null);
    setLinksLoaded(!taak?.id);
    if (!open || !taak?.id) return;

    let cancelled = false;
    void listTaskLinks(taak.id)
      .then(rows => {
        if(cancelled)return;
        setTaskLinks(mergeTaskLinks(base, rows));
        setLinksLoaded(true);
      })
      .catch(error => {
        if(cancelled)return;
        console.error('Taakkoppelingen laden mislukt', error);
        setLinksLoadError('De bestaande koppelingen konden niet worden geladen. Sluit het formulier en probeer opnieuw.');
      });
    return () => { cancelled = true; };
  }, [open, taak?.id, taak?.relatieId, taak?.dealId, taak?.objectId, taak?.offMarketSignaalId, defaultRelatieId, defaultDealId, defaultObjectId, defaultOffMarketSignaalId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await getNotificationPreferences();
        if (!cancelled) setDefaultReminderMinutes(prefs.task_default_reminder_minutes ?? null);
        if (taak?.id) {
          const selection = await getTaskReminderSelection(taak.id);
          if (!cancelled) setReminderSelection(selection);
        }
      } catch (error) {
        console.error('Taakherinnering laden mislukt', error);
      }
    })();
    return () => { cancelled = true; };
  }, [open, taak?.id]);

  // Bij bestaande taken eerst de echte werkdatum laden, niet een lege
  // standaardwaarde tonen en die bij een andere wijziging overschrijven.
  useEffect(()=>{
    if(!open){
      pendingCreatedTaskId.current=null;
      return;
    }
    setWorkPlan({planDatum:null,planTijd:null,planningBucket:'open',reminderMode:'none'});
    setWorkPlanDirty(false);
    setWorkReminderTouched(Boolean(taak?.id));
    setWorkPlanError(null);
    setWorkPlanLoaded(!taak?.id);
    if(!taak?.id)return;
    let cancelled=false;
    void getTaskPlanning(taak.id)
      .then(row=>{
        if(cancelled)return;
        setWorkPlan({
          planDatum:row.planDatum,
          planTijd:row.planTijd,
          planningBucket:row.planningBucket,
          reminderMode:row.reminderMode,
        });
        setWorkPlanLoaded(true);
      })
      .catch(error=>{
        if(cancelled)return;
        console.error('Werkplanning laden mislukt',error);
        setWorkPlanError('De bestaande werkplanning kon niet worden geladen. Sluit dit formulier en probeer opnieuw.');
      });
    return ()=>{cancelled=true;};
  },[open,taak?.id]);

  const relatieItems = useMemo<EntityPickerItem[]>(() => {
    return relaties.map(r => {
      const { primair, secundair } = getRelatieNamen(r, contactpersonen);
      const cps = contactpersonen.filter(c => c.relatieId === r.id);
      const haystack = norm([
        primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email, r.telefoon,
        r.vestigingsplaats, r.type, r.notities,
        ...cps.flatMap(c => [c.naam, c.email, c.telefoon, c.functie]),
        ...(r.regio || []),
      ].filter(Boolean).join(' '));
      return { id: r.id, primair, secundair, searchHaystack: haystack };
    });
  }, [relaties, contactpersonen]);

  const { objectItemsActief, objectItemsArchief } = useMemo(() => {
    const map = (o: typeof objecten[number]): EntityPickerItem => {
      const primair = o.titel || o.adres || '(naamloos object)';
      const sec = [o.plaats, o.status].filter(Boolean).join(' · ');
      const haystack = norm([
        o.titel, o.adres, o.plaats, o.provincie, o.internReferentienummer,
        o.type, o.status,
      ].filter(Boolean).join(' '));
      return { id: o.id, primair, secundair: sec || null, searchHaystack: haystack };
    };
    return {
      objectItemsActief: objecten.filter(o => !o.isArchived).map(map),
      objectItemsArchief: objecten.filter(o => o.isArchived).map(map),
    };
  }, [objecten]);

  const { dealItemsActief, dealItemsArchief } = useMemo(() => {
    const map = (d: typeof deals[number]): EntityPickerItem => {
      const obj = getObjectById(d.objectId);
      const rel = getRelatieById(d.relatieId);
      const { primair: relNaam, secundair: relBedrijf } = getRelatieNamen(rel, contactpersonen);
      const primair = obj?.titel || obj?.adres || 'Deal';
      const sec = [relNaam, d.fase].filter(Boolean).join(' · ');
      const haystack = norm([
        obj?.titel, obj?.adres, obj?.plaats,
        relNaam, relBedrijf, rel?.bedrijfsnaam, rel?.contactpersoon,
        d.fase, d.notities,
      ].filter(Boolean).join(' '));
      return { id: d.id, primair, secundair: sec || null, searchHaystack: haystack };
    };
    return {
      dealItemsActief: deals.filter(d => !d.isArchived).map(map),
      dealItemsArchief: deals.filter(d => d.isArchived).map(map),
    };
  }, [deals, getObjectById, getRelatieById, contactpersonen]);

  const relevantDealIds = useMemo(() => {
    const ids = new Set<string>();
    deals.forEach(d => {
      if ((form.relatieId && d.relatieId === form.relatieId) ||
          (form.objectId && d.objectId === form.objectId)) {
        ids.add(d.id);
      }
    });
    return Array.from(ids);
  }, [deals, form.relatieId, form.objectId]);

  const relevantObjectIds = useMemo(() => {
    const ids = new Set<string>();
    if (form.dealId) {
      const d = deals.find(x => x.id === form.dealId);
      if (d) ids.add(d.objectId);
    }
    if (form.relatieId) {
      deals.forEach(d => { if (d.relatieId === form.relatieId) ids.add(d.objectId); });
    }
    return Array.from(ids);
  }, [deals, form.dealId, form.relatieId]);

  const relevantRelatieIds = useMemo(() => {
    const ids = new Set<string>();
    if (form.dealId) {
      const d = deals.find(x => x.id === form.dealId);
      if (d) ids.add(d.relatieId);
    }
    if (form.objectId) {
      deals.forEach(d => { if (d.objectId === form.objectId) ids.add(d.relatieId); });
    }
    return Array.from(ids);
  }, [deals, form.dealId, form.objectId]);

  /** Eén bron voor primaire én aanvullende CRM-koppelingen tijdens aanmaken. */
  const handleTaskLinksChange = (next: TaskLinkSelection) => {
    setTaskLinks(next);
    setLinksDirty(true);
    setForm(prev => ({
      ...prev,
      relatieId: next.relatie[0] || '',
      objectId: next.object[0] || '',
      dealId: next.deal[0] || '',
      offMarketSignaalId: next.signaal[0] || '',
    }));
  };

  const changePrimaryLink = (type: 'relatie' | 'object', id: string) => {
    handleTaskLinksChange(replacePrimaryTaskLink(taskLinks, type, id));
  };

  const handleDealChange = (id: string) => {
    let next = replacePrimaryTaskLink(taskLinks, 'deal', id);
    const selectedDeal = id ? deals.find(d => d.id === id) : null;
    // Een deal hoort bij een object. De relatie uit een legacy-deal kan echter
    // de verkoper zijn; die wordt daarom niet ongevraagd als koper gekoppeld.
    if (selectedDeal && next.object.length === 0) {
      next = replacePrimaryTaskLink(next, 'object', selectedDeal.objectId);
    }
    handleTaskLinksChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    if (!form.titel.trim()) {
      toast.error('Titel is verplicht');
      return;
    }
    if (!workPlanLoaded || !linksLoaded) {
      toast.error('De huidige werkplanning of koppelingen zijn nog niet beschikbaar. Probeer opnieuw.');
      return;
    }
    setBezig(true);

    const selectedLinks = taskLinks;

    const data = {
      titel: form.titel.trim(),
      relatieId: selectedLinks.relatie[0] || undefined,
      dealId: selectedLinks.deal[0] || undefined,
      objectId: selectedLinks.object[0] || undefined,
      offMarketSignaalId: selectedLinks.signaal[0] || undefined,
      type: form.type,
      deadline: form.deadline || undefined,
      deadlineTijd: form.deadline ? (form.deadlineTijd || undefined) : undefined,
      prioriteit: form.prioriteit,
      status: form.status,
      notities: form.notities || undefined,
      reminderSelection,
    };

    try {
      let savedTaskId: string;
      if (isEdit && taak) {
        savedTaskId = taak.id;
        await updateManualTaskWithReminder(taak.id, data);
        if(workPlanDirty)await updateTaskPlanning(taak.id,workPlan);
      } else if(pendingCreatedTaskId.current){
        savedTaskId = pendingCreatedTaskId.current;
        await updateManualTaskWithReminder(savedTaskId,data);
        await updateTaskPlanning(savedTaskId,workPlan);
      } else {
        // Nieuwe werkplanning in dezelfde database-insert als de taak zelf.
        savedTaskId = await createManualTaskWithReminder(data,workPlan);
        pendingCreatedTaskId.current = savedTaskId;
      }
      await replaceTaskLinks(savedTaskId, taskLinkRows(selectedLinks));
      await refresh();
      pendingCreatedTaskId.current=null;
      onSaved?.(savedTaskId);
      pushRecent('relatie', selectedLinks.relatie[0] || '');
      pushRecent('object', selectedLinks.object[0] || '');
      pushRecent('deal', selectedLinks.deal[0] || '');
      toast.success(isEdit ? 'Taak bijgewerkt' : 'Taak aangemaakt');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(pendingCreatedTaskId.current
        ? `Taak is al aangemaakt, maar de verwerking is nog niet volledig. Probeer opslaan opnieuw: ${err.message ?? 'onbekende fout'}`
        : `Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const handleDelete = async () => {
    if (!taak || bezig) return;
    setBezig(true);
    try {
      await deleteTaak(taak.id);
      toast.success('Taak verwijderd');
      setVerwijderOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({
    ...prev,
    [key]: val,
    ...(key === 'deadline' && !val ? { deadlineTijd: '' } : {}),
  }));

  const dirtyState = useMemo(() => ({ ...form, reminderSelection, linksDirty, workPlanDirty }), [form, reminderSelection, linksDirty, workPlanDirty]);
  const { guardedOnOpenChange } = useFormDirtyGuard(open, dirtyState, onOpenChange);
  const hasExactDeadline = Boolean(form.deadline && form.deadlineTijd);
  const handleWorkPlanChange=(next:ManualTaskPlanning)=>{
    setWorkPlan(next);
    setWorkPlanDirty(true);
  };
  const taskLinkCount = countTaskLinks(taskLinks);
  const linkedSummary = [
    taskLinks.relatie[0] ? relatieItems.find(item=>item.id===taskLinks.relatie[0])?.primair||'Relatie' : null,
    taskLinks.object[0] ? [...objectItemsActief,...objectItemsArchief].find(item=>item.id===taskLinks.object[0])?.primair||'Object' : null,
    taskLinks.deal[0] ? [...dealItemsActief,...dealItemsArchief].find(item=>item.id===taskLinks.deal[0])?.primair||'Deal' : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Dialog open={open} onOpenChange={guardedOnOpenChange}>
        <DialogContent className="flex h-[min(92dvh,800px)] max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b border-border/60 px-4 pb-3 pt-5 sm:px-6">
            <DialogTitle>{isEdit ? 'Taak bewerken' : 'Nieuwe taak'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <section className="space-y-2">
              {isEdit&&<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taakgegevens</h3>}
              <div className="space-y-1.5">
                <Label>Titel *</Label>
                <Input value={form.titel} onChange={e => set('titel', e.target.value)} placeholder="Wat moet er gedaan worden?" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="min-w-0 space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-xs sm:text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                    {TAAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="min-w-0 space-y-1">
                  <Label className="text-xs">Prioriteit</Label>
                  <select className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-xs sm:text-sm" value={form.prioriteit} onChange={e => set('prioriteit', e.target.value)}>
                    <option value="laag">Laag</option>
                    <option value="normaal">Normaal</option>
                    <option value="hoog">Hoog</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="min-w-0 space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-xs sm:text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                    {TAAK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <TaakWerkplanningVelden value={workPlan} onChange={handleWorkPlanChange}
                autoReminderOnTime={!workReminderTouched&&!isEdit}
                onReminderTouched={()=>setWorkReminderTouched(true)}
                disabled={!workPlanLoaded||bezig}/>
              {!workPlanLoaded&&<p role="status" className="text-xs text-muted-foreground">
                {workPlanError || 'Bestaande werkplanning laden…'}
              </p>}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Koppelingen</h3>
              {!linksLoaded&&<p role="status" className="text-xs text-muted-foreground">
                {linksLoadError || 'Bestaande koppelingen laden…'}
              </p>}
              {!isEdit?(
                <button type="button" onClick={()=>setTaskLinksOpen(true)}
                  disabled={!linksLoaded||bezig}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border/65 px-3 py-2 text-left text-sm hover:bg-muted/30 disabled:opacity-60">
                  <span className="flex min-w-0 items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground"/>
                    <span className="min-w-0 truncate">{linkedSummary||'Relatie, object of deal toevoegen'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-accent">{taskLinkCount||'+'}</span>
                </button>
              ):(
              <fieldset disabled={!linksLoaded||bezig} className="min-w-0">
                <div className="space-y-3">
                  <EntityPicker
                    label="Relatie"
                    pickerTitle="Kies relatie"
                    searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
                    emptyLabel="Geen gekoppelde relatie"
                    value={taskLinks.relatie[0] || ''}
                    onChange={(id) => changePrimaryLink('relatie', id)}
                    items={relatieItems}
                    relevantIds={relevantRelatieIds}
                    relevantLabel="Relevant voor selectie"
                    recentIds={readRecent('relatie')}
                  />
                  <EntityPicker
                    label="Object"
                    pickerTitle="Kies object"
                    searchPlaceholder="Zoek op adres, plaats, type…"
                    emptyLabel="Geen gekoppeld object"
                    value={taskLinks.object[0] || ''}
                    onChange={(id) => changePrimaryLink('object', id)}
                    items={objectItemsActief}
                    archivedItems={objectItemsArchief}
                    relevantIds={relevantObjectIds}
                    relevantLabel="Relevant voor selectie"
                    recentIds={readRecent('object')}
                  />
                  <EntityPicker
                    label="Deal"
                    pickerTitle="Kies deal"
                    searchPlaceholder="Zoek op object, relatie, fase…"
                    emptyLabel="Geen gekoppelde deal"
                    value={taskLinks.deal[0] || ''}
                    onChange={handleDealChange}
                    items={dealItemsActief}
                    archivedItems={dealItemsArchief}
                    relevantIds={relevantDealIds}
                    relevantLabel="Relevant voor selectie"
                    recentIds={readRecent('deal')}
                  />
                  <button type="button" onClick={() => setTaskLinksOpen(true)}
                    className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md px-2 text-left text-sm text-accent hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span>Meerdere koppelen</span>
                    {taskLinkCount > 0 && <span className="text-xs text-muted-foreground">· {taskLinkCount} gekoppeld</span>}
                  </button>
                </div>
              </fieldset>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex min-h-9 items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deadline</h3>
                {!isEdit&&!deadlineExpanded&&
                  <button type="button" onClick={()=>setDeadlineExpanded(true)}
                    className="min-h-9 rounded-lg px-2 text-sm text-accent hover:bg-muted/35">
                    + Toevoegen
                  </button>}
              </div>
              {(isEdit||deadlineExpanded)&&<>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Datum (optioneel)</Label>
                  <Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tijd (optioneel)</Label>
                  <Input type="time" value={form.deadlineTijd} onChange={e => set('deadlineTijd', e.target.value)} disabled={!form.deadline} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Herinnering bij deadline</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                  value={reminderSelection}
                  onChange={e => setReminderSelection(e.target.value as TaskReminderSelection)}
                  disabled={!form.deadline}
                >
                  <option value="default">
                    {hasExactDeadline ? `Standaard (${formatReminderOffset(defaultReminderMinutes)})` : 'Standaard (op de dag zelf)'}
                  </option>
                  <option value="none">Geen</option>
                  {hasExactDeadline && TASK_REMINDER_OFFSETS.map(minutes => (
                    <option key={minutes} value={String(minutes)}>{formatReminderOffset(minutes)}</option>
                  ))}
                </select>
                {form.deadline && !hasExactDeadline && (
                  <p className="text-xs text-muted-foreground">Zonder tijdstip wordt de melding op de geselecteerde dag verstuurd.</p>
                )}
              </div>
              {!isEdit&&
                <button type="button" className="min-h-9 text-xs text-muted-foreground hover:text-foreground"
                  onClick={()=>{set('deadline','');setDeadlineExpanded(false);setReminderSelection('default');}}>
                  Deadline verwijderen
                </button>}
              </>}
            </section>

            <section className="space-y-2">
              <div className="flex min-h-9 items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notities</h3>
                {!isEdit&&!notesExpanded&&
                  <button type="button" onClick={()=>setNotesExpanded(true)}
                    className="min-h-9 rounded-lg px-2 text-sm text-accent hover:bg-muted/35">
                    + Toevoegen
                  </button>}
              </div>
              {(isEdit||notesExpanded)&&
                <Textarea value={form.notities} onChange={e => set('notities', e.target.value)}
                  rows={2} placeholder="Optionele context, opvolging, aanvullende info…" />}
            </section>

            </div>
            <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <div>
                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setVerwijderOpen(true)}
                    disabled={bezig}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Verwijderen
                  </Button>
                )}
              </div>
              <div className="flex min-w-0 flex-1 justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
                <Button type="submit" className="min-w-0 flex-1 sm:flex-none"
                  disabled={bezig||!workPlanLoaded||!linksLoaded}>
                  {bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Taak aanmaken')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>

        <AlertDialog open={verwijderOpen} onOpenChange={setVerwijderOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>
                Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={bezig}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bezig ? 'Bezig…' : 'Verwijderen'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>

      {taskLinksOpen && (
        <TaskLinksPickerDialog
          open={taskLinksOpen}
          title={isEdit ? 'Koppelingen bewerken' : 'Koppelingen kiezen'}
          onOpenChange={setTaskLinksOpen}
          value={taskLinks}
          onChange={handleTaskLinksChange}
        />
      )}
    </>
  );
}
