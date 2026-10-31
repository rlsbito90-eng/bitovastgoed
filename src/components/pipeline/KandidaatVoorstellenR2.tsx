/**
 * Bito CRM R2 — READ-ONLY preview component, not installed in CRM yet.
 * No calls to Supabase, no automatic candidates, no NDA, teaser or bid.
 */
import { useMemo, useState } from 'react';
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

/** One card per contactrelation; multiple mandate routes shown inside. */
export function KandidaatVoorstellenR2(props: KandidaatVoorstellenProps) {
  const [toonAfwijkend, setToonAfwijkend] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const rows = useMemo(() => maakKandidaatVoorstellen(props.object, props.relaties, props.zoekprofielen,
    { reedsGekoppeld: props.reedsGekoppeld, toonAfwijkende: toonAfwijkend }),
    [props.object, props.relaties, props.zoekprofielen, props.reedsGekoppeld, toonAfwijkend]);
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
      <p className="text-sm text-muted-foreground">{rows.length} contactrelatie{rows.length===1?'':'s'} met mogelijke matches</p>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={toonAfwijkend} onChange={e=>setToonAfwijkend(e.target.checked)} />
        Toon afwijkende profielen
      </label>
    </div>
    {fout && <p className="text-sm text-destructive" role="alert">{fout}</p>}
    {rows.length===0 && <p className="text-sm text-muted-foreground">Geen nieuwe kandidaatvoorstellen. Controleer beschikbare zoekcriteria of bekijk de bestaande kandidaathistorie.</p>}
    {rows.map(p=><article key={p.relatieId} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-semibold break-words">{props.relatieNaam(p.relatieId)}</h3>
          <p className="text-xs text-muted-foreground">{p.alleRoutes.length} zoekroute{p.alleRoutes.length===1?'':'s'} · {p.besteRoute.route==='via_bemiddelaar'?'Via bemiddelaar':'Mogelijke directe koper'}</p>
        </div>
        <span className="text-xs rounded border border-border px-2 py-1">{label[p.besteRoute.kwalificatie]}</span>
      </div>
      {p.alleRoutes.map(route=><details key={route.key} className="rounded-md border border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">{route.naam} · {label[route.kwalificatie]} · {route.route==='via_bemiddelaar'?'bemiddelaar':'direct'}</summary>
        <div className="mt-3 space-y-2 text-xs">
          {route.toelichting.matcht.map(t=><p key={t}>✓ {t}</p>)}
          {route.toelichting.controleer.map(t=><p key={t} className="text-muted-foreground">Te controleren: {t}</p>)}
          {route.toelichting.afwijkend.map(t=><p key={t} className="text-destructive">Afwijking: {t}</p>)}
          <p className="text-muted-foreground">{route.route==='via_bemiddelaar' ?
            (route.koperRelatieId ? 'Gekoppelde koper geverifieerd; contact verloopt via bemiddelaar.' : 'Uiteindelijke koper nog niet vastgesteld.') :
            'Deze contactrelatie is de mogelijke koper.'}</p>
          <button type="button" className="rounded-md border border-input px-3 py-2 font-medium disabled:opacity-50"
            disabled={!props.onConceptGekozen || route.kwalificatie==='afwijkend'}
            onClick={()=>selecteer(p,route)}>
            Bereid keuze voor (geen opslag)
          </button>
        </div>
      </details>)}
    </article>)}
  </section>;
}