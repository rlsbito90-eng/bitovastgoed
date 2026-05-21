// Aandachtspunten / risico's per object. Inline add + edit + status wisselen.

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, EyeOff, Eye } from 'lucide-react';
import type { AttentionRow } from '@/hooks/useObjectDossier';

const TYPE_LABELS: Record<string, string> = {
  juridisch:      'Juridisch',
  technisch:      'Technisch',
  financieel:     'Financieel',
  commercieel:    'Commercieel',
  info_ontbreekt: 'Informatie ontbreekt',
  overig:         'Overig',
};
const ERNST_LABELS: Record<string, string> = { laag: 'Laag', middel: 'Middel', hoog: 'Hoog' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', opgevolgd: 'Opgevolgd', opgelost: 'Opgelost', niet_oplosbaar: 'Niet oplosbaar',
};

const ERNST_TONE: Record<string, string> = {
  laag:   'bg-muted/60 text-muted-foreground border-border',
  middel: 'bg-warning/10 text-warning border-warning/25',
  hoog:   'bg-destructive/10 text-destructive border-destructive/25',
};

interface Props {
  objectId: string;
  items: AttentionRow[];
  onChanged: () => void;
}

export default function AttentionPointsSection({ objectId, items, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ titel: '', type: 'overig', ernst: 'middel', intern_only: true, notitie: '' });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!draft.titel.trim()) { toast.error('Titel is verplicht'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('object_aandachtspunten').insert({
        object_id: objectId,
        titel: draft.titel.trim(),
        type: draft.type,
        ernst: draft.ernst,
        intern_only: draft.intern_only,
        notitie: draft.notitie || null,
      });
      if (error) throw error;
      setDraft({ titel: '', type: 'overig', ernst: 'middel', intern_only: true, notitie: '' });
      setAdding(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? 'Toevoegen mislukt');
    } finally { setBusy(false); }
  }

  async function update(id: string, patch: Partial<AttentionRow>) {
    try {
      const { error } = await supabase.from('object_aandachtspunten').update(patch).eq('id', id);
      if (error) throw error;
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? 'Wijzigen mislukt'); }
  }

  async function remove(id: string) {
    if (!confirm('Aandachtspunt verwijderen?')) return;
    try {
      const { error } = await supabase.from('object_aandachtspunten').delete().eq('id', id);
      if (error) throw error;
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? 'Verwijderen mislukt'); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Interne risico's en openstaande punten. Wat hier staat verschijnt niet automatisch in externe teksten.
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-input hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Toevoegen
          </button>
        )}
      </div>

      {adding && (
        <div className="border border-border rounded-md p-3 bg-muted/30 space-y-2">
          <input
            value={draft.titel}
            onChange={e => setDraft(d => ({ ...d, titel: e.target.value }))}
            placeholder="Titel (bv. Huurcontracten ontbreken)"
            className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} className="h-9 px-2 text-sm rounded-md border border-input bg-background">
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={draft.ernst} onChange={e => setDraft(d => ({ ...d, ernst: e.target.value }))} className="h-9 px-2 text-sm rounded-md border border-input bg-background">
              {Object.entries(ERNST_LABELS).map(([v, l]) => <option key={v} value={v}>Ernst: {l}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-foreground px-2">
              <input type="checkbox" checked={draft.intern_only} onChange={e => setDraft(d => ({ ...d, intern_only: e.target.checked }))} />
              Alleen intern
            </label>
          </div>
          <textarea
            value={draft.notitie}
            onChange={e => setDraft(d => ({ ...d, notitie: e.target.value }))}
            placeholder="Toelichting (optioneel)"
            rows={2}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded hover:bg-muted text-muted-foreground">Annuleren</button>
            <button onClick={add} disabled={busy} className="text-xs px-3 py-1.5 rounded bg-accent text-accent-foreground hover:bg-accent/90">Opslaan</button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">Geen aandachtspunten vastgelegd.</p>
      )}

      <div className="space-y-2">
        {items.map(it => (
          <div key={it.id} className="border border-border rounded-md p-3 bg-card">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{it.titel}</span>
                  {it.ernst && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ERNST_TONE[it.ernst] ?? ERNST_TONE.middel}`}>
                      {ERNST_LABELS[it.ernst] ?? it.ernst}
                    </span>
                  )}
                  {it.type && <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[it.type] ?? it.type}</span>}
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    {it.intern_only ? <><EyeOff className="h-3 w-3" /> intern</> : <><Eye className="h-3 w-3" /> deelbaar</>}
                  </span>
                </div>
                {it.notitie && <p className="text-xs text-muted-foreground mt-1 break-words">{it.notitie}</p>}
              </div>
              <select
                value={it.status ?? 'open'}
                onChange={e => update(it.id, { status: e.target.value })}
                className="h-8 px-2 text-xs rounded-md border border-input bg-background"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button
                onClick={() => update(it.id, { intern_only: !it.intern_only })}
                className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                aria-label="Wissel zichtbaarheid"
                title={it.intern_only ? 'Markeer als extern deelbaar' : 'Markeer als alleen intern'}
              >
                {it.intern_only ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => remove(it.id)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive" aria-label="Verwijderen">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
