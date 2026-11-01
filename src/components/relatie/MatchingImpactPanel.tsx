import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ObjectVastgoed, Relatie, Zoekprofiel } from '@/data/mock-data';
import { vergelijkMatchBeleid, type A15VerschilSoort } from '@/lib/matching/a15ImpactPreview';

/** In-memory, opt-in comparison. No persistence, outreach, or raw-data export. */
export default function MatchingImpactPanel({
  objecten,relaties,zoekprofielen,
}:{
  objecten:readonly ObjectVastgoed[];
  relaties:readonly Relatie[];
  zoekprofielen:readonly Zoekprofiel[];
}){
  const [toon,setToon]=useState(false);
  const [details,setDetails]=useState(false);
  const [filter,setFilter]=useState<A15VerschilSoort|'alle'>('alle');
  const [meer,setMeer]=useState(false);
  const preview=useMemo(()=>toon
    ?vergelijkMatchBeleid(objecten,relaties,zoekprofielen)
    :null,[toon,objecten,relaties,zoekprofielen]);
  const byRelatie=useMemo(()=>new Map(relaties.map(r=>[r.id,r])),[relaties]);
  const byObject=useMemo(()=>new Map(objecten.map(o=>[o.id,o])),[objecten]);
  const wijzigingen=preview?.verschillen.filter(x=>filter==='alle'||x.soort===filter)??[];
  const zichtbaar=meer?wijzigingen:wijzigingen.slice(0,25);
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Matchingvergelijking A15">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Matching — gevolgen van opschonen</h2>
        <p className="text-xs text-muted-foreground">
          Vergelijk het bestaande beleid met een voorgestelde werkwijze, zonder gegevens te wijzigen.
        </p>
      </div>
      <button type="button" onClick={()=>{setToon(x=>!x);setDetails(false);setMeer(false);}}
        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
        {toon?'Vergelijking sluiten':'Simulatie bekijken'}
      </button>
    </div>
    {toon&&preview&&<div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Dit is een voorlopige A15-simulatie, niet de nieuwe live matchingregel.
        Kandidaten kunnen ontbreken zolang hun partijprofiel niet is beoordeeld.
        Er wordt niets opgeslagen of aan iemand verstuurd.
      </p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {([
          ['Beschikbare objecten',preview.beschikbareObjecten],
          ['Kandidaatkoppelingen nu',preview.huidigeKandidaatKoppelingen],
          ['Gesimuleerde koppelingen',preview.gesimuleerdeKandidaatKoppelingen],
          ['Koppelingen die wegvallen',preview.verdwenenKoppelingen],
          ['Nieuwe koppelingen',preview.nieuweKoppelingen],
          ['Objecten met verschil',preview.objectenMetVerschil],
          ['Veranderde koperverwijzingen',preview.veranderdeKoperidentiteiten],
          ['Veranderde beste zoekroutes',preview.veranderdeBesteRoutes],
          ['Veranderde kwalificaties',preview.veranderdeMatchkwalificaties],
          ['Veranderde bevestigingsstatus',preview.veranderdeBevestigingen],
        ] as const).map(([label,value])=><div key={label}
          className="rounded-md border border-border/70 p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>
      <button type="button" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        onClick={()=>setDetails(x=>!x)} aria-expanded={details}>
        {details?'Verschillen verbergen':`Bekijk ${preview.verschillen.length} verschillen per object en relatie`}
      </button>
      {details&&<div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs font-medium" htmlFor="a15-type-verschil">Soort verschil</label>
          <select id="a15-type-verschil" value={filter}
            className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            onChange={e=>{setFilter(e.target.value as A15VerschilSoort|'alle');setMeer(false);}}>
            <option value="alle">Alle verschillen</option>
            <option value="weggevallen">Weggevallen kandidaten</option>
            <option value="nieuw">Nieuwe kandidaten</option>
            <option value="gewijzigd">Gewijzigde matches</option>
          </select>
          <span className="text-xs text-muted-foreground">{wijzigingen.length} gevonden</span>
        </div>
        {zichtbaar.length===0?<p className="text-sm text-muted-foreground">Geen verschillen voor dit filter.</p>:
          <div className="divide-y divide-border/60 rounded-md border border-border">
            {zichtbaar.map((v,i)=>{
              const relatie=byRelatie.get(v.relatieId);
              const object=byObject.get(v.objectId);
              return <article key={`${v.objectId}-${v.relatieId}-${v.soort}-${i}`}
                className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="text-sm break-words">{object?.titel||object?.crmObjectnummer||'Object zonder titel'}</strong>
                  <span className="text-xs text-muted-foreground">·</span>
                  <Link className="text-sm text-accent hover:underline break-words"
                    to={`/relaties/${v.relatieId}`}>{relatie?.bedrijfsnaam||'Relatie bekijken'}</Link>
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                    {v.soort==='weggevallen'?'Valt weg':v.soort==='nieuw'?'Komt erbij':'Wijzigt'}
                  </span>
                </div>
                {v.redenen.map((reden,j)=><p key={j} className="text-xs text-muted-foreground">{reden}</p>)}
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <p><strong>Huidig:</strong> {v.oud
                    ?`${v.oud.besteRoute.naam} · ${v.oud.besteRoute.kwalificatie}`
                    :'Geen contactroute'}</p>
                  <p><strong>Simulatie:</strong> {v.nieuw
                    ?`${v.nieuw.besteRoute.naam} · ${v.nieuw.besteRoute.kwalificatie}`
                    :'Geen contactroute'}</p>
                </div>
              </article>;
            })}
          </div>}
        {!meer&&wijzigingen.length>25&&<button type="button" className="text-sm text-accent"
          onClick={()=>setMeer(true)}>Toon overige {wijzigingen.length-25} verschillen</button>}
      </div>}
      <p className="text-xs text-muted-foreground">
        Een kandidaatkoppeling is één combinatie van een beschikbaar object en
        een relatie, niet een unieke koper. De simulatie houdt bestaande
        pipelinekoppelingen of eerdere benaderingen niet buiten de vergelijking.
        Verschillen in koperidentiteit zijn een controlepunt, geen opdracht
        om een koper automatisch te wijzigen.
      </p>
    </div>}
  </section>;
}
