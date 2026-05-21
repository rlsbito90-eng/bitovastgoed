// Actielijst: alleen ontbrekende cruciale items, opgevraagde, te controleren
// en open aandachtspunten. Status snel wisselbaar, taak aanmaakbaar.

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CATEGORY_LABELS, STATUS_LABELS, type DossierStatus } from '@/lib/objectDossier/catalog';
import type { EffectiveItem } from '@/lib/objectDossier/readiness';
import type { AttentionRow } from '@/hooks/useObjectDossier';
import { AlertTriangle, Clock, Search, ShieldAlert } from 'lucide-react';

interface Props {
  objectId: string;
  effective: EffectiveItem[];
  attention: AttentionRow[];
  onChanged: () => void;
  onCreateTask: (preset: { title: string }) => void;
}

const QUICK_STATUSES: DossierStatus[] = ['aanwezig', 'opgevraagd', 'te_controleren', 'ontbreekt', 'niet_beschikbaar', 'nvt'];

export default function MissingItemsPanel({ objectId, effective, attention, onChanged, onCreateTask }: Props) {
  const critMissing = effective.filter(e => e.catalog.weight === 3 && e.status !== 'aanwezig');
  const opgevraagd  = effective.filter(e => e.status === 'opgevraagd');
  const teControl   = effective.filter(e => e.status === 'te_controleren');
  const openAtt     = attention.filter(a => (a.status ?? 'open') === 'open');

  async function setStatus(item: EffectiveItem, status: DossierStatus) {
    try {
      const { error } = await supabase.from('object_dossier_items').upsert({
        object_id: objectId,
        item_key: item.catalog.key,
        category: item.catalog.category,
        label: item.catalog.label,
        weight: item.catalog.weight,
        status,
      }, { onConflict: 'object_id,item_key' });
      if (error) throw error;
      toast.success('Opgeslagen', { duration: 1500 });
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    }
  }

  const total = critMissing.length + opgevraagd.length + teControl.length + openAtt.length;

  if (total === 0) {
    return (
      <div className="border border-success/25 bg-success/5 rounded-lg p-6 text-center">
        <p className="text-sm font-medium text-success">Geen openstaande acties</p>
        <p className="text-xs text-muted-foreground mt-1">Alle cruciale punten zijn afgevinkt en er zijn geen open aandachtspunten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {critMissing.length > 0 && (
        <Group icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Cruciaal ontbreekt" tone="destructive" count={critMissing.length}>
          {critMissing.map(it => (
            <ActionRow key={it.catalog.key} item={it} onStatus={(s) => setStatus(it, s)} onTask={() => onCreateTask({ title: `${it.catalog.label} opvragen` })} />
          ))}
        </Group>
      )}

      {opgevraagd.length > 0 && (
        <Group icon={<Clock className="h-4 w-4 text-warning" />} title="Opgevraagd, wachten op antwoord" tone="warning" count={opgevraagd.length}>
          {opgevraagd.map(it => (
            <ActionRow key={it.catalog.key} item={it} onStatus={(s) => setStatus(it, s)} onTask={() => onCreateTask({ title: `${it.catalog.label} opvolgen` })} />
          ))}
        </Group>
      )}

      {teControl.length > 0 && (
        <Group icon={<Search className="h-4 w-4 text-accent" />} title="Te controleren" tone="accent" count={teControl.length}>
          {teControl.map(it => (
            <ActionRow key={it.catalog.key} item={it} onStatus={(s) => setStatus(it, s)} onTask={() => onCreateTask({ title: `${it.catalog.label} controleren` })} />
          ))}
        </Group>
      )}

      {openAtt.length > 0 && (
        <Group icon={<ShieldAlert className="h-4 w-4 text-warning" />} title="Open aandachtspunten" tone="warning" count={openAtt.length}>
          {openAtt.map(a => (
            <div key={a.id} className="border border-border rounded-md bg-card p-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{a.titel}</p>
                {a.notitie && <p className="text-xs text-muted-foreground mt-0.5 break-words">{a.notitie}</p>}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{a.ernst ?? 'middel'}</span>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ icon, title, tone, count, children }: { icon: React.ReactNode; title: string; tone: 'destructive' | 'warning' | 'accent'; count: number; children: React.ReactNode }) {
  const toneBorder: Record<string, string> = {
    destructive: 'border-destructive/20',
    warning:     'border-warning/20',
    accent:      'border-accent/20',
  };
  return (
    <section className={`border rounded-lg bg-card ${toneBorder[tone]}`}>
      <header className="px-4 py-2.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <span className="text-xs font-mono-data text-muted-foreground">{count}</span>
      </header>
      <div className="p-3 space-y-2">{children}</div>
    </section>
  );
}

function ActionRow({ item, onStatus, onTask }: { item: EffectiveItem; onStatus: (s: DossierStatus) => void; onTask: () => void }) {
  return (
    <div className="border border-border rounded-md bg-background p-3 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.catalog.label}</p>
        <p className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[item.catalog.category]}</p>
      </div>
      <select
        value={item.status ?? ''}
        onChange={(e) => onStatus(e.target.value as DossierStatus)}
        className="h-8 px-2 text-xs rounded-md border border-input bg-background"
        aria-label="Status"
      >
        <option value="" disabled>— Status —</option>
        {QUICK_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
      <button
        onClick={onTask}
        className="text-xs px-2 py-1 rounded border border-input hover:bg-muted"
      >
        Taak
      </button>
    </div>
  );
}
