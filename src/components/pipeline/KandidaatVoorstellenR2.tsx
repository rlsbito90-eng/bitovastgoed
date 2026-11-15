/**
 * Bito CRM R2 — READ-ONLY preview, one directly contactable party per row.
 * No calls to Supabase, no automatic candidates, no NDA, teaser or bid.
 */
import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  isAanbiedbaar, maakKandidaatConcept, maakKandidaatVoorstellen,
  type CrmMandaatInput, type CrmObjectInput, type CrmRelatieInput,
  type KandidaatVoorstel, type ProfielRoute
} from '../../lib/matching/rolMandaatAdapter';

type Concept = Extract<ReturnType<typeof maakKandidaatConcept>, { ok: true }>['concept'];

export interface KandidaatVoorstellenProps {
  object: CrmObjectInput;
  relaties: readonly CrmRelatieInput[];
  zoekprofielen: readonly CrmMandaatInput[];
  reedsGekoppeld: ReadonlySet<string>;
  relatieNaam: (relatieId: string) => string;
  /** Human action only. Parent must validate again and separately persist shortlist. */
  onConceptGekozen?: (concept: Concept) => void;
}
const label: Record<ProfielRoute['kwalificatie'],string> = {
  passend: 'Passend', te_verifieren: 'Te verifiëren', afwijkend: 'Afwijkend', onvoldoende: 'Onvoldoende gegevens',
};

/** One card per contactrelation; general and specific search criteria are separate routes. */
export function KandidaatVoorstellenR2(props: KandidaatVoorstellenProps) {
  const [toonAfwijkend, setToonAfwijkend] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [afgewezenIds,setAfgewezenIds] = useState<Set<string>>(new Set());
  const [besluitenGeladen,setBesluitenGeladen] = useState(false);
  useEffect(()=>{
    let actief=true;
    setBesluitenGeladen(false);
    void supabase.from('relatie_object_matchbesluiten' as any)
      .select('relatie_id').eq('object_id',props.object.id).eq('status','afgewezen')
      .then(({data,error})=>{
        if(!actief)return;
        if(error){setFout('Eerdere afwijzingen konden niet worden geladen');return;}
        setAfgewezenIds(new Set(((data??[]) as any[]).map(x=>x.relatie_id)));
        setBesluitenGeladen(true);
      });
    return ()=>{actief=false};
  },[props.object.id]);
  const rows = useMemo(() => maakKandidaatVoorstellen(props.object, props.relaties, props.zoekprofielen,
    { reedsGekoppeld: new Set([...props.reedsGekoppeld,...afgewezenIds]), toonAfwijkende: toonAfwijkend }),
    [props.object, props.relaties, props.zoekprofielen, props.reedsGekoppeld, toonAfwijkend,afgewezenIds]);
  if (!isAanbiedbaar(props.object)) return (
    <p className="text-sm text-muted-foreground" role="status">Dit object is momenteel niet beschikbaar voor nieuwe kandidaatsuggesties. Bestaande kandidaten blijven in de historie.</p>
  );
  function selecteer(p: KandidaatVoorstel, route: ProfielRoute) {
    if(!props.onConceptGekozen) return;
    const handoff=maakKandidaatConcept(props.object,p,route.key);
    if(!handoff.ok){setFout(handoff.reden);return;}
    setFout(null);
    props.onConceptGekozen(handoff.concept);
  }
  return <section className="space-y-3" aria-label="Nieuwe kandidaatsuggesties">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{besluitenGeladen?rows.length+' kandidaten om te beoordelen':'Beoordelingen laden…'}</p>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={toonAfwijkend} onChange={e=>setToonAfwijkend(e.target.checked)} />
        Toon afwijkende profielen
      </label>
    </div>
    {fout && <p className="text-sm text-destructive" role="alert">{fout}</p>}
    {rows.length===0 && <p className="text-sm text-muted-foreground">Geen nieuwe kandidaatvoorstellen. Controleer beschikbare zoekcriteria of bekijk de bestaande kandidaathistorie.</p>}
    {besluitenGeladen&&rows.map(p=><article key={p.relatieId} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-semibold break-words">{props.relatieNaam(p.relatieId)}</h3>
          <p className="text-xs text-muted-foreground">{p.alleRoutes.length} zoekprofiel{p.alleRoutes.length===1?'':'en'} · Direct benaderbare partij</p>
        </div>
        <span className="text-xs rounded border border-border px-2 py-1">{label[p.besteRoute.kwalificatie]}</span>
      </div>
      {p.alleRoutes.map(route=><details key={route.key} className="rounded-md border border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">{route.naam} · {label[route.kwalificatie]}</summary>
        <div className="mt-3 space-y-2 text-xs">
          {route.toelichting.matcht.map(t=><p key={t}>✓ {t}</p>)}
          {route.toelichting.controleer.map(t=><p key={t} className="text-muted-foreground">Te controleren: {t}</p>)}
          {route.toelichting.afwijkend.map(t=><p key={t} className="text-destructive">Afwijking: {t}</p>)}
          <p className="text-muted-foreground">Controleer de aanvullende voorwaarden voordat je deze partij aan het object koppelt.</p>
          <button type="button" className="rounded-md border border-input px-3 py-2 font-medium disabled:opacity-50"
            disabled={!props.onConceptGekozen || route.kwalificatie==='afwijkend'}
            onClick={()=>selecteer(p,route)}>
            Selecteer kandidaat
          </button>
        </div>
      </details>)}
    </article>)}
  </section>;
}