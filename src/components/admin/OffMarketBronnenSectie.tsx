import { useState } from 'react';
import { Loader2, Play, Radio, ListFilter, AlertTriangle, Settings2, RefreshCw, ChevronDown, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useOffMarketBronnen, useOnverwerkteRuwCount, useRunBron, useToggleBron, useNormalizeWachtrij,
  useNormalizeWachtrijVolledig,
  useOffMarketBronStats,
  type OffMarketBron, type OffMarketBronStats,
} from '@/hooks/useOffMarketBronnen';
import BronInstellingenPanel from './BronInstellingenPanel';
import BronBackfillPanel from './BronBackfillPanel';

const BATCH_OPTIES = [100, 250, 500, 1000] as const;
const DEFAULT_BATCH = 250;

function StatusBadge({ bron }: { bron: OffMarketBron }) {
  if (bron.laatste_fout) {
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">mislukt</Badge>;
  }
  if (!bron.laatste_run_op) {
    return <Badge variant="outline" className="text-muted-foreground">nooit gedraaid</Badge>;
  }
  return <Badge variant="outline" className="bg-success/10 text-success border-success/20">succes</Badge>;
}

interface LaatsteRun {
  opgehaald?: number;
  nieuw?: number;
  dubbel?: number;
  totaal_server?: number;
  max_records?: number;
  afgebroken?: boolean;
  duur_ms?: number;
  test_mode?: boolean;
  modus?: string;
  query_vanaf?: string;
  query_tot?: string;
}

function parseLaatsteRun(raw: string | null): LaatsteRun | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return (typeof j === 'object' && j) ? j as LaatsteRun : null;
  } catch { return null; }
}

function formatDatum(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}

function formatPeriode(vanaf?: string | null, tot?: string | null): string {
  if (!vanaf || !tot) return '—';
  const fmt = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(vanaf)} → ${fmt(tot)}`;
}


function Teller({ label, value, tone }: { label: string; value: number | string; tone?: 'muted' | 'success' | 'warn' }) {
  const cls = tone === 'success' ? 'text-success'
    : tone === 'warn' ? 'text-warning'
    : 'text-foreground';
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-mono-data text-sm ${cls}`}>{value}</span>
    </div>
  );
}

