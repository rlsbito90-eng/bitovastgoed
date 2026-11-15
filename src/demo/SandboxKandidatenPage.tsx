import { useState } from 'react';
import { ClipboardList, ShieldCheck } from 'lucide-react';
import ObjectPipelineActies from '@/components/pipeline/ObjectPipelineActies';

type Actie = 'toevoegen' | 'aanbieding' | 'reactie' | null;

/**
 * Uitsluitend een klikbaar UI-concept, zonder productie-datastore of formulieren.
 * Controleert de zichtbaarheid en betekenis van kandidaat-acties op mobiel.
 */
export default function SandboxKandidatenPage(){
  const [actie,setActie]=useState<Actie>(null);
  return <div className="space-y-5">
    <div className="space-y-2">
      <p className="uppercase tracking-wider text-accent font-semibold text-xs">Interactieve interfaceproef</p>
      <h1 className="text-2xl font-semibold">Kandidaten / dealtraject</h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Op dit voorbeeldscherm beoordelen we alleen de knoppenindeling.
        Je echte kandidaatoverzicht en de registratieformulieren blijven ongewijzigd.
      </p>
    </div>
    <section className="section-card p-4 sm:p-6 space-y-4" aria-label="Voorbeeld kandidatenacties">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h2 className="section-title">Kandidaten / dealtraject</h2>
          <p className="text-xs text-muted-foreground mt-1">8 kandidaten in pipeline (fictief)</p>
        </div>
        <ObjectPipelineActies canAdd onAdd={()=>setActie('toevoegen')}
          onOffer={()=>setActie('aanbieding')} onReply={()=>setActie('reactie')}/>
      </div>
      <div className="rounded-lg border border-border/70 p-3 space-y-3">
        <div className="flex justify-between gap-2 items-center">
          <p className="font-medium text-sm">Voorbeeldbelegger</p>
          <span className="text-xs text-muted-foreground">Fictief</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Geïnteresseerd · laatst contactmoment vandaag (voorbeeld)
        </p>
        <p className="text-xs text-muted-foreground">
          Bij een echte kandidaat blijven aanbod en reactie als vervolgactie beschikbaar.
        </p>
      </div>
      {actie&&<div role="status" className="rounded-lg bg-muted/40 border border-border/70 p-3 space-y-1">
        <div className="font-semibold text-sm">
          {actie==='toevoegen'?'Kandidaat toevoegen':actie==='aanbieding'?'Aanbieding registreren':'Reactie registreren'}
        </div>
        <p className="text-xs text-muted-foreground">
          In de echte CRM opent hier het bestaande formulier.
          In deze geïsoleerde proef wordt niets geregistreerd of verzonden.
        </p>
        <button type="button" onClick={()=>setActie(null)}
          className="mt-2 rounded-md border border-border px-3 py-2 text-xs">Sluiten</button>
      </div>}
    </section>
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4 shrink-0"/>
      Het voorbeeld gebruikt geen Supabase-client, geen echte relaties en geen bestaande pipeline.
    </div>
  </div>;
}
