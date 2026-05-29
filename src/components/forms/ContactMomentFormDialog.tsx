// src/components/forms/ContactMomentFormDialog.tsx
import { useState, useEffect, useMemo } from 'react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDataStore } from '@/hooks/useDataStore';
import { toast } from 'sonner';
import {
  CONTACT_MOMENT_TYPE_LABELS, CONTACT_MOMENT_DIRECTION_LABELS,
  type ContactMoment, type ContactMomentType, type ContactMomentDirection,
} from '@/lib/contactMoments';
import EntityPicker, { type EntityPickerItem } from './EntityPicker';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { TAAK_TYPES } from '@/lib/taakHelpers';
import type { TaakPrioriteit } from '@/data/mock-data';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactMoment?: ContactMoment | null;
  defaultType?: ContactMomentType;
  defaultRelatieId?: string;
  defaultObjectId?: string;
  defaultDealId?: string;
  defaultAcquisitieTargetId?: string;
}

const TYPE_OPTIONS: ContactMomentType[] = [
  'telefoon', 'email', 'whatsapp', 'linkedin',
  'afspraak', 'bezichtiging', 'notitie',
  'document_gedeeld', 'teaser_verstuurd', 'nda_verstuurd', 'nda_ontvangen', 'informatie_gedeeld',
  'bod_ontvangen', 'bod_uitgebracht', 'algemeen',
];

const norm = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const RECENT_KEY = 'cm-picker-recent';
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

const emptyForm = {
  type: 'telefoon' as ContactMomentType,
  momentDate: new Date().toISOString().split('T')[0],
  momentTime: '',
  title: '',
  description: '',
  outcome: '',
  direction: 'uitgaand' as ContactMomentDirection,
  relatieId: '',
  objectId: '',
  dealId: '',
  acquisitieTargetId: '',
  followUpRequired: false,
  followUpDate: '',
  // taak
  makeTaak: false,
  taakTitel: '',
  taakDeadline: '',
  taakTijd: '',
  taakType: 'Telefoongesprek',
  taakPrioriteit: 'normaal' as TaakPrioriteit,
};

