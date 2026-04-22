// src/components/object/HuurdersPanel.tsx
// Beheer van huurders per object, met inline editing.
// - Toont totaal jaarhuur + WALT/WALB uit de view als al berekend door de DB.
// - CRUD via useDataStore.

import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatDate, formatM2, INDEXATIE_BASIS_LABELS } from '@/data/mock-data';
import type { ObjectHuurder, IndexatieBasis } from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  objectId: string;
}

const emptyHuurder = (objectId: string): Omit<ObjectHuurder, 'id'> => ({
  objectId,
  huurderNaam: '',
  branche: undefined,
  oppervlakteM2: undefined,
  jaarhuur: undefined,
  servicekostenJaar: undefined,
  ingangsdatum: undefined,
  einddatum: undefined,
  opzegmogelijkheid: undefined,
  indexatieBasis: 'CPI',
  indexatiePct: undefined,
  notities: undefined,
});

export default function HuurdersPanel({ objectId }: Props) {
  const store = useDataStore();
  const huurders = store.getHuurdersVoorObject(objectId);
  const metrics = store.getHuurMetrics(objectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ObjectHuurder | null>(null);

  const openNieuw = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (h: ObjectHuurder) => { setEditing(h); setFormOpen(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Huurder verwijderen?')) return;
    try {
      await store.deleteHuurder(id);
      toast.success('Huurder verwijderd');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary uit view */}
      {metrics && metrics.aantalHuurders > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-md">
          <Metric label="Aantal huurders" value={metrics.aantalHuurders.toString()} />
          <Metric label="Totale jaarhuur" value={formatCurrency(metrics.totaleJaarhuur)} />
          <Metric label="WALT" value={metrics.waltJaren != null ? `${metrics.waltJaren} jr` : '—'} />
          <Metric label="WALB" value={metrics.walbJaren != null ? `${metrics.walbJaren} jr` : '—'} />
        </div>
      )}

      {/* Lijst */}
      <div className="space-y-2">
        {huurders.length === 0 && (
          <p className="text-sm text-muted-foreground italic px-1">
            Nog geen huurders toegevoegd.
          </p>
        )}
        {huurders.map(h => (
          <div key={h.id} className="border border-border rounded-md p-3 flex items-start justify-between gap-3 bg-card">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-foreground">{h.huurderNaam}</p>
                {h.branche && <span className="text-xs text-muted-foreground">· {h.branche}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                {h.oppervlakteM2 != null && <span>{formatM2(h.oppervlakteM2)}</span>}
                {h.jaarhuur != null && <span className="font-mono">{formatCurrency(h.jaarhuur)}/jr</span>}
                {h.ingangsdatum && <span>Ingang: {formatDate(h.ingangsdatum)}</span>}
                {h.einddatum && <span>Einde: {formatDate(h.einddatum)}</span>}
                {h.opzegmogelijkheid && <span>Break: {formatDate(h.opzegmogelijkheid)}</span>}
                {h.indexatieBasis && (
                  <span>
                    Index: {INDEXATIE_BASIS_LABELS[h.indexatieBasis]}
                    {h.indexatieBasis === 'vast_pct' && h.indexatiePct != null && ` (${h.indexatiePct}%)`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(h)}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                aria-label="Bewerken"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(h.id)}
                className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                aria-label="Verwijderen"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={openNieuw} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-1" /> Huurder toevoegen
      </Button>

      {formOpen && (
        <HuurderInlineForm
          objectId={objectId}
          huurder={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Inline form
// ---------------------------------------------------------------------

function HuurderInlineForm({
  objectId,
  huurder,
  onClose,
}: {
  objectId: string;
  huurder: ObjectHuurder | null;
  onClose: () => void;
}) {
  const store = useDataStore();
  const isEdit = !!huurder;
  const [bezig, setBezig] = useState(false);
  const [form, setForm] = useState<Omit<ObjectHuurder, 'id'>>(
    huurder ? { ...huurder } : emptyHuurder(objectId)
  );

  const set = <K extends keyof Omit<ObjectHuurder, 'id'>>(
    k: K,
    v: Omit<ObjectHuurder, 'id'>[K]
  ) => setForm(prev => ({ ...prev, [k]: v }));

  const num = (v: string) => (v === '' ? undefined : Number(v));

  const submit = async () => {
    if (!form.huurderNaam.trim()) {
      toast.error('Naam huurder is verplicht');
      return;
    }
    setBezig(true);
    try {
      if (isEdit && huurder) {
        await store.updateHuurder(huurder.id, form);
        toast.success('Huurder bijgewerkt');
      } else {
        await store.addHuurder(form);
        toast.success('Huurder toegevoegd');
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
        <h4 className="text-sm font-semibold">{isEdit ? 'Huurder bewerken' : 'Nieuwe huurder'}</h4>
        <button type="button" onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Huurder *</Label>
          <Input value={form.huurderNaam} onChange={e => set('huurderNaam', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Branche</Label>
          <Input value={form.branche ?? ''} onChange={e => set('branche', e.target.value || undefined)} placeholder="Retail, logistiek, ..." />
        </div>
        <div className="space-y-1.5">
          <Label>Oppervlakte (m²)</Label>
          <Input type="number" value={form.oppervlakteM2 ?? ''} onChange={e => set('oppervlakteM2', num(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Jaarhuur (€)</Label>
          <Input type="number" value={form.jaarhuur ?? ''} onChange={e => set('jaarhuur', num(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Servicekosten/jr (€)</Label>
          <Input type="number" value={form.servicekostenJaar ?? ''} onChange={e => set('servicekostenJaar', num(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Ingangsdatum</Label>
          <Input type="date" value={form.ingangsdatum ?? ''} onChange={e => set('ingangsdatum', e.target.value || undefined)} />
        </div>
        <div className="space-y-1.5">
          <Label>Einddatum</Label>
          <Input type="date" value={form.einddatum ?? ''} onChange={e => set('einddatum', e.target.value || undefined)} />
        </div>
        <div className="space-y-1.5">
          <Label>Eerstvolgende break</Label>
          <Input type="date" value={form.opzegmogelijkheid ?? ''} onChange={e => set('opzegmogelijkheid', e.target.value || undefined)} />
        </div>
        <div className="space-y-1.5">
          <Label>Indexatie</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.indexatieBasis ?? 'CPI'}
            onChange={e => set('indexatieBasis', e.target.value as IndexatieBasis)}
          >
            {Object.entries(INDEXATIE_BASIS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {form.indexatieBasis === 'vast_pct' && (
          <div className="space-y-1.5">
            <Label>Indexatie %</Label>
            <Input type="number" step="0.1" value={form.indexatiePct ?? ''} onChange={e => set('indexatiePct', num(e.target.value))} />
          </div>
        )}
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
