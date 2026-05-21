// Eén aanbiedingstekst-kaart met inline editing, per-veld opslaan, kopiëren
// en statusbadge (Leeg / Concept / Klaar).

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Check, Pencil, Save, X } from 'lucide-react';

export type OfferingFieldKey =
  | 'korte_teaser' | 'whatsapp_tekst' | 'email_tekst' | 'uitgebreide_omschrijving'
  | 'highlights' | 'externe_aandachtspunten' | 'fee_tekst' | 'nda_tekst';

interface Props {
  objectId: string;
  fieldKey: OfferingFieldKey;
  label: string;
  description?: string;
  rows: number;
  value: string;
  onSaved: () => void;
  /** Drempel waarboven we de tekst als "Klaar" beschouwen. Onder de drempel maar > 0 = Concept. */
  klaarMin?: number;
}

function inferStatus(value: string, klaarMin: number): 'leeg' | 'concept' | 'klaar' {
  const v = (value ?? '').trim();
  if (!v) return 'leeg';
  if (v.length >= klaarMin) return 'klaar';
  return 'concept';
}

const STATUS_TONE: Record<string, string> = {
  leeg:    'bg-muted text-muted-foreground border-border',
  concept: 'bg-warning/10 text-warning border-warning/25',
  klaar:   'bg-success/10 text-success border-success/25',
};
const STATUS_LABEL: Record<string, string> = { leeg: 'Leeg', concept: 'Concept', klaar: 'Klaar' };

export default function OfferingTextCard({
  objectId, fieldKey, label, description, rows, value, onSaved, klaarMin = 60,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const status = inferStatus(editing ? draft : value, klaarMin);

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('object_aanbiedingsteksten')
        .upsert({ object_id: objectId, [fieldKey]: draft || null } as any, { onConflict: 'object_id' });
      if (error) throw error;
      toast.success('Opgeslagen', { duration: 1500 });
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    } finally { setBusy(false); }
  }

  async function copy() {
    const v = (value ?? '').trim();
    if (!v) { toast.info('Veld is leeg'); return; }
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Kopiëren mislukt'); }
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{label}</h4>
          {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_TONE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={rows}
          autoFocus
          className="flex-1 w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <div className="flex-1 min-h-[3rem] text-sm text-foreground/90 whitespace-pre-wrap rounded-md bg-muted/30 border border-border/60 p-3">
          {value?.trim()
            ? value
            : <span className="text-muted-foreground italic">Nog niet ingevuld.</span>}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        {editing ? (
          <>
            <button onClick={() => { setEditing(false); setDraft(value ?? ''); }} className="text-xs px-2.5 py-1 rounded hover:bg-muted text-muted-foreground inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Annuleren
            </button>
            <button onClick={save} disabled={busy} className="text-xs px-2.5 py-1 rounded bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-1">
              <Save className="h-3 w-3" /> Opslaan
            </button>
          </>
        ) : (
          <>
            <button onClick={copy} className="text-xs px-2.5 py-1 rounded border border-input hover:bg-muted text-muted-foreground inline-flex items-center gap-1">
              {copied ? <><Check className="h-3 w-3" /> Gekopieerd</> : <><Copy className="h-3 w-3" /> Kopieer</>}
            </button>
            <button onClick={() => setEditing(true)} className="text-xs px-2.5 py-1 rounded border border-input hover:bg-muted text-foreground inline-flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Bewerken
            </button>
          </>
        )}
      </div>
    </div>
  );
}
