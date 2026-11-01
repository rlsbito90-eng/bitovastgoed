import { useMemo, useState } from 'react';
import type { ObjectVastgoed, Relatie, Zoekprofiel } from '@/data/mock-data';
import { vergelijkMatchBeleid } from '@/lib/matching/a15ImpactPreview';

/** Safe side-by-side comparison, using only already-loaded CRM records in memory.
 * No DB writes, report upload, logging or external service requests.
 */
export default function MatchingImpactPanel({
  objecten,relaties,zoekprofielen,
}:{
  objecten:readonly ObjectVastgoed[];
  relaties:readonly Relatie[];
  zoekprofielen:readonly Zoekprofiel[];
}){
  const [toon,setToon]=useState(false);
  const preview=useMemo(()=>toon
    ?vergelijkMatchBeleid(objecten,relaties,zoekprofielen)
    :null,[toon,objecten,relaties,zoekprofielen]);
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Matchingvergelijking A15">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Matching — gevolgen van opschonen</h2>
        <p className="text-xs text-muted-foreground">
          Test uitsluitend in het geheugen of bestaande kandidaatvoorstellen zouden veranderen.
        </p>
      </div>
      <button type="button" onClick={()=>setToon(x=>!x)}
        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
        {toon?'Vergelijking sluiten':'Simulatie bekijken'}
      </button>
    </div>
    {toon&&preview&&<div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Dit is een voorzichtige A15-proefberekening, geen gevalideerde nieuwe
        matchingregel. Kandidaten met uitsluitend historische rol-/typegegevens
        kunnen verdwijnen zolang hun partijprofiel niet is beoordeeld.
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
        ] as const).map(([label,value])=><div key={label} className="rounded-md border border-border/70 p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>
      <p className="text-xs text-muted-foreground">
        Een kandidaatkoppeling is één combinatie van een beschikbaar object en een relatie,
        niet een unieke koper. Bestaande pipelinekoppelingen en eerdere benaderingen
        worden in deze globale vergelijking niet uitgesloten. Verschillen moeten
        per relatie worden beoordeeld vóór wijziging van Matching.
      </p>
    </div>}
  </section>;
}
