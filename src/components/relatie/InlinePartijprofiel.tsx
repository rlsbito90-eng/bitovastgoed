import { useEffect, useState } from 'react';
import type { Partijprofiel, Relatie, VastgoedStrategie } from '@/data/mock-data';
import PartijprofielVelden from '@/components/forms/PartijprofielVelden';
import { labelPartijprofiel, labelVastgoedStrategie } from '@/lib/relaties/partijprofiel';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';

/** Inline, isolated PATCH. Existing roles, types, budgets and search profiles are never rewritten. */
export default function InlinePartijprofiel({
  relatie, onSave,
}: {
  relatie: Relatie;
  onSave: (wijziging: Partial<Relatie>) => Promise<void>;
}) {
  const [bewerken, setBewerken] = useState(false);
  const [partijprofiel, setPartijprofiel] = useState<Partijprofiel|null>(relatie.partijprofiel??null);
  const [strategieen, setStrategieen] = useState<VastgoedStrategie[]|null>(relatie.vastgoedStrategieen??null);
  const [basisProfiel, setBasisProfiel] = useState<Partijprofiel|null>(relatie.partijprofiel??null);
  const [basisStrategieen, setBasisStrategieen] = useState<VastgoedStrategie[]|null>(relatie.vastgoedStrategieen??null);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState<string|null>(null);

  const gelijk = (a:readonly string[]|null,b:readonly string[]|null) =>
    JSON.stringify([...(a??[])].sort())===JSON.stringify([...(b??[])].sort());
  const profielGewijzigd=partijprofiel!==basisProfiel;
  const strategieGewijzigd=!gelijk(strategieen,basisStrategieen);
  const { confirmDiscard }=useDirtyGuard(bewerken&&(profielGewijzigd||strategieGewijzigd));

  useEffect(()=>{
    setBewerken(false);
    setPartijprofiel(relatie.partijprofiel??null);
    setStrategieen(relatie.vastgoedStrategieen??null);
    setBasisProfiel(relatie.partijprofiel??null);
    setBasisStrategieen(relatie.vastgoedStrategieen??null);
    setFout(null);
  },[relatie.id]);

  // Na wijziging door een andere sectie blijven gesloten velden actueel.
  const huidigeStrategieen=JSON.stringify(relatie.vastgoedStrategieen??null);
  useEffect(()=>{
    if(!bewerken){
      setPartijprofiel(relatie.partijprofiel??null);
      setStrategieen(relatie.vastgoedStrategieen??null);
      setBasisProfiel(relatie.partijprofiel??null);
      setBasisStrategieen(relatie.vastgoedStrategieen??null);
    }
  },[bewerken,relatie.partijprofiel,huidigeStrategieen]);

  const begin=()=>{
    setBasisProfiel(relatie.partijprofiel??null);
    setBasisStrategieen([...(relatie.vastgoedStrategieen??[])]);
    setPartijprofiel(relatie.partijprofiel??null);
    setStrategieen(relatie.vastgoedStrategieen??null);
    setFout(null);
    setBewerken(true);
  };
  const herstel=()=>{
    if(opslaan||!confirmDiscard())return;
    setPartijprofiel(relatie.partijprofiel??null);
    setStrategieen(relatie.vastgoedStrategieen??null);
    setFout(null);
    setBewerken(false);
  };
  const bewaar=async()=>{
    if(opslaan)return;
    const wijziging:Partial<Relatie>={};
    if(profielGewijzigd)wijziging.partijprofiel=partijprofiel;
    if(strategieGewijzigd)wijziging.vastgoedStrategieen=strategieen;
    if(!Object.keys(wijziging).length){setBewerken(false);return;}
    // Controleer alleen de velden die de gebruiker hier daadwerkelijk wijzigt.
    if((profielGewijzigd&&(relatie.partijprofiel??null)!==basisProfiel)||
      (strategieGewijzigd&&!gelijk(relatie.vastgoedStrategieen??null,basisStrategieen))){
      setFout('Dit profiel is elders gewijzigd. Annuleer en open opnieuw om de actuele gegevens te zien.');
      return;
    }
    setOpslaan(true);setFout(null);
    try{
      await onSave(wijziging);
      setBewerken(false);
    }catch(err){
      setFout(err instanceof Error?err.message:'Opslaan mislukt');
    }finally{
      setOpslaan(false);
    }
  };
  return <section className="section-card p-5 sm:p-6 space-y-4"
    aria-label="Partijprofiel en strategieën" data-testid="inline-partijprofiel">
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">Partijprofiel en strategieën</h2>
      {!bewerken&&<button type="button" className="text-sm text-accent hover:text-accent/80"
        onClick={begin}>Wijzig hier</button>}
    </div>
    {bewerken ? <>
      <PartijprofielVelden partijprofiel={partijprofiel}
        vastgoedStrategieen={strategieen}
        onProfielChange={setPartijprofiel} onStrategieenChange={setStrategieen}/>
      {fout&&<p role="alert" className="text-sm text-destructive">{fout}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={opslaan} onClick={herstel}
          className="rounded-md border border-border px-3 py-2 text-sm">Annuleren</button>
        <button type="button" disabled={opslaan} onClick={bewaar}
          className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {opslaan?'Opslaan…':'Opslaan'}
        </button>
      </div>
    </> : <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <p className="field-label">Partijprofiel</p>
        <p className="field-value mt-1.5">{relatie.partijprofiel
          ? labelPartijprofiel(relatie.partijprofiel):'Nog niet vastgesteld'}</p>
      </div>
      <div>
        <p className="field-label">Vastgoedstrategieën</p>
        <p className="field-value mt-1.5">{relatie.vastgoedStrategieen?.length
          ? relatie.vastgoedStrategieen.map(labelVastgoedStrategie).join(', ')
          : 'Nog niet vastgesteld'}</p>
      </div>
    </div>}

  </section>;
}
