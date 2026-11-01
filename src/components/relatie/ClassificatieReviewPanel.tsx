import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Relatie, Zoekprofiel, PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import {
  prioriteerClassificatieReviews,tekstProfielSuggestie,
} from '@/lib/relaties/classificatieReview';

/** A15 read-only review worklist; click through to the existing relation page.
 * Existing matching, client records, pipeline and search profiles remain intact.
 */
export default function ClassificatieReviewPanel({
  relaties,zoekprofielen=[],pipelineKandidaten=[],contactMoments=[],
}:{
  relaties:readonly Relatie[];
  zoekprofielen?:readonly Zoekprofiel[];
  pipelineKandidaten?:readonly PipelineKandidaat[];
  contactMoments?:readonly ContactMoment[];
}){
  const [open,setOpen]=useState(false);
  const [alles,setAlles]=useState(false);
  const reviews=useMemo(()=>prioriteerClassificatieReviews(
    relaties,zoekprofielen,pipelineKandidaten,contactMoments,
  ),[relaties,zoekprofielen,pipelineKandidaten,contactMoments]);
  const pending=reviews.filter(r=>r.status!=='reeds_ingevuld');
  const voorstellen=pending.filter(r=>r.status==='voorstel_controleren');
  const nader=pending.length-voorstellen.length;
  const naamControleren=pending.filter(r=>r.datakwaliteit==='naam_controleren').length;
  const urgent=pending.filter(r=>r.prioriteit==='hoog').length;
  const byId=new Map(relaties.map(r=>[r.id,r]));
  const shown=alles?pending:pending.slice(0,12);
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Classificatiecontrole">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Partijprofielen controleren</h2>
        <p className="text-xs text-muted-foreground">
          {reviews.length-pending.length} van {reviews.length} actieve relaties ingedeeld ·
          {' '}{voorstellen.length} controlevoorstellen · {nader} nader onderzoeken
        </p>
        <p className="text-xs text-muted-foreground">
          {urgent} met actieve zoekprofielen of pipeline · {naamControleren} met onvolledige partijnaam
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
        Hoogste prioriteit: bestaande kandidaten met zoekprofielen of pipelinehistorie.
        Bij ontbrekende namen moet de partij eerst geïdentificeerd worden.
        Voorstellen zijn onbevestigd: er wordt niets automatisch geclassificeerd
        of verstuurd. Gebruik de bestaande relatiepagina voor controle.
      </p>
      {shown.length===0?<p className="text-sm text-muted-foreground">Alle actieve relaties hebben al een partijprofiel.</p>
        :<div className="divide-y divide-border rounded-md border border-border">
          {shown.map(item=>{
            const relatie=byId.get(item.relatieId);
            if(!relatie||!item.suggestie)return null;
            const s=item.suggestie;
            return <div key={item.relatieId}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] px-3 py-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-sm break-words">
                  {relatie.bedrijfsnaam?.trim()||'Naam ontbreekt — identiteit controleren'}
                  {item.prioriteit==='hoog'&&<span className="ml-2 text-xs font-normal text-accent">Prioriteit vanwege actieve CRM-koppelingen</span>}
                </p>
                {item.datakwaliteit==='naam_controleren'&&<p className="text-xs font-medium text-destructive">
                  Bedrijfsnaam ontbreekt of is ‘Onbekend’. Eerst identiteit verifiëren; geen gegevens wissen.
                </p>}
                <p className="text-xs">
                  {s.voorstel
                    ?<>Voorstel ter controle: <strong>{tekstProfielSuggestie(s)}</strong></>
                    :<span className="text-muted-foreground">Onvoldoende informatie voor een voorstel</span>}
                </p>
                <p className="text-xs text-muted-foreground break-words">{s.bewijs}</p>
                {(item.pipelineKoppelingen>0||item.actieveZoekprofielen>0||item.contactmomenten>0)&&
                  <p className="text-xs text-muted-foreground">
                    {item.pipelineKoppelingen} pipelinekoppelingen ·
                    {' '}{item.actieveZoekprofielen} actieve zoekprofielen ·
                    {' '}{item.contactmomenten} contactmomenten
                  </p>}
              </div>
              <Link to={`/relaties/${relatie.id}`}
                className="self-center rounded-md border border-border px-3 py-2 text-center text-xs hover:bg-muted">
                Relatie beoordelen
              </Link>
            </div>;
          })}
        </div>}
      {!alles&&pending.length>12&&<button type="button" className="text-sm text-accent"
        onClick={()=>setAlles(true)}>Toon overige {pending.length-12} relaties</button>}
    </div>}
  </section>;
}
