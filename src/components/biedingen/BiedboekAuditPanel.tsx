import { useEffect, useMemo, useState } from 'react';
import { Clock3, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { biedAuditDetails, biedAuditTitel, type BiedAuditEvent } from '@/lib/biedingen/auditFormat';

type Scope = { objectId: string } | { dealId: string } | { relatieId: string };

export default function BiedboekAuditPanel({ scope }: { scope: Scope }) {
  const [events, setEvents] = useState<BiedAuditEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { relaties, contactpersonen } = useDataStore();
  const scopeKey = JSON.stringify(scope);

  useEffect(() => {
    let actief = true;
    const laad = async () => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('bieding_audit_events' as any)
          .select('id, bieding_id, object_id, relatie_id, deal_id, operation, changed_fields, old_snapshot, new_snapshot, actor_id, created_at')
          .order('created_at', { ascending: false })
          .limit(150);
        if ('objectId' in scope) query = query.eq('object_id', scope.objectId);
        else if ('dealId' in scope) query = query.eq('deal_id', scope.dealId);
        else query = query.eq('relatie_id', scope.relatieId);

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        const records = (data ?? []) as unknown as BiedAuditEvent[];
        if (!actief) return;
        setEvents(records);

        const actorIds = [...new Set(records.map(e => e.actor_id).filter((id): id is string => !!id))];
        if (actorIds.length) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, volledige_naam')
            .in('id', actorIds);
          if (!actief) return;
          setNames(Object.fromEntries((profileData ?? []).map(p => [p.id, p.volledige_naam || 'Interne gebruiker'])));
        } else {
          setNames({});
        }
      } catch (err: unknown) {
        if (actief) setError(err instanceof Error ? err.message : 'Auditlogboek kon niet worden geladen.');
      } finally {
        if (actief) setLoading(false);
      }
    };
    void laad();
    return () => { actief = false; };
  }, [scopeKey]);

  const relatieNamen = useMemo(() => {
    return Object.fromEntries(relaties.map(r => {
      return [r.id, getRelatieNamen(r, contactpersonen).primair];
    }));
  }, [relaties, contactpersonen]);

  return (
    <section className="rounded-lg border border-border/70 bg-muted/15 p-3 sm:p-4 space-y-3" aria-label="Wijzigingslogboek biedingen">
      <div className="flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">Wijzigingslogboek</h3>
          <p className="text-xs text-muted-foreground">
            Onveranderbare registraties van toevoegingen, correcties en verwijderingen vanaf 16 november 2026.
            Eerdere wijzigingen zijn niet achteraf gereconstrueerd.
          </p>
        </div>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Wijzigingen ophalen…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="text-sm text-muted-foreground">Nog geen wijzigingen geregistreerd voor dit dossier.</p>
      )}
      {events.length > 0 && (
        <ol className="space-y-2" aria-label="Geregistreerde wijzigingen">
          {events.map(event => {
            const actor = event.actor_id ? names[event.actor_id] || 'Interne gebruiker' : 'Systeem / onbekend';
            const date = new Date(event.created_at);
            return (
              <li key={event.id} className="rounded-md border border-border/60 bg-card p-3 space-y-1">
                <div className="flex flex-wrap justify-between gap-1 text-sm">
                  <span className="font-semibold">{biedAuditTitel(event)}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    {Number.isNaN(date.getTime()) ? 'Datum onbekend' : date.toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {relatieNamen[event.relatie_id] || 'Kandidaat onbekend'} · {actor}
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {biedAuditDetails(event).map((line, i) => <li key={i} className="break-words">{line}</li>)}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
      {events.length === 150 && (
        <p className="text-xs text-muted-foreground">De 150 meest recente wijzigingen worden weergegeven.</p>
      )}
    </section>
  );
}
