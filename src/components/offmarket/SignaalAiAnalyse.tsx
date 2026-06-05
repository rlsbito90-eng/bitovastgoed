import { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useEnrichSignaal } from '@/hooks/useEnrichSignaal';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const STATUS_LABEL: Record<string, string> = {
  niet_verrijkt: 'Niet verrijkt',
  in_wachtrij: 'In wachtrij',
  bezig: 'Bezig…',
  klaar: 'Verrijkt',
  mislukt: 'Mislukt',
};

const STATUS_CLS: Record<string, string> = {
  niet_verrijkt: 'bg-muted text-muted-foreground',
  in_wachtrij: 'bg-muted text-muted-foreground',
  bezig: 'bg-accent/15 text-accent',
  klaar: 'bg-success/15 text-success',
  mislukt: 'bg-destructive/15 text-destructive',
};

function formatDateTimeNL(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }); } catch { return d; }
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono-data text-foreground">{v}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

const COMP_LABEL: Record<string, string> = {
  locatie: 'Locatie',
  asset_match: 'Asset-match',
  eigenaar_signaal: 'Eigenaar-signaal',
  timing: 'Timing',
  fee_potentieel: 'Fee-potentieel',
};

interface Props { signaal: OffMarketSignaal; }

export default function SignaalAiAnalyse({ signaal: s }: Props) {
  const enrich = useEnrichSignaal();
  const [laatsteFout, setLaatsteFout] = useState<string | null>(null);

  const status = ((s as any).ai_status as string | undefined) ?? 'niet_verrijkt';
  const isLoading = enrich.isPending || status === 'bezig';
  const heeftResultaat = status === 'klaar' && typeof s.ai_score === 'number';
  const isMislukt = status === 'mislukt';

  const run = async (force: boolean) => {
    setLaatsteFout(null);
    try {
      const r = await enrich.mutateAsync({ signaalId: s.id, force });
      toast.success(r.cached ? 'Verrijking opgehaald uit cache.' : 'Signaal verrijkt met AI.');
    } catch (e: any) {
      const msg = e?.message ?? 'AI-verrijking mislukt.';
      setLaatsteFout(msg);
      toast.error(msg);
    }
  };

  const componenten = (((s as any).ai_score_componenten ?? {}) as Record<string, number>);
  const verkoopkansPct = typeof s.ai_verkoopkans === 'number'
    ? Math.round(Number(s.ai_verkoopkans) * 100) : null;
  const skip = (s as any).ai_skip_reden as string | null | undefined;

  return (
    <section className="section-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">AI-analyse</h2>
          <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLS[status] ?? STATUS_CLS.niet_verrijkt}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {heeftResultaat ? (
            <Button size="sm" variant="outline" onClick={() => run(true)} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Opnieuw verrijken
            </Button>
          ) : (
            <Button size="sm" onClick={() => run(false)} disabled={isLoading}>
              <Sparkles className={`h-3.5 w-3.5 ${isLoading ? 'animate-pulse' : ''}`} />
              {isLoading ? 'Bezig…' : 'Verrijk met AI'}
            </Button>
          )}
        </div>
      </div>

      {!heeftResultaat && !isLoading && !isMislukt && (
        <p className="text-sm text-muted-foreground">
          Nog niet verrijkt. Klik op "Verrijk met AI" voor een score, samenvatting en aanbevolen actie.
        </p>
      )}

      {isLoading && !heeftResultaat && (
        <p className="text-sm text-muted-foreground">Bezig met analyse…</p>
      )}

      {(isMislukt || laatsteFout) && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Verrijking mislukt</p>
            {laatsteFout && <p className="text-xs">{laatsteFout}</p>}
            <Button size="sm" variant="outline" onClick={() => run(true)} disabled={isLoading} className="mt-1">
              Opnieuw proberen
            </Button>
          </div>
        </div>
      )}

      {heeftResultaat && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">AI-score</p>
              <p className="text-2xl font-mono-data text-foreground mt-1">{s.ai_score}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verkoopkans</p>
              <p className="text-2xl font-mono-data text-foreground mt-1">
                {verkoopkansPct != null ? `${verkoopkansPct}%` : '—'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Strategie-suggestie</p>
              <p className="text-sm text-foreground mt-1">{s.ai_strategie_suggestie ?? '—'}</p>
            </div>
          </div>

          {Object.keys(componenten).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {(Object.keys(COMP_LABEL)).map(k => (
                <ScoreBar key={k} label={COMP_LABEL[k]} value={Number(componenten[k] ?? 0)} />
              ))}
            </div>
          )}

          {s.ai_samenvatting && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Samenvatting</p>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{s.ai_samenvatting}</p>
            </div>
          )}

          {s.ai_aanbevolen_actie && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Aanbevolen actie</p>
              <p className="text-sm text-foreground mt-1">{s.ai_aanbevolen_actie}</p>
            </div>
          )}

          {skip && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              Skip-reden van AI: <span className="text-foreground">{skip}</span>
            </div>
          )}

          <div className="border-t border-border/60 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
            <div><span className="block">Model</span><span className="text-foreground font-mono-data break-all">{s.ai_model ?? '—'}</span></div>
            <div><span className="block">Prompt-versie</span><span className="text-foreground font-mono-data">{s.ai_prompt_versie ?? '—'}</span></div>
            <div><span className="block">Verrijkt op</span><span className="text-foreground">{formatDateTimeNL(s.ai_laatst_verrijkt_op)}</span></div>
          </div>
        </div>
      )}
    </section>
  );
}
