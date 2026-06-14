import { useMemo, useState } from 'react';
import { Loader2, History, RotateCcw, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  type OffMarketBron, type BackfillStatus,
  useBackfillRun, useBackfillReset,
} from '@/hooks/useOffMarketBronnen';

interface Props { bron: OffMarketBron }

type Preset = '30' | '90' | '180' | '365' | 'custom';

const PRESETS: { value: Preset; label: string; dagen?: number }[] = [
  { value: '30', label: 'Laatste 30 dagen', dagen: 30 },
  { value: '90', label: 'Laatste 90 dagen', dagen: 90 },
  { value: '180', label: 'Laatste 6 maanden', dagen: 180 },
  { value: '365', label: 'Laatste 12 maanden', dagen: 365 },
  { value: 'custom', label: 'Aangepaste periode' },
];

const BATCH_OPTIES: (500 | 1000 | 2000)[] = [500, 1000, 2000];

function isoDatum(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function statusBadge(s: BackfillStatus) {
  const map: Record<BackfillStatus, { label: string; cls: string }> = {
    niet_gestart: { label: 'Niet gestart', cls: 'text-muted-foreground' },
    bezig: { label: 'Bezig', cls: 'bg-warning/10 text-warning border-warning/20' },
    gepauzeerd: { label: 'Gepauzeerd', cls: 'text-muted-foreground' },
    voltooid: { label: 'Voltooid', cls: 'bg-success/10 text-success border-success/20' },
    fout: { label: 'Fout', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  };
  const v = map[s];
  return <Badge variant="outline" className={`text-xs ${v.cls}`}>{v.label}</Badge>;
}

export default function BronBackfillPanel({ bron }: Props) {
  const backfill = useBackfillRun();
  const reset = useBackfillReset();

  // Default preset op basis van huidige waarden, anders 90 dagen.
  const initial: Preset = bron.backfill_vanaf && bron.backfill_tot ? 'custom' : '90';
  const [preset, setPreset] = useState<Preset>(initial);
  const [vanaf, setVanaf] = useState<string>(
    bron.backfill_vanaf ?? isoDatum(new Date(Date.now() - 90 * 86400_000)),
  );
  const [tot, setTot] = useState<string>(bron.backfill_tot ?? isoDatum(new Date()));
  const [batchSize, setBatchSize] = useState<500 | 1000 | 2000>(1000);

  const computed = useMemo(() => {
    const pr = PRESETS.find(p => p.value === preset);
    if (pr?.dagen) {
      const tot2 = isoDatum(new Date());
      const vanaf2 = isoDatum(new Date(Date.now() - pr.dagen * 86400_000));
      return { vanaf: vanaf2, tot: tot2 };
    }
    return { vanaf, tot };
  }, [preset, vanaf, tot]);

  const totaal = bron.backfill_server_total ?? 0;
  const cursor = bron.backfill_cursor ?? 0;
  const procent = totaal > 0 ? Math.min(100, Math.round((cursor / totaal) * 100)) : 0;

  const handleBackfill = async () => {
    if (backfill.isPending) return;
    try {
      const r = await backfill.mutateAsync({
        bronId: bron.id,
        vanaf: computed.vanaf,
        tot: computed.tot,
        batchSize,
      });
      const dur = (r.duur_ms / 1000).toFixed(1);
      toast.success(
        `Backfill batch: ${r.opgehaald} opgehaald · ${r.nieuw} nieuw · ${r.dubbel} dubbel · ` +
        `cursor ${r.cursor_start} → ${r.cursor_eind ?? '—'} / ${r.totaal_server} · ${dur}s`,
      );
      if (r.nieuw > 0) {
        toast.message(`Er zijn ${r.nieuw} nieuwe ruwe records toegevoegd. Verwerk de wachtrij om signalen te maken.`);
      }
    } catch (e) {
      toast.error(`Backfill: ${e instanceof Error ? e.message : 'fout'}`);
    }
  };

  const handleReset = async () => {
    if (reset.isPending) return;
    try {
      await reset.mutateAsync({ bronId: bron.id });
      toast.success(`Backfill voor ${bron.naam} gereset`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset mislukt');
    }
  };

  const bezigOrLater = backfill.isPending || reset.isPending;

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Backfill</span>
        {statusBadge(bron.backfill_status)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Veld label="Periode">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Veld>

        {preset === 'custom' && (
          <>
            <Veld label="Vanaf">
              <Input type="date" className="h-8 text-xs" value={vanaf}
                onChange={(e) => setVanaf(e.target.value)} />
            </Veld>
            <Veld label="Tot en met">
              <Input type="date" className="h-8 text-xs" value={tot}
                onChange={(e) => setTot(e.target.value)} />
            </Veld>
          </>
        )}

        <Veld label="Batchgrootte">
          <Select value={String(batchSize)}
            onValueChange={(v) => setBatchSize(Number(v) as 500 | 1000 | 2000)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BATCH_OPTIES.map(n => (
                <SelectItem key={n} value={String(n)} className="text-xs">{n} records</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Veld>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground font-mono-data">
          <span>
            {bron.backfill_vanaf ?? computed.vanaf} t/m {bron.backfill_tot ?? computed.tot}
            {' · '}{cursor} / {totaal || '—'} opgehaald
          </span>
          <span>{totaal > 0 ? `${procent}%` : '—'}</span>
        </div>
        <Progress value={procent} className="h-1.5" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={handleReset}
          disabled={bezigOrLater || (cursor === 0 && bron.backfill_status === 'niet_gestart')}>
          {reset.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <RotateCcw className="h-4 w-4 mr-1" />}
          Backfill resetten
        </Button>
        <Button size="sm" variant="default" onClick={handleBackfill}
          disabled={bezigOrLater || !bron.actief || bron.backfill_status === 'voltooid'}>
          {backfill.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <PlayCircle className="h-4 w-4 mr-1" />}
          Backfill volgende batch
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
