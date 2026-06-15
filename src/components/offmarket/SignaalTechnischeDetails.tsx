// Tab "Technisch" — toont auto-import/scoring/parser-info zodat deze
// niet langer prominent in het commerciële dossier staat.
import { Server } from 'lucide-react';
import { splitsNotities } from '@/lib/offMarket/notities';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

function formatDateTimeNL(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('nl-NL'); } catch { return d; }
}

function Field({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm text-foreground mt-0.5 break-all ${mono ? 'font-mono-data' : ''}`}>
        {children ?? <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

export default function SignaalTechnischeDetails({ signaal: s }: Props) {
  const { technisch } = splitsNotities(s.notities);
  const componenten = ((s as any).ai_score_componenten ?? null) as Record<string, number> | null;
  const autoImportScore = (s as any).auto_import_score as number | null | undefined;
  const dedupeHash = (s as any).dedupe_hash as string | null | undefined;

  return (
    <div className="space-y-5">
      <section className="section-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          Technische details
        </h2>
        <p className="text-xs text-muted-foreground">
          Auto-import-/AI-systeemdata. Wordt niet getoond in het commerciële dossier.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Auto-import score" mono>
            {autoImportScore != null ? String(autoImportScore) : null}
          </Field>
          <Field label="AI-status">{((s as any).ai_status ?? '—')}</Field>
          <Field label="AI verrijkt op">{formatDateTimeNL((s as any).ai_laatst_verrijkt_op)}</Field>
          <Field label="Model" mono>{s.ai_model}</Field>
          <Field label="Prompt-versie" mono>{(s as any).ai_prompt_versie}</Field>
          <Field label="Dedupe-hash" mono>{dedupeHash ?? null}</Field>
        </div>

        {componenten && Object.keys(componenten).length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Scorecomponenten</p>
            <pre className="text-xs font-mono-data text-foreground bg-muted/40 rounded-md p-3 overflow-x-auto">
{JSON.stringify(componenten, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="section-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Bronlog</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Extern-ID" mono>{(s as any).extern_id ?? null}</Field>
          <Field label="Bron-URL" mono>
            {s.bron_url ? (
              <a href={s.bron_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{s.bron_url}</a>
            ) : null}
          </Field>
        </div>
      </section>

      {technisch && (
        <section className="section-card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Auto-import notities</h2>
          <pre className="text-xs font-mono-data text-muted-foreground whitespace-pre-wrap">{technisch}</pre>
        </section>
      )}
    </div>
  );
}
