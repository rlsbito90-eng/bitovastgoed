// src/components/relatie/ContactpersonenPanel.tsx
// Beheer van contactpersonen per relatie (vergelijkbaar met HuurdersPanel).
// Primair + decision maker vlaggen. Bij toevoegen: indien nog geen primair
// aanwezig -> nieuwe wordt automatisch primair.

import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  COMMUNICATIE_KANAAL_LABELS,
} from '@/data/mock-data';
import type {
  RelatieContactpersoon, CommunicatieKanaal,
} from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, X, Check, Star, Phone, Mail, Linkedin } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  relatieId: string;
}

const leegContact = (relatieId: string): Omit<RelatieContactpersoon, 'id'> => ({
  relatieId,
  naam: '',
  functie: undefined,
  email: undefined,
  telefoon: undefined,
  linkedinUrl: undefined,
  isPrimair: false,
  decisionMaker: false,
  voorkeurKanaal: undefined,
  voorkeurTaal: 'nl',
  notities: undefined,
});

export default function ContactpersonenPanel({ relatieId }: Props) {
  const store = useDataStore();
  const contacts = store.getContactpersonenVoorRelatie(relatieId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RelatieContactpersoon | null>(null);

  const openNieuw = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c: RelatieContactpersoon) => { setEditing(c); setFormOpen(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Contactpersoon verwijderen?')) return;
    try {
      await store.deleteContactpersoon(id);
      toast.success('Contactpersoon verwijderd');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt');
    }
  };

  const handleSetPrimair = async (id: string) => {
    try {
      // Eerst alle anderen op false, dan deze op true
      const anderen = contacts.filter(c => c.id !== id && c.isPrimair);
      for (const a of anderen) {
        await store.updateContactpersoon(a.id, { isPrimair: false });
      }
      await store.updateContactpersoon(id, { isPrimair: true });
      toast.success('Primaire contactpersoon gewijzigd');
    } catch (err: any) {
      toast.error(err.message ?? 'Wijzigen mislukt');
    }
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 && (
        <p className="text-sm text-muted-foreground italic px-1">
          Nog geen contactpersonen toegevoegd.
        </p>
      )}

      {contacts.map(c => (
        <div key={c.id} className="border border-border rounded-md p-3 flex items-start justify-between gap-3 bg-card">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-foreground">{c.naam}</p>
              {c.functie && <span className="text-xs text-muted-foreground">· {c.functie}</span>}
              {c.isPrimair && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                  <Star className="h-2.5 w-2.5 fill-current" /> Primair
                </span>
              )}
              {c.decisionMaker && (
                <span className="text-[10px] uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full">
                  Decision maker
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Mail className="h-3 w-3" /> {c.email}
                </a>
              )}
              {c.telefoon && (
                <a href={`tel:${c.telefoon}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3 w-3" /> {c.telefoon}
                </a>
              )}
              {c.linkedinUrl && (
                <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <Linkedin className="h-3 w-3" /> LinkedIn
                </a>
              )}
              {c.voorkeurKanaal && (
                <span>Voorkeur: {COMMUNICATIE_KANAAL_LABELS[c.voorkeurKanaal]}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {!c.isPrimair && (
              <button
                type="button"
                onClick={() => handleSetPrimair(c.id)}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Als primair markeren"
              >
                <Star className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(c)}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              aria-label="Bewerken"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(c.id)}
              className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
              aria-label="Verwijderen"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={openNieuw} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-1" /> Contactpersoon toevoegen
      </Button>

      {formOpen && (
        <ContactpersoonInlineForm
          relatieId={relatieId}
          contact={editing}
          heeftAlPrimair={contacts.some(c => c.isPrimair)}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}


function ContactpersoonInlineForm({
  relatieId,
  contact,
  heeftAlPrimair,
  onClose,
}: {
  relatieId: string;
  contact: RelatieContactpersoon | null;
  heeftAlPrimair: boolean;
  onClose: () => void;
}) {
  const store = useDataStore();
  const isEdit = !!contact;
  const [bezig, setBezig] = useState(false);
  const [form, setForm] = useState<Omit<RelatieContactpersoon, 'id'>>(
    contact ? { ...contact } : { ...leegContact(relatieId), isPrimair: !heeftAlPrimair }
  );

  const set = <K extends keyof Omit<RelatieContactpersoon, 'id'>>(
    k: K, v: Omit<RelatieContactpersoon, 'id'>[K],
  ) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.naam.trim()) {
      toast.error('Naam is verplicht');
      return;
    }
    setBezig(true);
    try {
      if (isEdit && contact) {
        await store.updateContactpersoon(contact.id, form);
        toast.success('Contactpersoon bijgewerkt');
      } else {
        // Bij toevoegen: als deze primair wordt, anderen op false zetten
        if (form.isPrimair) {
          const huidigPrimair = store.getContactpersonenVoorRelatie(relatieId).filter(c => c.isPrimair);
          for (const p of huidigPrimair) {
            await store.updateContactpersoon(p.id, { isPrimair: false });
          }
        }
        await store.addContactpersoon(form);
        toast.success('Contactpersoon toegevoegd');
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="border border-accent/40 bg-accent/5 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{isEdit ? 'Contactpersoon bewerken' : 'Nieuwe contactpersoon'}</h4>
        <button type="button" onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Naam *</Label>
          <Input value={form.naam} onChange={e => set('naam', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Functie</Label>
          <Input value={form.functie ?? ''} onChange={e => set('functie', e.target.value || undefined)}
            placeholder="bv. Directeur, Acquisition Manager" />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value || undefined)} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefoon</Label>
          <Input value={form.telefoon ?? ''} onChange={e => set('telefoon', e.target.value || undefined)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>LinkedIn URL</Label>
          <Input value={form.linkedinUrl ?? ''} onChange={e => set('linkedinUrl', e.target.value || undefined)}
            placeholder="https://linkedin.com/in/..." />
        </div>
        <div className="space-y-1.5">
          <Label>Voorkeur kanaal</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.voorkeurKanaal ?? ''}
            onChange={e => set('voorkeurKanaal', (e.target.value || undefined) as CommunicatieKanaal | undefined)}
          >
            <option value="">— Geen voorkeur —</option>
            {Object.entries(COMMUNICATIE_KANAAL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Voorkeurstaal</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.voorkeurTaal ?? 'nl'}
            onChange={e => set('voorkeurTaal', e.target.value || undefined)}
          >
            <option value="nl">Nederlands</option>
            <option value="en">Engels</option>
            <option value="de">Duits</option>
            <option value="fr">Frans</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.isPrimair} onCheckedChange={v => set('isPrimair', !!v)} />
          Primaire contactpersoon
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.decisionMaker} onCheckedChange={v => set('decisionMaker', !!v)} />
          Decision maker
        </label>
      </div>

      <div className="space-y-1.5">
        <Label>Notities</Label>
        <Textarea rows={2} value={form.notities ?? ''} onChange={e => set('notities', e.target.value || undefined)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
        <Button type="button" onClick={submit} disabled={bezig}>
          {bezig ? 'Bezig…' : (isEdit ? <><Check className="h-4 w-4 mr-1" />Opslaan</> : 'Toevoegen')}
        </Button>
      </div>
    </div>
  );
}
