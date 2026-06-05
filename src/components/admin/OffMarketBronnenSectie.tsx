import { Loader2, Play, Radio, ListFilter, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useOffMarketBronnen, useOnverwerkteRuwCount, useRunBron, useToggleBron, useNormalizeWachtrij,
  type OffMarketBron,
} from '@/hooks/useOffMarketBronnen';

function StatusBadge({ bron }: { bron: OffMarketBron }) {
  if (bron.laatste_fout) {
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">mislukt</Badge>;
  }
  if (!bron.laatste_run_op) {
    return <Badge variant="outline" className="text-muted-foreground">nooit gedraaid</Badge>;
  }
  return <Badge variant="outline" className="bg-success/10 text-success border-success/20">succes</Badge>;
}

function parseStatusSummary(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (typeof j !== 'object' || !j) return null;
    const nieuw = j.nieuw ?? 0;
    const dubbel = j.dubbel ?? 0;
    const opgehaald = j.opgehaald ?? 0;
    return `${opgehaald} opgehaald · ${nieuw} nieuw · ${dubbel} dubbel`;
  } catch {
    return null;
  }
}

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function OffMarketBronnenSectie() {
  const { data: bronnen = [], isLoading } = useOffMarketBronnen();
  const { data: onverwerkt = 0 } = useOnverwerkteRuwCount();
  const runBron = useRunBron();
  const toggleBron = useToggleBron();
  const normalize = useNormalizeWachtrij();

  const handleRun = async (b: OffMarketBron) => {
    if (runBron.isPending) return;
    try {
      const r = await runBron.mutateAsync(b.id);
      toast.success(`${b.naam}: ${r.opgehaald} opgehaald · ${r.nieuw} nieuw · ${r.dubbel} dubbel`);
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

  const handleNormalize = async () => {
    if (normalize.isPending) return;
    try {
      const r = await normalize.mutateAsync(200);
      toast.success(
        `Verwerkt: ${r.verwerkt} · gepromoveerd ${r.gepromoveerd} · merged ${r.merged} · geskipt ${r.geskipt}` +
        (r.fouten ? ` · fouten ${r.fouten}` : ''),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verwerken mislukt');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" /> Off-Market bronnen
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Automatische import van gemeentelijke bekendmakingen. Records gaan eerst naar de ruwe buffer,
            daarna naar de signalenlijst na normalisatie.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Onverwerkt in buffer: <span className="font-mono-data text-foreground">{onverwerkt}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleNormalize} disabled={normalize.isPending}>
            {normalize.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <ListFilter className="h-4 w-4 mr-1" />}
            Wachtrij verwerken
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-12 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : bronnen.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nog geen bronnen geconfigureerd.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bronnen.map(b => {
              const samenvatting = parseStatusSummary(b.laatste_run_status);
              const bezig = runBron.isPending && runBron.variables === b.id;
              return (
                <div key={b.id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{b.naam}</p>
                      <Badge variant="outline" className="text-xs text-muted-foreground">{b.type}</Badge>
                      <StatusBadge bron={b} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Laatste run: {formatDatum(b.laatste_run_op)}</span>
                      {samenvatting && <span>{samenvatting}</span>}
                    </div>
                    {b.laatste_fout && (
                      <div className="text-xs text-destructive mt-1 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="break-all">{b.laatste_fout}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={b.actief}
                        onCheckedChange={(v) => handleToggle(b, v)}
                        disabled={toggleBron.isPending} />
                      Actief
                    </label>
                    <Button size="sm" variant="outline"
                      disabled={!b.actief || bezig}
                      onClick={() => handleRun(b)}>
                      {bezig
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <Play className="h-4 w-4 mr-1" />}
                      Nu draaien
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
