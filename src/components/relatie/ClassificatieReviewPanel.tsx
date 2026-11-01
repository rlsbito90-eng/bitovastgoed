import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Relatie } from '@/data/mock-data';
import { maakClassificatieReview, tekstProfielSuggestie } from '@/lib/relaties/classificatieReview';

/**
 * A15 — one place to review possible classifications. It deliberately cannot
 * write, approve in bulk or alter matching. Click a relation to check/edit
 * its primary record using the existing inline editor.
 */
export default function ClassificatieReviewPanel({relaties}:{relaties:readonly Relatie[]}){
  const [open,setOpen]=useState(false);
  const [alles,setAlles]=useState(false);
  const reviews=useMemo(()=>maakClassificatieReview(relaties),[relaties]);
  const openItems=reviews.filter(r=>r.status!=='reeds_ingevuld');
  const candidates=openItems.filter(r=>r.status==='voorstel_controleren');
  const without=openItems.length-candidates.length;
  const byId=new Map(relaties.map(r=>[r.id,r]));
  const ordered=[...candidates,...openItems.filter(r=>r.status==='onderzoek_nodig')];
  const shown=alles?ordered:ordered.slice(0,12);
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Classificatiecontrole">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Partijprofielen controleren</h2>
        <p className="text-xs text-muted-foreground">
          {reviews.length-openItems.length} van {reviews.length} actieve relaties ingedeeld ·
          {' '}{candidates.length} controlevoorstellen · {without} nog te onderzoeken
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
        Dit zijn uitsluitend voorstellen op basis van eerder vastgelegde velden.
        Er wordt niets automatisch gewijzigd. Controleer de partij zelf in het relatieprofiel;
        ontwikkelende beleggers, makelaars, bemiddelaars en buitenlandse beleggers worden
        nooit op basis van aannames geclassificeerd.
      </p>
      {shown.length===0?<p className="text-sm text-muted-foreground">Alle actieve relaties hebben al een partijprofiel.</p>
        :<div className="divide-y divide-border rounded-md border border-border">
          {shown.map(item=>{
            const relatie=byId.get(item.relatieId);
            if(!relatie||!item.suggestie)return null;
            const s=item.suggestie;
            return <div key={item.relatieId} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] px-3 py-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-sm break-words">{relatie.bedrijfsnaam}</p>
                <p className="text-xs">
                  {s.voorstel
                    ?<>Voorstel ter controle: <strong>{tekstProfielSuggestie(s)}</strong></>
                    :<span className="text-muted-foreground">Onvoldoende informatie voor een voorstel</span>}
                </p>
                <p className="text-xs text-muted-foreground break-words">{s.bewijs}</p>
              </div>
              <Link to={`/relaties/${relatie.id}`}
                className="self-center rounded-md border border-border px-3 py-2 text-center text-xs hover:bg-muted">
                Relatie beoordelen
              </Link>
            </div>;
          })}
        </div>}
      {!alles&&ordered.length>12&&<button type="button" className="text-sm text-accent"
        onClick={()=>setAlles(true)}>Toon overige {ordered.length-12} relaties</button>}
    </div>}
  </section>;
}
