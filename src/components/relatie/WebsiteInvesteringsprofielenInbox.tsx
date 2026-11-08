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
  processed_relatie_id: string | null;
  raw_payload: {
    fields?: Record<string, string | string[]>;
  };
};

const fieldLabels: Record<string,string> = {
  'your-name':'Naam', company:'Bedrijf / organisatie', 'your-email':'E-mailadres',
  telephone:'Telefoon', 'party-type':'Type partij', 'asset-types':'Vastgoedsegmenten',
  strategy:'Investeringsstrategie', 'investment-size':'Budget per transactie',
  'search-area':'Zoekgebied', 'object-size':'Gewenste objectomvang',
  situation:'Gewenste situatie', 'return-target':'Rendement / BAR',
  'purchase-term':'Aankooptermijn', financing:'Financieringsstructuur',
  'financing-status':'Status financiering', 'decision-speed':'Besluitvorming',
  'hard-criteria':'Belangrijkste acquisitiecriteria', dealbreakers:'Uitsluitingen',
  notes:'Overige toelichting', privacy:'Privacytoestemming',
  mc4wp_checkbox:'Nieuwsbriefkeuze',
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
 * Eenduidige nieuwe profielen kunnen server-side automatisch worden aangemaakt.
 * Bestaande profielen worden nooit automatisch overschreven.
 */
export default function WebsiteInvesteringsprofielenInbox() {
  const [expanded, setExpanded] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [items, setItems] = useState<WebsiteIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('website_investor_intakes' as any)
      .select('id,applicant_name,applicant_email,applicant_phone,status,suggested_relatie_id,processed_relatie_id,raw_payload,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!showProcessed) query = query.not('status', 'in', '("verwerkt","afgewezen")');
    const { data, error: queryError } = await query;
    setLoading(false);
    if (queryError) {
      setError('Website-inzendingen konden niet worden opgehaald.');
      return;
    }
    setError(null);
    setItems((data ?? []) as unknown as WebsiteIntake[]);
  }, [showProcessed]);

  const markReviewed = async (item: WebsiteIntake, status: 'verwerkt' | 'afgewezen') => {
    if (!window.confirm(status === 'verwerkt'
      ? 'Heb je de inzending met de relatie vergeleken en eventuele wijzigingen zelf verwerkt?'
      : 'Weet je zeker dat deze website-inzending niet verder opgevolgd hoeft te worden?')) return;
    setReviewing(item.id);
    const { error: updateError } = await supabase
      .from('website_investor_intakes' as any)
      .update({
        status, reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(status === 'verwerkt' && item.suggested_relatie_id
          ? { processed_relatie_id: item.suggested_relatie_id } : {}),
      } as any)
      .eq('id',item.id)
      .in('status',['bestaande_relatie','dubbelzinnig','nieuw_te_controleren']);
    setReviewing(null);
    if (updateError) {
      setError('Inzending kon niet worden afgehandeld. Probeer opnieuw.');
      return;
    }
    await refresh();
  };

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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showProcessed}
              onChange={e => setShowProcessed(e.target.checked)}
              aria-label="Toon ook verwerkte websiteprofielen" />
            Ook verwerkt tonen
          </label>
          <button type="button" onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
            aria-label="Website-inzendingen verversen" disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5"/> Verversen
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Inzendingen worden bewaard met de originele formulierantwoorden.
            Bestaande aankoopcriteria worden niet automatisch overschreven.
            Alleen eenduidige nieuwe profielen worden automatisch aan Relaties toegevoegd.
            Bestaande contacten en onduidelijke zoekcriteria blijven ter beoordeling staan.
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
                  {item.processed_relatie_id && (
                    <Link to={`/relaties/${item.processed_relatie_id}`}
                      className="block text-sm font-medium underline underline-offset-2">
                      Open automatisch aangemaakte relatie
                    </Link>
                  )}
                  {item.status === 'bestaande_relatie' && item.suggested_relatie_id && (
                    <div className="rounded-md border border-border p-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Vergelijk de nieuwe aankoopcriteria met de bestaande relatie.
                        Bestaande gegevens worden niet automatisch aangepast.
                      </p>
                      <button type="button" disabled={reviewing===item.id}
                        onClick={() => void markReviewed(item,'verwerkt')}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
                        Als beoordeeld markeren
                      </button>
                    </div>
                  )}
                  {item.status !== 'verwerkt' && item.status !== 'afgewezen' && (
                    <button type="button" disabled={reviewing===item.id}
                      onClick={() => void markReviewed(item,'afgewezen')}
                      className="rounded-md px-2 py-1.5 text-xs text-muted-foreground underline underline-offset-2">
                      Inzending negeren
                    </button>
                  )}
                  <p className="text-xs font-medium">Ingevulde formuliergegevens</p>
                  <dl className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                    {Object.entries(item.raw_payload?.fields ?? {}).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-muted/40 p-2">
                        <dt className="font-medium break-all">{fieldLabels[key] ?? key}</dt>
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