export default function OffMarketBronnenSectie() {
  const { data: bronnen = [], isLoading } = useOffMarketBronnen();
  const { data: onverwerkt = 0 } = useOnverwerkteRuwCount();
  const { data: statsPerBron = {} } = useOffMarketBronStats();
  const runBron = useRunBron();
  const toggleBron = useToggleBron();
  const normalize = useNormalizeWachtrij();
  const volledig = useNormalizeWachtrijVolledig();
  const [batchPerBron, setBatchPerBron] = useState<Record<string, number>>({});
  const [normalizeBatch, setNormalizeBatch] = useState<number>(200);
  const [progress, setProgress] = useState<{ totaal: number; chunks: number } | null>(null);
  const [instellingenOpen, setInstellingenOpen] = useState<Record<string, boolean>>({});

  const getBatch = (id: string) => batchPerBron[id] ?? DEFAULT_BATCH;
  const toggleInstellingen = (id: string) =>
    setInstellingenOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const handleRun = async (b: OffMarketBron, modus: 'test' | 'handmatig' | 'sync') => {
    if (runBron.isPending) return;
    const maxRecords = getBatch(b.id);
    try {
      const r = await runBron.mutateAsync(
        modus === 'test'
          ? { bronId: b.id, modus: 'test', testMode: true, lookbackDays: 30, maxRecords }
          : modus === 'sync'
            ? { bronId: b.id, modus: 'sync', maxRecords }
            : { bronId: b.id, modus: 'handmatig', maxRecords },
      );
      const extra = r.totaal_server !== undefined ? ` · server: ${r.totaal_server}` : '';
      const cut = r.afgebroken ? ' · afgebroken (tijdslimiet)' : '';
      const tag = modus === 'test' ? ' [test]' : modus === 'sync' ? ' [sync]' : '';
      toast.success(
        `${b.naam}${tag}: ${r.opgehaald} opgehaald · ${r.nieuw} nieuw · ${r.dubbel} dubbel${extra}${cut}`,
      );
    } catch (e) {
      toast.error(`${b.naam}: ${e instanceof Error ? e.message : 'fout'}`);
    }
  };

  const handleToggle = async (b: OffMarketBron, actief: boolean) => {
    try {
      await toggleBron.mutateAsync({ id: b.id, actief });
      toast.success(`${b.naam} ${actief ? 'geactiveerd' : 'gedeactiveerd'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toggle mislukt');
    }
  };


  const handleNormalize = async (bronId?: string) => {
    if (normalize.isPending || volledig.isPending) return;
    try {
      const r = await normalize.mutateAsync({ limit: normalizeBatch, bronId });
      toast.success(
        `Verwerkt: ${r.verwerkt} · gepromoveerd ${r.gepromoveerd} · merged ${r.merged} · geskipt ${r.geskipt}` +
        (r.fouten ? ` · fouten ${r.fouten}` : ''),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verwerken mislukt');
    }
  };

  const handleVolledig = async (bronId?: string) => {
    if (normalize.isPending || volledig.isPending) return;
    setProgress({ totaal: 0, chunks: 0 });
    try {
      const r = await volledig.mutateAsync({
        batchSize: normalizeBatch,
        bronId,
        onProgress: (totaal, chunks) => setProgress({ totaal, chunks }),
      });
      const duurS = (r.duur_ms / 1000).toFixed(1);
      const tag = r.foutmelding ? '⚠ gestopt' : r.afgekapt ? 'afgekapt' : 'klaar';
      const msg =
        `Volledige wachtrij (${tag}): ${r.verwerkt} verwerkt · ${r.gepromoveerd} gepromoveerd · ` +
        `${r.merged} merged · ${r.geskipt} geskipt · ${r.fouten} fouten · ${r.chunks} chunks · ${duurS}s`;
      if (r.foutmelding) toast.error(`${msg} · ${r.foutmelding}`);
      else toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Volledige verwerking mislukt');
    } finally {
      setProgress(null);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <div className="text-xs text-muted-foreground mr-auto">
          Onverwerkt in buffer: <span className="font-mono-data text-foreground">{onverwerkt}</span>
        </div>
        <Select
          value={String(normalizeBatch)}
          onValueChange={(v) => setNormalizeBatch(Number(v))}
          disabled={normalize.isPending || volledig.isPending}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Batchgrootte">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[100, 200, 500, 1000].map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n} per chunk</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline"
          onClick={() => handleNormalize()}
          disabled={normalize.isPending || volledig.isPending}>
          {normalize.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <ListFilter className="h-4 w-4 mr-1" />}
          Wachtrij verwerken
        </Button>
        <Button size="sm" variant="default"
          onClick={() => handleVolledig()}
          disabled={normalize.isPending || volledig.isPending}>
          {volledig.isPending
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Zap className="h-4 w-4 mr-1" />}
          Verwerk volledige wachtrij
        </Button>
      </div>

      {volledig.isPending && progress && (
        <div className="bg-card border border-border rounded-md px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono-data">
            <span>{progress.totaal} verwerkt · {progress.chunks} chunks (batch {normalizeBatch})</span>
            <span>max 20.000 records / 5 min</span>
          </div>
          <Progress
            value={onverwerkt > 0 ? Math.min(100, (progress.totaal / (progress.totaal + onverwerkt)) * 100) : 100}
            className="h-1.5"
          />
        </div>
      )}

      {isLoading ? (
        <div className="bg-card border border-border rounded-lg px-5 py-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : bronnen.length === 0 ? (
        <div className="bg-card border border-border rounded-lg px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nog geen bronnen geconfigureerd.</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5" data-testid="off-market-bronnen-lijst">
          {bronnen.map(b => {
            const last = parseLaatsteRun(b.laatste_run_status);
            const stats: OffMarketBronStats | undefined = statsPerBron[b.id];
            const bezig = runBron.isPending && (runBron.variables as { bronId?: string } | string | undefined) !== undefined &&
              ((typeof runBron.variables === 'string' && runBron.variables === b.id) ||
               (typeof runBron.variables === 'object' && (runBron.variables as { bronId?: string })?.bronId === b.id));
            const batch = getBatch(b.id);
            return (
              <div
                key={b.id}
                data-testid="off-market-bron-kaart"
                className="section-card bg-card border border-border rounded-lg p-4 sm:p-5 space-y-3 min-w-0 overflow-hidden"
              >
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate min-w-0">{b.naam}</p>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{b.type}</Badge>
                    <StatusBadge bron={b} />
                    {last?.afgebroken && (
                      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                        afgebroken
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Laatste run: {formatDatum(b.laatste_run_op)}
                    {last?.duur_ms !== undefined && ` · ${(last.duur_ms / 1000).toFixed(1)}s`}
                  </div>
                  {b.laatste_fout && (
                    <div className="text-xs text-destructive flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="break-all">{b.laatste_fout}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={b.actief}
                      onCheckedChange={(v) => handleToggle(b, v)}
                      disabled={toggleBron.isPending} />
                    Actief
                  </label>
                  <Select
                    value={String(batch)}
                    onValueChange={(v) => setBatchPerBron(prev => ({ ...prev, [b.id]: Number(v) }))}
                    disabled={bezig}
                  >
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BATCH_OPTIES.map(n => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n} records
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost"
                    disabled={!b.actief || bezig}
                    onClick={() => handleRun(b, 'test')}
                    title="Testmodus: 30 dagen lookback">
                    Test
                  </Button>
                  <Button size="sm" variant="ghost"
                    disabled={!b.actief || bezig}
                    onClick={() => handleRun(b, 'sync')}
                    title="Sync: alleen nieuw/recent op basis van laatste sync + overlap">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sync nu
                  </Button>
                  <Button size="sm" variant="outline"
                    disabled={!b.actief || bezig}
                    onClick={() => handleRun(b, 'handmatig')}>
                    {bezig
                      ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      : <Play className="h-4 w-4 mr-1" />}
                    Nu draaien
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => toggleInstellingen(b.id)}
                    title="Instellingen">
                    <Settings2 className="h-4 w-4 mr-1" />
                    Instellingen
                    <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${instellingenOpen[b.id] ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {last && (
                  <div className="text-xs text-muted-foreground font-mono-data break-words">
                    {(last.modus ?? (last.test_mode ? 'test' : 'handmatig'))} · query {formatPeriode(last.query_vanaf, last.query_tot)}
                    {' · '}server {last.totaal_server ?? '—'}
                    {' · '}opgehaald {last.opgehaald ?? '—'}
                    {' · '}nieuw {last.nieuw ?? '—'}
                    {' · '}dubbel {last.dubbel ?? '—'}
                    {last.duur_ms !== undefined && ` · ${(last.duur_ms / 1000).toFixed(1)}s`}
                  </div>
                )}

                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>Laatste sync: <span className="text-foreground">{formatDatum(b.laatste_sync_op)}</span></span>
                  <span>Volgende run: <span className="text-foreground">{formatDatum(b.volgende_run_op)}</span></span>
                  <span>Frequentie: <span className="text-foreground">{b.frequentie}</span></span>
                  <span>Auto-import: <span className="text-foreground">{b.auto_import ? 'aan' : 'uit'}</span></span>
                  <span>Auto-verwerken: <span className="text-foreground">{b.auto_verwerken ? 'aan' : 'uit'}</span></span>
                  {(!b.auto_import || b.frequentie === 'handmatig') ? (
                    <span className="text-muted-foreground">Auto-sync uit · geen automatische run gepland</span>
                  ) : (
                    <span className="text-success">
                      Scheduler actief · volgende run: {formatDatum(b.volgende_run_op)}
                    </span>
                  )}
                </div>

                {(last || stats) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-border/60 tabular-nums">
                    <Teller label="server" value={last?.totaal_server ?? '—'} tone="muted" />
                    <Teller label="opgehaald" value={last?.opgehaald ?? '—'} />
                    <Teller label="nieuw" value={last?.nieuw ?? '—'} tone="success" />
                    <Teller label="dubbel" value={last?.dubbel ?? '—'} tone="muted" />
                    <Teller label="verwerkt" value={stats?.verwerkt ?? '—'} />
                    <Teller label="gepromoveerd" value={stats?.gepromoveerd ?? '—'} tone="success" />
                    <Teller label="geskipt" value={stats?.geskipt ?? '—'} tone="muted" />
                  </div>
                )}

                {instellingenOpen[b.id] && <BronInstellingenPanel bron={b} />}
                {instellingenOpen[b.id] && <BronBackfillPanel bron={b} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
