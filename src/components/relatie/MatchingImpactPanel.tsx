import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PIPELINE_FASES, type ObjectVastgoed, type Relatie, type Zoekprofiel, type PipelineKandidaat, type RelatieContactpersoon } from '@/data/mock-data';
import { vergelijkMatchBeleid, type A15VerschilSoort, type A15PipelineControleStatus } from '@/lib/matching/a15ImpactPreview';

const CONTROLE_LABELS:Record<A15PipelineControleStatus,string>={
  buiten_vergelijking:'Buiten simulatie',
  geen_match:'Niet gevonden in beide matchberekeningen',
  valt_weg:'Nieuwe matching verliest kandidaatroute',
  koperverwijzing:'Berekende koperverwijzing wijzigt',
  andere_wijziging:'Matchinguitkomst verandert',
  profiel_ontbreekt:'Partijprofiel nog niet ingevuld',
  ongewijzigd:'Geen berekend verschil',
};

/** In-memory, opt-in comparison. No persistence, outreach, or raw-data export. */
export default function MatchingImpactPanel({
  objecten,relaties,zoekprofielen,pipelineKandidaten=[],contactpersonen=[],
}:{
  objecten:readonly ObjectVastgoed[];
  relaties:readonly Relatie[];
  zoekprofielen:readonly Zoekprofiel[];
  pipelineKandidaten?:readonly PipelineKandidaat[];
  contactpersonen?:readonly RelatieContactpersoon[];
}){
  const [toon,setToon]=useState(false);
  const [details,setDetails]=useState(false);
  const [filter,setFilter]=useState<A15VerschilSoort|'alle'>('alle');
  const [meer,setMeer]=useState(false);
  const [pipelineOpen,setPipelineOpen]=useState(false);
  const [pipelineMeer,setPipelineMeer]=useState(false);
  const [pipelineFilter,setPipelineFilter]=useState<A15PipelineControleStatus|'controle'|'alle'>('controle');
  const preview=useMemo(()=>toon
    ?vergelijkMatchBeleid(objecten,relaties,zoekprofielen,pipelineKandidaten)
    :null,[toon,objecten,relaties,zoekprofielen,pipelineKandidaten]);
  const byRelatie=useMemo(()=>new Map(relaties.map(r=>[r.id,r])),[relaties]);
  const byObject=useMemo(()=>new Map(objecten.map(o=>[o.id,o])),[objecten]);
  const lopendePipelineKeys=useMemo(()=>new Set(pipelineKandidaten
    .filter(p=>p.pipelineFase!=='afgevallen'&&p.pipelineFase!=='afgerond')
    .map(p=>`${p.objectId}|${p.relatieId}`)),[pipelineKandidaten]);
  const wijzigingen=preview?.verschillen.filter(x=>filter==='alle'||x.soort===filter)??[];
  const zichtbaar=meer?wijzigingen:wijzigingen.slice(0,25);
  const pipelineRijen=preview?.pipelineControles.filter(p=>pipelineFilter==='alle'
    ||(pipelineFilter==='controle'&&p.status!=='ongewijzigd')
    ||p.status===pipelineFilter)??[];
  const pipelineZichtbaar=pipelineMeer?pipelineRijen:pipelineRijen.slice(0,25);
  const contactNaam=new Map<string,string>();
  for(const cp of contactpersonen){
    if(!contactNaam.has(cp.relatieId)||cp.isPrimair)contactNaam.set(cp.relatieId,cp.naam);
  }
  const naamRelatie=(id:string)=>byRelatie.get(id)?.bedrijfsnaam?.trim()
    ||contactNaam.get(id)||byRelatie.get(id)?.contactpersoon?.trim()||'Relatie zonder naam';
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Matchingvergelijking A15">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Matching — gevolgen van opschonen</h2>
        <p className="text-xs text-muted-foreground">
          Vergelijk het bestaande beleid met een voorgestelde werkwijze, zonder gegevens te wijzigen.
        </p>
      </div>
      <button type="button" onClick={()=>{setToon(x=>!x);setDetails(false);setMeer(false);setPipelineOpen(false);setPipelineMeer(false);}}
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
      <div className="rounded-md border border-border p-3 space-y-1 text-xs" aria-label="Bescherming bestaande pipeline">
        <p className="font-semibold">Bestaande pipeline blijft beschermd</p>
        <p>{preview.lopendePipelineKoppelingen} lopende pipelinekoppelingen · {preview.relatiesMetLopendePipelineZonderProfiel} relaties zonder partijprofiel · {preview.lopendePipelineMetVerschil} koppelingen met een matchingverschil.</p>
        <p className="text-muted-foreground">{preview.lopendePipelineBuitenVergelijking} lopende koppelingen vallen buiten deze simulatie doordat hun object niet aanbiedbaar is. Ze blijven behouden, maar mogen niet als gecontroleerd worden beschouwd.</p>
      </div>
      <div className="space-y-3 border-t border-border/70 pt-3" aria-label="A15.5 kandidaatposities">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <p><strong>{preview.pipelineTeBeoordelen}</strong> bestaande posities ter beoordeling</p>
          <p><strong>{preview.pipelineZonderGegenereerdeMatch}</strong> zonder match in beide modellen</p>
          <p><strong>{preview.pipelineWegvallendeRoutes}</strong> wegvallende routes</p>
          <p><strong>{preview.pipelineGewijzigdeKoperverwijzingen}</strong> gewijzigde berekende koperverwijzingen</p>
        </div>
        <p className="text-xs text-muted-foreground">
          De bestaande pipeline is de dossierregistratie, geen automatisch te vervangen matchresultaat.
          Een ontbrekende of gewijzigde berekende route mag nooit automatisch een kandidaat, bod of koper wissen.
        </p>
        <button type="button" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          onClick={()=>setPipelineOpen(v=>!v)} aria-expanded={pipelineOpen}>
          {pipelineOpen?'Kandidaatcontrole sluiten':`Controleer ${preview.pipelineControles.length} bestaande kandidaatposities`}
        </button>
        {pipelineOpen&&<div className="space-y-3">
          <label className="flex flex-wrap items-center gap-2 text-xs font-medium">
            Beoordelingsfilter
            <select aria-label="Filter bestaande kandidaatposities" value={pipelineFilter}
              onChange={e=>{setPipelineFilter(e.target.value as A15PipelineControleStatus|'controle'|'alle');setPipelineMeer(false);}}
              className="rounded-md border border-input bg-background px-2 py-2 text-sm">
              <option value="controle">Alle te beoordelen</option>
              <option value="alle">Alle bestaande posities</option>
              <option value="koperverwijzing">Gewijzigde koperverwijzing</option>
              <option value="valt_weg">Wegvallende kandidaatroute</option>
              <option value="geen_match">Geen match in beide modellen</option>
              <option value="buiten_vergelijking">Buiten simulatie</option>
              <option value="andere_wijziging">Andere matchingwijziging</option>
              <option value="profiel_ontbreekt">Ontbrekend partijprofiel</option>
              <option value="ongewijzigd">Geen berekend verschil</option>
            </select>
            <span className="text-muted-foreground">{pipelineRijen.length} posities</span>
          </label>
          {pipelineZichtbaar.length===0?<p className="text-sm text-muted-foreground">Geen kandidaatposities voor dit filter.</p>:
            <div className="divide-y divide-border/60 rounded-md border border-border">
              {pipelineZichtbaar.map((p,i)=><article
                key={p.pipelineId||`${p.objectId}|${p.relatieId}|${p.pipelineFase}|${i}`}
                className="p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  {byObject.has(p.objectId)
                    ?<Link className="text-sm font-medium text-accent hover:underline break-words"
                      to={`/objecten/${p.objectId}`}>
                      {byObject.get(p.objectId)?.titel||byObject.get(p.objectId)?.crmObjectnummer||'Object bekijken'}
                    </Link>
                    :<strong className="text-sm">Object niet geladen</strong>}
                  <span className="text-xs text-muted-foreground">·</span>
                  <Link to={`/relaties/${p.relatieId}`}
                    className="text-sm text-accent hover:underline">{naamRelatie(p.relatieId)}</Link>
                </div>
                <p className="text-xs">
                  <strong>{CONTROLE_LABELS[p.status]}</strong>
                  {' · '}
                  {PIPELINE_FASES.find(x=>x.key===p.pipelineFase)?.label||p.pipelineFase}
                  {p.partijprofielOntbreekt&&' · Partijprofiel ontbreekt'}
                </p>
                {p.redenen.map((reden,j)=><p key={j} className="text-xs text-muted-foreground">{reden}</p>)}
                {p.status==='koperverwijzing'&&<p className="text-xs text-muted-foreground">
                  Berekende koperverwijzing: huidig {p.huidigeKoperRelatieId
                    ?naamRelatie(p.huidigeKoperRelatieId):'niet vastgesteld'};
                  {' '}simulatie {p.nieuweKoperRelatieId
                    ?naamRelatie(p.nieuweKoperRelatieId):'niet vastgesteld'}.
                  Dit is geen wijziging van de feitelijke koper.
                </p>}
              </article>)}
            </div>}
          {!pipelineMeer&&pipelineRijen.length>25&&<button type="button"
            className="text-sm text-accent" onClick={()=>setPipelineMeer(true)}>
            Toon overige {pipelineRijen.length-25} posities
          </button>}
        </div>}
      </div>
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
                  {lopendePipelineKeys.has(`${v.objectId}|${v.relatieId}`)&&<span className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold">Bestaande lopende pipeline</span>}
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
        Bestaande pipelinekoppelingen worden afzonderlijk ter controle geteld, niet automatisch aangepast.
        Verschillen in koperidentiteit zijn een controlepunt, geen opdracht
        om een koper automatisch te wijzigen.
      </p>
    </div>}
  </section>;
}
