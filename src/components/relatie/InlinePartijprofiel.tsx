import { useEffect, useState } from 'react';
import type { Partijprofiel, Relatie, VastgoedStrategie } from '@/data/mock-data';
import PartijprofielVelden from '@/components/forms/PartijprofielVelden';
import { labelPartijprofiel, labelVastgoedStrategie } from '@/lib/relaties/partijprofiel';
import { labelCommercieleRol } from '@/lib/relaties/commercieleRollen';

/**
 * Relatiegegevens worden op dezelfde profielpagina gewijzigd; er wordt uitsluitend
 * een kleine patch opgeslagen, nooit een volledige verouderde relatie-snapshot.
 */
export default function InlinePartijprofiel({
  relatie, onSave,
}: {
  relatie: Relatie;
  onSave: (wijziging: Partial<Relatie>) => Promise<void>;
}) {
  const [bewerken, setBewerken] = useState(false);
  const [partijprofiel, setPartijprofiel] = useState<Partijprofiel|null>(relatie.partijprofiel??null);
  const [strategieen, setStrategieen] = useState<VastgoedStrategie[]|null>(relatie.vastgoedStrategieen??null);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState<string|null>(null);

  useEffect(()=>{
    setBewerken(false);
    setPartijprofiel(relatie.partijprofiel??null);
    setStrategieen(relatie.vastgoedStrategieen??null);
    setFout(null);
  },[relatie.id]);

  const herstel = () => {
    if(opslaan) return;
    setPartijprofiel(relatie.partijprofiel??null);
    setStrategieen(relatie.vastgoedStrategieen??null);
    setFout(null);
    setBewerken(false);
  };
  const bewaar = async () => {
    if(opslaan) return;
    const oudProfiel=relatie.partijprofiel??null;
    const oudStrategieen=relatie.vastgoedStrategieen??null;
    const gelijk=(a:readonly string[]|null,b:readonly string[]|null)=>
      JSON.stringify([...(a??[])].sort())===JSON.stringify([...(b??[])].sort());
    const wijziging:Partial<Relatie>={};
    if(partijprofiel!==oudProfiel) wijziging.partijprofiel=partijprofiel;
    if(!gelijk(strategieen,oudStrategieen)) wijziging.vastgoedStrategieen=strategieen;
    if(Object.keys(wijziging).length===0){setBewerken(false);return;}
    setOpslaan(true);setFout(null);
    try {
      await onSave(wijziging);
      setBewerken(false);
    } catch(err) {
      setFout(err instanceof Error?err.message:'Opslaan mislukt');
    } finally {
      setOpslaan(false);
    }
  };
  return <section className="section-card p-5 sm:p-6 space-y-4" aria-label="Partijprofiel en strategieën" data-testid="inline-partijprofiel">
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">Partijprofiel en strategieën</h2>
      {!bewerken && <button type="button" className="text-sm text-accent hover:text-accent/80"
        onClick={()=>setBewerken(true)}>Wijzig hier</button>}
    </div>
    {bewerken ? <>
      <PartijprofielVelden partijprofiel={partijprofiel}
        vastgoedStrategieen={strategieen}
        onProfielChange={setPartijprofiel} onStrategieenChange={setStrategieen}/>
      {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
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
    {relatie.commercialRoles && relatie.commercialRoles.length>0 && <div>
      <p className="field-label">Bestaande commerciële rollen</p>
      <p className="field-value mt-1.5">{relatie.commercialRoles.map(labelCommercieleRol).join(', ')}</p>
    </div>}
  </section>;
}
