// Tab "Brieven & opvolging" — toont alle brieven van een signaal,
// gekoppelde opvolgtaak (Brief 2) en duidelijke status per brief.
import { useMemo } from 'react';
import { Mail, Plus, FileDown, ArrowUpRight } from 'lucide-react';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import { useDataStore } from '@/hooks/useDataStore';
import { bepaalVolgendeActie, formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import BriefVoorbereidenKnop from '@/components/offmarket/BriefVoorbereidenKnop';
import { Link } from 'react-router-dom';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

function formatDateNL(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return d; }
}

export default function SignaalBrievenSectie({ signaal }: Props) {
  const { data: brieven = [], isLoading } = useOffMarketBrievenForSignaal(signaal.id);
  const { taken } = useDataStore();
  const va = useMemo(() => bepaalVolgendeActie(signaal, taken, signaal.id), [signaal, taken]);

  // Brieven al nieuwste-eerst; voor weergave keren we om zodat Brief 1 bovenaan
  // staat (chronologisch, sluit aan bij briefnummering).
  const chronologisch = useMemo(() => [...brieven].reverse(), [brieven]);

  return (
    <section className="section-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Brieven & opvolging ({brieven.length})
        </h2>
        <BriefVoorbereidenKnop signaal={signaal} />
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Brieven laden…</p>
      ) : chronologisch.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen brieven voorbereid voor dit signaal.</p>
      ) : (
        <ul className="divide-y divide-border/70 -mx-1">
          {chronologisch.map((b, i) => (
            <li key={b.id} className="px-1 py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Brief {i + 1}{' '}
                    <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full border ${
                      b.status === 'verstuurd'
                        ? 'bg-success/10 text-success border-success/25'
                        : 'bg-secondary/15 text-foreground border-secondary/30'
                    }`}>
                      {b.status === 'verstuurd' ? 'Verstuurd' : 'Concept'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {b.status === 'verstuurd'
                      ? `Verzonden op ${formatDateNL(b.verzonden_op)}`
                      : `Aangemaakt ${formatDateNL(b.created_at)}`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs">
                <Veld label="Aan" value={b.eigenaar_naam || b.eigenaar_bedrijfsnaam} />
                <Veld label="Verzendadres" value={b.verzendadres} />
                <Veld label="Object" value={b.objectomschrijving || b.objectadres} />
                <Veld label="Onderwerp" value={b.onderwerp} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Gekoppelde opvolgtaak */}
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Volgende actie
        </p>
        {va ? (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm text-foreground">{va.titel}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatDeadlineNL(va.deadline)}</p>
            </div>
            {va.bron === 'taak' && va.taakId && (
              <Link to={`/taken/${va.taakId}`} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                Open taak <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Geen open opvolgtaak. Bij "Markeer als verstuurd" wordt automatisch een Brief 2-taak aangemaakt.
          </p>
        )}
      </div>
    </section>
  );
}

function Veld({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground break-words">{value || '—'}</span>
    </div>
  );
}