export default function ContactMomentFormDialog({
  open, onOpenChange, contactMoment,
  defaultType, defaultRelatieId, defaultObjectId, defaultDealId, defaultAcquisitieTargetId,
}: Props) {
  const store = useDataStore();
  const isEdit = !!contactMoment;
  const [form, setForm] = useState(emptyForm);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (contactMoment) {
      setForm({
        type: contactMoment.type,
        momentDate: contactMoment.momentDate,
        momentTime: contactMoment.momentTime ? contactMoment.momentTime.slice(0, 5) : '',
        title: contactMoment.title,
        description: contactMoment.description || '',
        outcome: contactMoment.outcome || '',
        direction: contactMoment.direction,
        relatieId: contactMoment.relatieId || '',
        objectId: contactMoment.objectId || '',
        dealId: contactMoment.dealId || '',
        acquisitieTargetId: contactMoment.acquisitieTargetId || '',
        followUpRequired: contactMoment.followUpRequired,
        followUpDate: contactMoment.followUpDate || '',
        makeTaak: false,
        taakTitel: '',
        taakDeadline: '',
        taakTijd: '',
        taakType: 'Telefoongesprek',
        taakPrioriteit: 'normaal',
      });
    } else {
      setForm({
        ...emptyForm,
        type: defaultType ?? emptyForm.type,
        direction: (defaultType === 'notitie' || defaultType === 'algemeen') ? 'intern' : 'uitgaand',
        relatieId: defaultRelatieId || '',
        objectId: defaultObjectId || '',
        dealId: defaultDealId || '',
        acquisitieTargetId: defaultAcquisitieTargetId || '',
      });
    }
  }, [contactMoment, open, defaultType, defaultRelatieId, defaultObjectId, defaultDealId, defaultAcquisitieTargetId]);

  // ---- Picker items ----
  const relatieItems = useMemo<EntityPickerItem[]>(() => store.relaties.map(r => {
    const { primair, secundair } = getRelatieNamen(r, store.contactpersonen);
    const cps = store.contactpersonen.filter(c => c.relatieId === r.id);
    const haystack = norm([
      primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email, r.telefoon,
      ...cps.flatMap(c => [c.naam, c.email, c.telefoon, c.functie]),
    ].filter(Boolean).join(' '));
    return { id: r.id, primair, secundair, searchHaystack: haystack };
  }), [store.relaties, store.contactpersonen]);

  const { objectItemsActief, objectItemsArchief } = useMemo(() => {
    const map = (o: typeof store.objecten[number]): EntityPickerItem => ({
      id: o.id,
      primair: o.titel || o.adres || '(naamloos object)',
      secundair: [o.plaats, o.status].filter(Boolean).join(' · ') || null,
      searchHaystack: norm([o.titel, o.adres, o.plaats, o.provincie, o.internReferentienummer, o.status].filter(Boolean).join(' ')),
    });
    return {
      objectItemsActief: store.objecten.filter(o => !o.isArchived).map(map),
      objectItemsArchief: store.objecten.filter(o => o.isArchived).map(map),
    };
  }, [store.objecten]);

  const { dealItemsActief, dealItemsArchief } = useMemo(() => {
    const map = (d: typeof store.deals[number]): EntityPickerItem => {
      const obj = store.getObjectById(d.objectId);
      const rel = store.getRelatieById(d.relatieId);
      const { primair: relNaam } = getRelatieNamen(rel, store.contactpersonen);
      return {
        id: d.id,
        primair: obj?.titel || obj?.adres || 'Deal',
        secundair: [relNaam, d.fase].filter(Boolean).join(' · ') || null,
        searchHaystack: norm([obj?.titel, obj?.adres, obj?.plaats, relNaam, d.fase].filter(Boolean).join(' ')),
      };
    };
    return {
      dealItemsActief: store.deals.filter(d => !d.isArchived).map(map),
      dealItemsArchief: store.deals.filter(d => d.isArchived).map(map),
    };
  }, [store.deals, store.getObjectById, store.getRelatieById, store.contactpersonen]);

  const relevantDealIds = useMemo(() => {
    const ids = new Set<string>();
    store.deals.forEach(d => {
      if ((form.relatieId && d.relatieId === form.relatieId) ||
          (form.objectId && d.objectId === form.objectId)) ids.add(d.id);
    });
    return Array.from(ids);
  }, [store.deals, form.relatieId, form.objectId]);

  const relevantObjectIds = useMemo(() => {
    const ids = new Set<string>();
    if (form.dealId) { const d = store.deals.find(x => x.id === form.dealId); if (d) ids.add(d.objectId); }
    if (form.relatieId) store.deals.forEach(d => { if (d.relatieId === form.relatieId) ids.add(d.objectId); });
    return Array.from(ids);
  }, [store.deals, form.dealId, form.relatieId]);

  const relevantRelatieIds = useMemo(() => {
    const ids = new Set<string>();
    if (form.dealId) { const d = store.deals.find(x => x.id === form.dealId); if (d) ids.add(d.relatieId); }
    if (form.objectId) store.deals.forEach(d => { if (d.objectId === form.objectId) ids.add(d.relatieId); });
    return Array.from(ids);
  }, [store.deals, form.dealId, form.objectId]);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleDealChange = (id: string) => {
    setForm(prev => {
      const next = { ...prev, dealId: id };
      if (id) {
        const d = store.deals.find(x => x.id === id);
        if (d) {
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
    setBezig(true);
    try {
      // Auto-titel als gebruiker niets invult
      let titel = form.title.trim();
      if (!titel) {
        const typeLabel = CONTACT_MOMENT_TYPE_LABELS[form.type];
        const rel = form.relatieId ? store.getRelatieById(form.relatieId) : null;
        const relNaam = rel ? getRelatieNamen(rel, store.contactpersonen).primair : '';
        titel = relNaam ? `${typeLabel} – ${relNaam}` : typeLabel;
      }

      const payload: Partial<ContactMoment> = {
        type: form.type,
        momentDate: form.momentDate,
        momentTime: form.momentTime || undefined,
        title: titel,
        description: form.description.trim() || undefined,
        outcome: form.outcome.trim() || undefined,
        direction: form.direction,
        relatieId: form.relatieId || undefined,
        objectId: form.objectId || undefined,
        dealId: form.dealId || undefined,
        acquisitieTargetId: form.acquisitieTargetId || undefined,
        followUpRequired: isEdit ? form.followUpRequired : form.makeTaak,
        followUpDate: isEdit ? (form.followUpDate || undefined) : (form.makeTaak ? (form.taakDeadline || undefined) : undefined),
      };

      if (isEdit && contactMoment) {
        await store.updateContactMoment(contactMoment.id, payload);
        toast.success('Tijdlijnitem bijgewerkt');
      } else {
        await store.addContactMoment(payload as Omit<ContactMoment, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>);
        toast.success('Contactmoment gelogd');
      }

      // Optioneel: vervolgtaak aanmaken
      if (!isEdit && form.makeTaak) {
        try {
          const rel = form.relatieId ? store.getRelatieById(form.relatieId) : null;
          const relNaam = rel ? getRelatieNamen(rel, store.contactpersonen).primair : '';
          const fallbackTaakTitel = relNaam ? `Opvolgen: ${relNaam}` : (titel || 'Vervolgtaak');
          await store.addTaak({
            titel: form.taakTitel.trim() || fallbackTaakTitel,
            type: form.taakType,
            deadline: form.taakDeadline || form.momentDate,
            deadlineTijd: form.taakTijd || undefined,
            prioriteit: form.taakPrioriteit,
            status: 'open',
            relatieId: form.relatieId || undefined,
            objectId: form.objectId || undefined,
            dealId: form.dealId || undefined,
          });
          toast.success('Vervolgtaak aangemaakt');
        } catch (err: any) {
          toast.error(`Taak aanmaken mislukt: ${err.message ?? 'onbekend'}`);
        }
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

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Tijdlijnitem bewerken' : 'Contactmoment loggen'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* BASIS */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basis</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type}
                  onChange={e => set('type', e.target.value as ContactMomentType)}
                >
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{CONTACT_MOMENT_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Richting</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.direction}
                  onChange={e => set('direction', e.target.value as ContactMomentDirection)}
                >
                  <option value="uitgaand">{CONTACT_MOMENT_DIRECTION_LABELS.uitgaand}</option>
                  <option value="inkomend">{CONTACT_MOMENT_DIRECTION_LABELS.inkomend}</option>
                  <option value="intern">{CONTACT_MOMENT_DIRECTION_LABELS.intern}</option>
                  <option value="n_v_t">Niet van toepassing</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Titel (optioneel)</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Korte omschrijving — laat leeg voor automatisch" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Datum</Label>
                <Input type="date" value={form.momentDate} onChange={e => set('momentDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tijd (optioneel)</Label>
                <Input type="time" value={form.momentTime} onChange={e => set('momentTime', e.target.value)} />
              </div>
            </div>
          </section>

          {/* DETAILS */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
            <div className="space-y-1.5">
              <Label>Notitie</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Wat is er besproken, gemaild of afgesproken?" />
            </div>
            <div className="space-y-1.5">
              <Label>Uitkomst (optioneel)</Label>
              <Input value={form.outcome} onChange={e => set('outcome', e.target.value)} placeholder="Bijv. wil documenten ontvangen, terugbellen, …" />
            </div>
          </section>

          {/* KOPPELINGEN */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Koppelingen</h3>
            <EntityPicker
              label="Relatie" pickerTitle="Kies relatie"
              searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
              emptyLabel="Geen gekoppelde relatie"
              value={form.relatieId} onChange={(id) => set('relatieId', id)}
              items={relatieItems} relevantIds={relevantRelatieIds}
              recentIds={readRecent('relatie')}
            />
            <EntityPicker
              label="Object" pickerTitle="Kies object"
              searchPlaceholder="Zoek op adres, plaats, type…"
              emptyLabel="Geen gekoppeld object"
              value={form.objectId} onChange={(id) => set('objectId', id)}
              items={objectItemsActief} archivedItems={objectItemsArchief}
              relevantIds={relevantObjectIds} recentIds={readRecent('object')}
            />
            <EntityPicker
              label="Deal" pickerTitle="Kies deal"
              searchPlaceholder="Zoek op object, relatie, fase…"
              emptyLabel="Geen gekoppelde deal"
              value={form.dealId} onChange={handleDealChange}
              items={dealItemsActief} archivedItems={dealItemsArchief}
              relevantIds={relevantDealIds} recentIds={readRecent('deal')}
            />
          </section>

          {/* VERVOLGTAAK */}
          {!isEdit && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vervolg</h3>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.makeTaak} onCheckedChange={(v) => set('makeTaak', !!v)} />
                Vervolgtaak aanmaken
              </label>
              {form.makeTaak && (
                <div className="space-y-3 pl-6 border-l-2 border-border">
                  <div className="space-y-1.5">
                    <Label>Taaktitel (optioneel)</Label>
                    <Input value={form.taakTitel} onChange={e => set('taakTitel', e.target.value)} placeholder="Bijv. Opvolgen: [relatie]" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Deadline (optioneel)</Label>
                      <Input type="date" value={form.taakDeadline} onChange={e => set('taakDeadline', e.target.value)} />
                      {!form.taakDeadline && (
                        <p className="text-[11px] text-muted-foreground">Zonder deadline staat de taak op vandaag.</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tijd (optioneel)</Label>
                      <Input type="time" value={form.taakTijd} onChange={e => set('taakTijd', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.taakType} onChange={e => set('taakType', e.target.value)}>
                        {TAAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Prioriteit</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.taakPrioriteit} onChange={e => set('taakPrioriteit', e.target.value as TaakPrioriteit)}>
                        <option value="laag">Laag</option>
                        <option value="normaal">Normaal</option>
                        <option value="hoog">Hoog</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Loggen')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
