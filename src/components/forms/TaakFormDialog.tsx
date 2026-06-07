import { useState, useEffect, useMemo } from 'react';
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
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { TAAK_TYPES, TAAK_STATUSES } from '@/lib/taakHelpers';
import EntityPicker, { type EntityPickerItem } from './EntityPicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

const emptyForm = {
  titel: '',
  relatieId: '',
  dealId: '',
  objectId: '',
  offMarketSignaalId: '',
  type: 'Algemeen',
  deadline: new Date().toISOString().split('T')[0],
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

export default function TaakFormDialog({ open, onOpenChange, taak, defaultRelatieId, defaultDealId, defaultObjectId, defaultOffMarketSignaalId }: Props) {
  const { addTaak, updateTaak, deleteTaak, relaties, deals, objecten, getObjectById, getRelatieById, contactpersonen } = useDataStore();
  const [form, setForm] = useState(emptyForm);
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
        deadline: taak.deadline,
        deadlineTijd: taak.deadlineTijd ? taak.deadlineTijd.slice(0, 5) : '',
        prioriteit: taak.prioriteit,
        status: taak.status,
        notities: taak.notities || '',
      });
    } else {
      setForm({
        ...emptyForm,
        relatieId: defaultRelatieId || '',
        dealId: defaultDealId || '',
        objectId: defaultObjectId || '',
        offMarketSignaalId: defaultOffMarketSignaalId || '',
      });
    }
  }, [taak, open, defaultRelatieId, defaultDealId, defaultObjectId, defaultOffMarketSignaalId]);

  // ---- Picker items ----
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

  // ---- Relevantie-logica tussen velden ----
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

  // ---- Handlers ----
  const handleDealChange = (id: string) => {
    setForm(prev => {
      const next = { ...prev, dealId: id };
      if (id) {
        const d = deals.find(x => x.id === id);
        if (d) {
          // auto-vul relatie/object indien leeg
          if (!prev.relatieId) next.relatieId = d.relatieId;
          if (!prev.objectId) next.objectId = d.objectId;
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    if (!form.titel.trim()) {
      toast.error('Titel is verplicht');
      return;
    }
    setBezig(true);

    const data: Omit<Taak, 'id'> = {
      titel: form.titel.trim(),
      relatieId: form.relatieId || undefined,
      dealId: form.dealId || undefined,
      objectId: form.objectId || undefined,
      offMarketSignaalId: form.offMarketSignaalId || undefined,
      type: form.type,
      deadline: form.deadline || '',
      deadlineTijd: form.deadlineTijd || undefined,
      prioriteit: form.prioriteit,
      status: form.status,
      notities: form.notities || undefined,
    };

    try {
      if (isEdit && taak) {
        await updateTaak(taak.id, data);
        toast.success('Taak bijgewerkt');
      } else {
        await addTaak(data);
        toast.success('Taak aangemaakt');
      }
      pushRecent('relatie', form.relatieId);
      pushRecent('object', form.objectId);
      pushRecent('deal', form.dealId);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
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

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Taak bewerken' : 'Nieuwe taak'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ---------- BLOK 1: BASIS ---------- */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basis</h3>
            <div className="space-y-1.5">
              <Label>Titel *</Label>
              <Input value={form.titel} onChange={e => set('titel', e.target.value)} placeholder="Wat moet er gedaan worden?" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
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
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                  {TAAK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ---------- BLOK 2: PLANNING ---------- */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planning</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tijd (optioneel)</Label>
                <Input type="time" value={form.deadlineTijd} onChange={e => set('deadlineTijd', e.target.value)} />
              </div>
            </div>
          </section>

          {/* ---------- BLOK 3: KOPPELINGEN ---------- */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Koppelingen</h3>
            <div className="space-y-3">
              <EntityPicker
                label="Relatie"
                pickerTitle="Kies relatie"
                searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
                emptyLabel="Geen gekoppelde relatie"
                value={form.relatieId}
                onChange={(id) => set('relatieId', id)}
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
                value={form.objectId}
                onChange={(id) => set('objectId', id)}
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
                value={form.dealId}
                onChange={handleDealChange}
                items={dealItemsActief}
                archivedItems={dealItemsArchief}
                relevantIds={relevantDealIds}
                relevantLabel="Relevant voor selectie"
                recentIds={readRecent('deal')}
              />
            </div>
          </section>

          {/* ---------- BLOK 4: NOTITIES ---------- */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notities</h3>
            <Textarea value={form.notities} onChange={e => set('notities', e.target.value)} rows={3} placeholder="Optionele context, opvolging, aanvullende info…" />
          </section>

          {/* ---------- ACTIES ---------- */}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
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
              <Button type="submit" disabled={bezig}>{bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}</Button>
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
  );
}
