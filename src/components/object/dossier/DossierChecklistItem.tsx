// Eén checklist-item: status-select, notitie, datum opgevraagd, bron, acties.
// Wijzigingen worden direct opgeslagen (upsert per item_key).

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  STATUS_LABELS, STATUS_TONE, type DossierStatus, type CatalogItem,
} from '@/lib/objectDossier/catalog';
import { Pencil, Check, X, Sparkles } from 'lucide-react';

const TONE: Record<string, string> = {
  emerald: 'text-success border-success/30 bg-success/5',
  amber:   'text-warning border-warning/30 bg-warning/5',
  gold:    'text-accent border-accent/30 bg-accent/5',
  sand:    'text-foreground border-secondary/30 bg-secondary/10',
  crimson: 'text-destructive border-destructive/30 bg-destructive/5',
  neutral: 'text-muted-foreground border-border bg-muted/40',
};

interface Props {
  objectId: string;
  catalog: CatalogItem;
  status: DossierStatus | null;
  fromAuto: boolean;
  notitie?: string | null;
  bron?: string | null;
  opgevraagdOp?: string | null;
  onChanged: () => void;
  onCreateTask?: (preset: { title: string }) => void;
}

export default function DossierChecklistItem({
  objectId, catalog, status, fromAuto, notitie, bron, opgevraagdOp,
  onChanged, onCreateTask,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState(notitie ?? '');
  const [draftBron, setDraftBron] = useState(bron ?? '');
  const [draftDatum, setDraftDatum] = useState(opgevraagdOp ?? '');
  const [busy, setBusy] = useState(false);

  const tone = status ? STATUS_TONE[status] : 'neutral';

  async function persist(patch: Partial<{
    status: DossierStatus | null; notitie: string | null;
    bron: string | null; opgevraagd_op: string | null;
  }>) {
    setBusy(true);
    try {
      const payload = {
        object_id: objectId,
        item_key: catalog.key,
        category: catalog.category,
        label: catalog.label,
        weight: catalog.weight,
        status: patch.status ?? status ?? null,
        notitie: patch.notitie ?? notitie ?? null,
        bron: patch.bron ?? bron ?? null,
        opgevraagd_op: patch.opgevraagd_op ?? opgevraagdOp ?? null,
      };
      const { error } = await supabase
        .from('object_dossier_items')
        .upsert(payload, { onConflict: 'object_id,item_key' });
      if (error) throw error;
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    await persist({
      notitie: draftNote || null,
      bron: draftBron || null,
      opgevraagd_op: draftDatum || null,
    });
    setEditing(false);
  }

  return (
    <div className={`border rounded-md p-3 ${TONE[tone]} transition-colors`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{catalog.label}</span>
            {catalog.weight === 3 && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cruciaal</span>
            )}
            {fromAuto && status === 'aanwezig' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Sparkles className="h-3 w-3" /> auto
              </span>
            )}
          </div>
          {(notitie || bron || opgevraagdOp) && !editing && (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {notitie && <p className="break-words">{notitie}</p>}
              <div className="flex gap-3 flex-wrap">
                {bron && <span>Bron: {bron}</span>}
                {opgevraagdOp && <span>Opgevraagd: {opgevraagdOp}</span>}
              </div>
            </div>
          )}
        </div>

        <select
          value={status ?? ''}
          disabled={busy}
          onChange={e => persist({ status: (e.target.value || null) as DossierStatus | null })}
          className="shrink-0 h-8 px-2 text-xs rounded-md border border-input bg-background"
          aria-label={`Status voor ${catalog.label}`}
        >
          <option value="">— Status —</option>
          {(Object.keys(STATUS_LABELS) as DossierStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className="shrink-0 p-1.5 hover:bg-muted rounded text-muted-foreground"
          aria-label="Bewerken"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {status === 'opgevraagd' && onCreateTask && (
          <button
            type="button"
            onClick={() => onCreateTask({ title: `${catalog.label} opvolgen` })}
            className="shrink-0 text-[11px] px-2 py-1 rounded border border-input hover:bg-muted text-foreground"
          >
            Taak aanmaken
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            value={draftBron}
            onChange={e => setDraftBron(e.target.value)}
            placeholder="Bron"
            className="h-8 px-2 text-xs rounded-md border border-input bg-background sm:col-span-1"
          />
          <input
            type="date"
            value={draftDatum}
            onChange={e => setDraftDatum(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background sm:col-span-1"
          />
          <textarea
            value={draftNote}
            onChange={e => setDraftNote(e.target.value)}
            placeholder="Notitie"
            rows={2}
            className="px-2 py-1.5 text-xs rounded-md border border-input bg-background sm:col-span-3"
          />
          <div className="sm:col-span-3 flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Annuleren
            </button>
            <button onClick={saveDraft} disabled={busy} className="text-xs px-2 py-1 rounded bg-accent text-accent-foreground hover:bg-accent/90 inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Opslaan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
