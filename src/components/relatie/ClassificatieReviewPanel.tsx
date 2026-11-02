import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PIPELINE_FASES, OBJECT_STATUS_LABELS,
  type Relatie, type RelatieContactpersoon, type Zoekprofiel,
  type PipelineKandidaat, type ObjectVastgoed,
} from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import {
  prioriteerClassificatieReviews,tekstProfielSuggestie,isBodOfVerder,
} from '@/lib/relaties/classificatieReview';

/** A15 read-only review worklist; click through to the existing relation page.
 * Existing matching, client records, pipeline and search profiles remain intact.
 */
export default function ClassificatieReviewPanel({
  relaties,zoekprofielen=[],pipelineKandidaten=[],contactMoments=[],contactpersonen=[],objecten,
}:{
  relaties:readonly Relatie[];
  zoekprofielen?:readonly Zoekprofiel[];
  pipelineKandidaten?:readonly PipelineKandidaat[];
  contactMoments?:readonly ContactMoment[];
  contactpersonen?:readonly RelatieContactpersoon[];
  objecten?:readonly ObjectVastgoed[];
}){
  const [open,setOpen]=useState(false);
  const [alles,setAlles]=useState(false);
  const [focus,setFocus]=useState<'alle'|'bod_of_verder'|'lopende_pipeline'|'actieve_zoekprofielen'|'archief_controle'|'zonder_koppelingen'>('alle');
  const reviews=useMemo(()=>prioriteerClassificatieReviews(
    relaties,zoekprofielen,pipelineKandidaten,contactMoments,objecten,
  ),[relaties,zoekprofielen,pipelineKandidaten,contactMoments,objecten]);
  const pending=reviews.filter(r=>r.status!=='reeds_ingevuld');
  const voorstellen=pending.filter(r=>r.status==='voorstel_controleren');
  const nader=pending.length-voorstellen.length;
  const naamControleren=pending.filter(r=>r.datakwaliteit==='naam_controleren').length;
  const urgent=pending.filter(r=>r.prioriteit==='hoog').length;
  const metBodOfVerder=pending.filter(r=>isBodOfVerder(r.hoogsteControleerbarePipelineFase)).length;
  const ontbrekendeObjecten=pending.reduce((n,r)=>n+r.pipelineOpNietGeladenObjecten,0);
  const gefilterd=pending.filter(r=>focus==='alle'||
    (focus==='bod_of_verder'&&isBodOfVerder(r.hoogsteControleerbarePipelineFase))||
    (focus==='lopende_pipeline'&&r.lopendePipelineKoppelingen>0)||
    (focus==='actieve_zoekprofielen'&&r.actieveZoekprofielen>0)||
    (focus==='archief_controle'&&r.pipelineOpNietGeladenObjecten>0)||
    (focus==='zonder_koppelingen'&&r.prioriteit==='regulier'));
  const byId=new Map(relaties.map(r=>[r.id,r]));
  const byObject=new Map((objecten??[]).map(o=>[o.id,o]));
  const primairPerRelatie=new Map<string,RelatieContactpersoon>();
  for(const cp of contactpersonen){
    const huidig=primairPerRelatie.get(cp.relatieId);
    if(!huidig||(!huidig.isPrimair&&cp.isPrimair))primairPerRelatie.set(cp.relatieId,cp);
  }
  const shown=alles?gefilterd:gefilterd.slice(0,12);
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Classificatiecontrole">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Partijprofielen controleren</h2>
        <p className="text-xs text-muted-foreground">
          {reviews.length-pending.length} van {reviews.length} actieve relaties ingedeeld ·
          {' '}{voorstellen.length} controlevoorstellen · {nader} nader onderzoeken
        </p>
        <p className="text-xs text-muted-foreground">
          {metBodOfVerder} met een bieding of vervolgfase op een geladen object · {ontbrekendeObjecten} pipelineposities op niet-geladen objecten · {naamControleren} met onvolledige partijnaam
        </p>
      </div>
      <button type="button" onClick={()=>setOpen(v=>!v)}
        aria-expanded={open} aria-controls="classificatiecontrole-inhoud"
        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
        {open?'Overzicht sluiten':'Voorstellen bekijken'}
      </button>
    </div>
    {open&&<div id="classificatiecontrole-inhoud" className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Hoogste prioriteit: kandidaten met een actief zoekprofiel of een lopende pipelinefase. Afgevallen dossiers blijven zichtbaar als historie.
        Biedingen en vergevorderde transactiedossiers op geladen objecten staan bovenaan. Pipelineposities bij ontbrekende of mogelijk gearchiveerde objecten krijgen een afzonderlijke controle. Een pipelinefase is een administratieve registratie, geen bewijs van een getekende koop.
        Bij ontbrekende namen moet de partij eerst geïdentificeerd worden.
        Voorstellen zijn onbevestigd: er wordt niets automatisch geclassificeerd
        of verstuurd. Gebruik de bestaande relatiepagina voor controle.
      </p>
      <label className="flex flex-wrap items-center gap-2 text-xs font-medium">
        Filter classificatiecontrole
        <select aria-label="Filter classificatiecontrole" value={focus}
          onChange={e=>{setFocus(e.target.value as typeof focus);setAlles(false);}}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="alle">Alle nog niet geclassificeerde relaties</option>
          <option value="bod_of_verder">Geregistreerd bod of vervolgfase</option>
          <option value="lopende_pipeline">Lopende kandidaatposities</option>
          <option value="actieve_zoekprofielen">Actieve zoekprofielen</option>
          <option value="archief_controle">Niet-geladen objecten (archiefcontrole)</option>
          <option value="zonder_koppelingen">Geen actieve zoekprofielen of lopende pipeline</option>
        </select>
        <span className="text-muted-foreground">{gefilterd.length} relaties</span>
      </label>
      {shown.length===0?<p className="text-sm text-muted-foreground">Geen relaties binnen dit filter die nog een partijprofiel nodig hebben.</p>
        :<div className="divide-y divide-border rounded-md border border-border">
          {shown.map(item=>{
            const relatie=byId.get(item.relatieId);
            if(!relatie||!item.suggestie)return null;
            const s=item.suggestie;
            return <div key={item.relatieId}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] px-3 py-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-sm break-words">
                  {relatie.bedrijfsnaam?.trim() && !/^onbekend(?:e relatie)?$/i.test(relatie.bedrijfsnaam.trim())
                    ?relatie.bedrijfsnaam.trim()
                    :primairPerRelatie.get(relatie.id)?.naam||'Partijnaam nog niet vastgesteld'}
                  {item.prioriteit==='hoog'&&<span className="ml-2 text-xs font-normal text-accent">Prioriteit vanwege actieve CRM-koppelingen</span>}
                </p>
                {item.datakwaliteit==='naam_controleren'&&<p className="text-xs font-medium text-destructive">
                  Bedrijfsnaam niet vastgesteld. Controleer of dit een particulier contact of een onderneming is; geen gegevens wissen.
                </p>}
                <p className="text-xs">
                  {s.voorstel
                    ?<>Voorstel ter controle: <strong>{tekstProfielSuggestie(s)}</strong></>
                    :<span className="text-muted-foreground">Onvoldoende informatie voor een voorstel</span>}
                </p>
                <p className="text-xs text-muted-foreground break-words">{s.bewijs}</p>
                {(item.pipelineKoppelingen>0||item.actieveZoekprofielen>0||item.contactmomenten>0)&&
                  <p className="text-xs text-muted-foreground">
                    {item.lopendePipelineKoppelingen} lopende / {item.pipelineKoppelingen} totale pipelinekoppelingen ·
                    {' '}{item.actieveZoekprofielen} actieve zoekprofielen ·
                    {' '}{item.contactmomenten} contactmomenten
                  </p>}
                {item.pipelineOpNietGeladenObjecten>0&&<p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {item.pipelineOpNietGeladenObjecten} bestaande pipelinepositie(s) verwijzen naar een object dat niet in de actieve objectlijst staat. Controleer archief/testregistraties; geen automatische verwijdering.
                </p>}
                {item.lopendePipelineDossiers.length>0&&<div className="mt-2 space-y-1.5" aria-label="Bestaande kandidaatdossiers">
                  <p className="text-xs font-semibold">Geregistreerde kandidaatposities</p>
                  {item.lopendePipelineDossiers.slice(0,3).map(d=>{
                    const object=byObject.get(d.objectId);
                    const fase=PIPELINE_FASES.find(x=>x.key===d.pipelineFase)?.label??d.pipelineFase;
                    return <div key={d.pipelineId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      {object
                        ?<Link className="text-accent hover:underline" to={`/objecten/${d.objectId}`}>
                          {object.titel||object.crmObjectnummer||'Object bekijken'}
                        </Link>
                        :<span className="text-amber-600 dark:text-amber-400 font-medium">Object ontbreekt in actieve lijst — controleer archiefstatus</span>}
                      <span className="text-muted-foreground">· {fase}</span>
                      {object&&object.status!=='beschikbaar'&&<span className="text-muted-foreground">
                        · Object: {OBJECT_STATUS_LABELS[object.status]}
                      </span>}
                      {typeof d.biedingBedrag==='number'&&Number.isFinite(d.biedingBedrag)&&<span className="text-muted-foreground">
                        · Geregistreerd bod: € {d.biedingBedrag.toLocaleString('nl-NL',{maximumFractionDigits:0})}
                      </span>}
                    </div>;
                  })}
                  {item.lopendePipelineDossiers.length>3&&<p className="text-xs text-muted-foreground">
                    En {item.lopendePipelineDossiers.length-3} andere kandidaatposities op de relatiepagina.
                  </p>}
                </div>}
              </div>
              <Link to={`/relaties/${relatie.id}`}
                className="self-center rounded-md border border-border px-3 py-2 text-center text-xs hover:bg-muted">
                Relatie beoordelen
              </Link>
            </div>;
          })}
        </div>}
      {!alles&&gefilterd.length>12&&<button type="button" className="text-sm text-accent"
        onClick={()=>setAlles(true)}>Toon overige {gefilterd.length-12} relaties</button>}
    </div>}
  </section>;
}
