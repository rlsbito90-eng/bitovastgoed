import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isWebsiteBronmetadata, websiteVeldLabel, websiteVeldWaarde } from '@/lib/relaties/websiteInvesteerdersvelden';

interface HerkomstInzending {
  id: string;
  created_at: string;
  status: string;
  applicant_email: string;
  form_title: string;
  raw_payload: {
    fields?: Record<string,string|string[]>;
    sent_at?: string;
  };
}

/** Brongegevens van de websiteinzendingen zijn terug te vinden OP de relatiekaart.
 * Dit is nadrukkelijk geen bewerkbare/actuele marketingtoestemming of matchprofiel:
 * de ontvangst is gedateerd en de oorspronkelijke bron blijft intact.
 */
export default function WebsiteProfielHerkomst({ relatieId }: {relatieId:string}) {
  const [inzendingen,setInzendingen] = useState<HerkomstInzending[]>([]);
  const [error,setError] = useState(false);
  useEffect(()=>{
    let active=true;
    void (async ()=>{
      const {data,error:queryError} = await supabase
        .from('website_investor_intakes' as any)
        .select('id,created_at,status,applicant_email,form_title,raw_payload')
        .or(`processed_relatie_id.eq.${relatieId},suggested_relatie_id.eq.${relatieId}`)
        .order('created_at',{ascending:false})
        .limit(20);
      if(active) {
        setError(!!queryError);
        setInzendingen(queryError ? [] : (data ?? []) as unknown as HerkomstInzending[]);
      }
    })();
    return ()=>{active=false};
  },[relatieId]);
  if (!error && inzendingen.length===0) return null;

  return <section className="section-card p-5 sm:p-6 space-y-3" aria-label="Oorspronkelijke investeringsprofielinzendingen">
    <div>
      <h2 className="section-title">Website-investeringsprofiel — originele inzendingen</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Dit zijn de ongewijzigde antwoorden uit het formulier. Bewerkbare investeringscriteria
        staan hierboven onder Relaties. Nieuwsbriefkeuze en toestemming zijn historisch per
        inzending en worden niet als actuele marketingtoestemming geïnterpreteerd.
      </p>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">
      De oorspronkelijke websiteinzendingen konden niet worden opgehaald.
    </p>}
    {inzendingen.map(item=>{
      const fields=Object.entries(item.raw_payload?.fields ?? {});
      const criteria=fields.filter(([k])=>!isWebsiteBronmetadata(k));
      const metadata=fields.filter(([k])=>isWebsiteBronmetadata(k));
      const datum=new Date(item.created_at).toLocaleDateString('nl-NL');
      return <details key={item.id} className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {datum} · {item.form_title} · {item.status}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground break-words">
            Ingezonden door {item.applicant_email}. De waarden hieronder zijn alleen-lezen.
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {criteria.map(([key,value])=><div key={key} className="rounded-md bg-muted/40 p-2">
              <dt className="text-xs font-medium">{websiteVeldLabel(key)}</dt>
              <dd className="mt-1 text-xs break-words text-muted-foreground">
                {websiteVeldWaarde(value)}
              </dd>
            </div>)}
          </dl>
          {metadata.length>0 && <details className="rounded-md border border-border p-2">
            <summary className="cursor-pointer text-xs font-medium">
              Formuliertoestemming, nieuwsbriefkeuze en herkomst
            </summary>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {metadata.map(([key,value])=><div key={key} className="text-xs">
                <dt className="font-medium">{websiteVeldLabel(key)}</dt>
                <dd className="break-words text-muted-foreground">{websiteVeldWaarde(value)}</dd>
              </div>)}
            </dl>
          </details>}
        </div>
      </details>;
    })}
  </section>;
}
