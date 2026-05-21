// Aanbiedingsteksten: tekstvelden met "Kopieer" knop per veld. Opslaan handmatig.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import type { OfferingTextsRow } from '@/hooks/useObjectDossier';

type Field = {
  key: keyof Omit<OfferingTextsRow, 'id' | 'object_id' | 'created_at' | 'updated_at'>;
  label: string;
  rows: number;
  placeholder?: string;
};

const FIELDS: Field[] = [
  { key: 'korte_teaser',            label: 'Korte teaser',             rows: 3 },
  { key: 'whatsapp_tekst',          label: 'WhatsApp tekst',           rows: 4 },
  { key: 'email_tekst',             label: 'E-mailtekst',              rows: 6 },
  { key: 'uitgebreide_omschrijving',label: 'Uitgebreide omschrijving', rows: 8 },
  { key: 'highlights',              label: 'Highlights',               rows: 4 },
  { key: 'externe_aandachtspunten', label: 'Externe aandachtspunten',  rows: 4 },
  { key: 'fee_tekst',               label: 'Fee-tekst',                rows: 3 },
  { key: 'nda_tekst',               label: 'NDA / informatievoorbehoud tekst', rows: 3 },
];

interface Props {
  objectId: string;
  initial: OfferingTextsRow | null;
  onSaved: () => void;
}

type Draft = Partial<Record<Field['key'], string>>;

export default function OfferingTextsSection({ objectId, initial, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const next: Draft = {};
    for (const f of FIELDS) next[f.key] = (initial?.[f.key] as string) ?? '';
    setDraft(next);
  }, [initial]);

  async function save() {
    setBusy(true);
    try {
      const payload: any = { object_id: objectId };
      for (const f of FIELDS) payload[f.key] = draft[f.key] || null;
      const { error } = await supabase
        .from('object_aanbiedingsteksten')
        .upsert(payload, { onConflict: 'object_id' });
      if (error) throw error;
      toast.success('Aanbiedingsteksten opgeslagen');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    } finally {
      setBusy(false);
    }
  }

  async function copy(key: string, value: string) {
    if (!value) { toast.info('Veld is leeg'); return; }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
      toast.success('Gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  }

  return (
    <div className="space-y-4">
      {FIELDS.map(f => {
        const val = draft[f.key] ?? '';
        const copied = copiedKey === f.key;
        return (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">{f.label}</label>
              <button
                type="button"
                onClick={() => copy(f.key, val)}
                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-input hover:bg-muted text-muted-foreground"
              >
                {copied ? <><Check className="h-3 w-3" /> Gekopieerd</> : <><Copy className="h-3 w-3" /> Kopieer</>}
              </button>
            </div>
            <textarea
              value={val}
              onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
              rows={f.rows}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        );
      })}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-4 py-2 text-sm rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? 'Opslaan…' : 'Aanbiedingsteksten opslaan'}
        </button>
      </div>
    </div>
  );
}
