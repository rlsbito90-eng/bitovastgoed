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
  const [workPlan,setWorkPlan] = useState<ManualTaskPlanning>({planDatum:null,planTijd:null,planningBucket:'open'});
  const [workPlanLoaded,setWorkPlanLoaded] = useState(true);
  const [workPlanError,setWorkPlanError] = useState<string|null>(null);
  const [workPlanDirty,setWorkPlanDirty] = useState(false);
  const pendingCreatedTaskId = useRef<string|null>(null);
  const [taskLinks, setTaskLinks] = useState<TaskLinkSelection>(EMPTY_TASK_LINK_SELECTION);
  const [taskLinksOpen, setTaskLinksOpen] = useState(false);
  const [linksDirty, setLinksDirty] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  const isEdit = !!taak;

  useEffect(() => {
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
    if (!open || !taak?.id) return;

    let cancelled = false;
    void listTaskLinks(taak.id)
      .then(rows => {
        if (!cancelled) setTaskLinks(mergeTaskLinks(base, rows));
      })
      .catch(error => console.error('Taakkoppelingen laden mislukt', error));
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
    setWorkPlan({planDatum:null,planTijd:null,planningBucket:'open'});
    setWorkPlanDirty(false);
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
    if (!isEdit) {
      setForm(prev => ({
        ...prev,
        relatieId: next.relatie[0] || '',
        objectId: next.object[0] || '',
        dealId: next.deal[0] || '',
        offMarketSignaalId: next.signaal[0] || '',
      }));
    }
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
    if (!workPlanLoaded) {
      toast.error('De werkplanning wordt nog geladen of is niet beschikbaar.');
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

  return (
    <>
      <Dialog open={open} onOpenChange={guardedOnOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Taak bewerken' : 'Nieuwe taak'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taakgegevens</h3>
              <div className="space-y-1.5">
                <Label>Titel *</Label>
                <Input value={form.titel} onChange={e => set('titel', e.target.value)} placeholder="Wat moet er gedaan worden?" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                    {TAAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioriteit</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.prioriteit} onChange={e => set('prioriteit', e.target.value)}>
                    <option value="laag">Laag</option>
                    <option value="normaal">Normaal</option>
                    <option value="hoog">Hoog</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <Label>Status</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                    {TAAK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <TaakWerkplanningVelden value={workPlan} onChange={handleWorkPlanChange}
                disabled={!workPlanLoaded||bezig}/>
              {!workPlanLoaded&&<p role="status" className="text-xs text-muted-foreground">
                {workPlanError || 'Bestaande werkplanning laden…'}
              </p>}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Koppelingen</h3>
              {isEdit ? (
                <button type="button" onClick={() => setTaskLinksOpen(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-accent hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Link2 className="h-4 w-4" />
                  Koppelingen beheren
                  <span className="text-xs text-muted-foreground">· {taskLinkCount} gekoppeld</span>
                </button>
              ) : (
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
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uiterste datum</h3>
                <p className="mt-1 text-xs text-muted-foreground">Optioneel. Alleen als de taak een harde deadline heeft.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
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
                <Label>Melding</Label>
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
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notities</h3>
              <Textarea value={form.notities} onChange={e => set('notities', e.target.value)} rows={3} placeholder="Optionele context, opvolging, aanvullende info…" />
            </section>

            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-border">
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
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
                <Button type="submit" disabled={bezig||!workPlanLoaded}>{bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}</Button>
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
