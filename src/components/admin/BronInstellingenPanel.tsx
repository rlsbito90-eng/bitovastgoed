import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  type OffMarketBron, type BronInstellingenPatch, type BronFrequentie,
  useUpdateBronInstellingen,
} from '@/hooks/useOffMarketBronnen';

interface Props { bron: OffMarketBron }

const FREQ_OPTIES: { value: BronFrequentie; label: string }[] = [
  { value: 'handmatig', label: 'Handmatig' },
  { value: 'dagelijks', label: 'Dagelijks' },
  { value: 'wekelijks', label: 'Wekelijks' },
  { value: 'maandelijks', label: 'Maandelijks (28e)' },
];
const DAGEN = [
  { value: 1, label: 'Maandag' }, { value: 2, label: 'Dinsdag' }, { value: 3, label: 'Woensdag' },
  { value: 4, label: 'Donderdag' }, { value: 5, label: 'Vrijdag' }, { value: 6, label: 'Zaterdag' },
  { value: 7, label: 'Zondag' },
];

export default function BronInstellingenPanel({ bron }: Props) {
  const update = useUpdateBronInstellingen();
  const [vorm, setVorm] = useState<BronInstellingenPatch>({
    auto_import: bron.auto_import,
    auto_verwerken: bron.auto_verwerken,
    frequentie: bron.frequentie,
    dag_van_week: bron.dag_van_week,
    tijdstip_uur: bron.tijdstip_uur,
    max_records_per_run: bron.max_records_per_run,
    normalize_batch_size: bron.normalize_batch_size,
    lookback_days_default: bron.lookback_days_default,
    lookback_overlap_uren: bron.lookback_overlap_uren,
  });

  useEffect(() => {
    setVorm({
      auto_import: bron.auto_import,
      auto_verwerken: bron.auto_verwerken,
      frequentie: bron.frequentie,
      dag_van_week: bron.dag_van_week,
      tijdstip_uur: bron.tijdstip_uur,
      max_records_per_run: bron.max_records_per_run,
      normalize_batch_size: bron.normalize_batch_size,
      lookback_days_default: bron.lookback_days_default,
      lookback_overlap_uren: bron.lookback_overlap_uren,
    });
  }, [bron.id]);

  const setField = <K extends keyof BronInstellingenPatch>(k: K, v: BronInstellingenPatch[K]) =>
    setVorm(prev => ({ ...prev, [k]: v }));

  const opslaan = async () => {
    try {
      const patch: BronInstellingenPatch = {
        ...vorm,
        dag_van_week: vorm.frequentie === 'wekelijks' ? (vorm.dag_van_week ?? 1) : null,
      };
      await update.mutateAsync({ id: bron.id, patch });
      toast.success(`Instellingen opgeslagen voor ${bron.naam}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <ToggleRij label="Auto-import (sync)" checked={!!vorm.auto_import}
        onChange={(v) => setField('auto_import', v)} />
      <ToggleRij label="Auto-verwerken na sync" checked={!!vorm.auto_verwerken}
        onChange={(v) => setField('auto_verwerken', v)} />

      <Veld label="Frequentie">
        <Select value={vorm.frequentie ?? 'handmatig'}
          onValueChange={(v) => setField('frequentie', v as BronFrequentie)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FREQ_OPTIES.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Veld>

      {vorm.frequentie === 'wekelijks' && (
        <Veld label="Dag van de week">
          <Select value={String(vorm.dag_van_week ?? 1)}
            onValueChange={(v) => setField('dag_van_week', Number(v))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAGEN.map(d => (
                <SelectItem key={d.value} value={String(d.value)} className="text-xs">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Veld>
      )}

      <Veld label="Tijdstip (uur)">
        <Input type="number" min={0} max={23} className="h-8 text-xs"
          value={vorm.tijdstip_uur ?? 6}
          onChange={(e) => setField('tijdstip_uur', e.target.value === '' ? 6 : Math.max(0, Math.min(23, Number(e.target.value))))} />
      </Veld>

      <Veld label="Max records per run">
        <Input type="number" min={1} max={5000} className="h-8 text-xs"
          value={vorm.max_records_per_run ?? 500}
          onChange={(e) => setField('max_records_per_run', e.target.value === '' ? 500 : Math.max(1, Math.min(5000, Number(e.target.value))))} />
      </Veld>

      <Veld label="Normalize batchgrootte">
        <Input type="number" min={1} max={2000} className="h-8 text-xs"
          value={vorm.normalize_batch_size ?? 200}
          onChange={(e) => setField('normalize_batch_size', e.target.value === '' ? 200 : Math.max(1, Math.min(2000, Number(e.target.value))))} />
      </Veld>

      <Veld label="Lookback (dagen) — eerste sync">
        <Input type="number" min={1} max={365} className="h-8 text-xs"
          value={vorm.lookback_days_default ?? 7}
          onChange={(e) => setField('lookback_days_default', e.target.value === '' ? 7 : Math.max(1, Math.min(365, Number(e.target.value))))} />
      </Veld>

      <Veld label="Overlap (uren) — vervolgsync">
        <Input type="number" min={0} max={168} className="h-8 text-xs"
          value={vorm.lookback_overlap_uren ?? 24}
          onChange={(e) => setField('lookback_overlap_uren', e.target.value === '' ? 24 : Math.max(0, Math.min(168, Number(e.target.value))))} />
      </Veld>

      <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
        <Button size="sm" variant="outline" onClick={opslaan} disabled={update.isPending}>
          {update.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Save className="h-4 w-4 mr-1" />}
          Instellingen opslaan
        </Button>
      </div>
    </div>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRij({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
      <span className="text-xs text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
