import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type WebsiteIntake = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  created_at: string;
  status: 'ontvangen' | 'nieuw_te_controleren' | 'bestaande_relatie' | 'dubbelzinnig' | 'verwerkt' | 'afgewezen';
  suggested_relatie_id: string | null;
  raw_payload: {
    fields?: Record<string, string | string[]>;
  };
};

const labels: Record<WebsiteIntake['status'], string> = {
  ontvangen: 'Te beoordelen',
  nieuw_te_controleren: 'Mogelijk nieuwe relatie',
  bestaande_relatie: 'Bestaande relatie — wijzigingen controleren',
  dubbelzinnig: 'Mogelijke dubbele relatie',
  verwerkt: 'Verwerkt',
  afgewezen: 'Afgewezen',
};

/** Compacte, alleen-lezen beoordelingswachtrij.
 * Wijzigingen in Relaties en het aanmaken van een contact blijven bewust handmatig
 * totdat het exacte CF7 veldschema met een proefinzending is vastgesteld.
 */
export default function WebsiteInvesteringsprofielenInbox() {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<WebsiteIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('website_investor_intakes' as any)
      .select('id,applicant_name,applicant_email,applicant_phone,status,suggested_relatie_id,raw_payload,created_at')
      .not('status', 'in', '("verwerkt","afgewezen")')
      .order('created_at', { ascending: false })
      .limit(30);
    setLoading(false);
    if (queryError) {
      setError('Website-inzendingen konden niet worden opgehaald.');
      return;
    }
    setError(null);
    setItems((data ?? []) as unknown as WebsiteIntake[]);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <section className="section-card" aria-label="Inkomende investeringsprofielen van website">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="flex min-w-0 items-center gap-2 text-left font-semibold text-sm">
          <Inbox className="h-4 w-4 shrink-0" aria-hidden="true"/>
          Website-investeringsprofielen
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {loading ? '…' : items.length}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
        </button>
        <button type="button" onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
          aria-label="Website-inzendingen verversen" disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5"/> Verversen
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Inzendingen worden bewaard met de originele formulierantwoorden.
            Bestaande aankoopcriteria worden niet automatisch overschreven.
            Nieuwe profielen worden pas na controle in Relaties verwerkt.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Er zijn geen openstaande website-inzendingen.</p>
          )}
          <div className="space-y-2">
            {items.map(item => (
              <details key={item.id} className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block text-sm">{item.applicant_name}</strong>
                      <span className="block break-all text-xs text-muted-foreground">
                        {item.applicant_email}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-medium">{labels[item.status]}</span>
                      <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                        {new Date(item.created_at).toLocaleDateString('nl-NL')}
                      </time>
                    </div>
                  </div>
                </summary>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {item.applicant_phone && <p className="text-xs">Telefoon: {item.applicant_phone}</p>}
                  {item.suggested_relatie_id && (
                    <Link to={`/relaties/${item.suggested_relatie_id}`}
                      className="inline-block text-sm font-medium underline underline-offset-2">
                      Open mogelijke bestaande relatie
                    </Link>
                  )}
                  <p className="text-xs font-medium">Ingevulde formuliergegevens</p>
                  <dl className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                    {Object.entries(item.raw_payload?.fields ?? {}).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-muted/40 p-2">
                        <dt className="font-medium break-all">{key}</dt>
                        <dd className="break-words text-muted-foreground">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
