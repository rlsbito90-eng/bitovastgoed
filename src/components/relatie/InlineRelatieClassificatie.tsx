import {useEffect,useState} from 'react';
import type {Partijprofiel,Relatie,VastgoedStrategie} from '@/data/mock-data';
import PartijprofielVelden from '@/components/forms/PartijprofielVelden';
import {labelPartijprofiel,labelVastgoedStrategie} from '@/lib/relaties/partijprofiel';
import {labelCommercieleRol} from '@/lib/relaties/commercieleRollen';
import {
  TRANSACTIEACTIVITEITEN,magAanvullendeActiviteit,wijzigbareActiviteiten,
  voegActiviteitenSamen,gelijkeRollen,type Transactieactiviteit,
} from '@/lib/relaties/transactieactiviteiten';
import {useDirtyGuard} from '@/hooks/useDirtyGuard';

type Begin={
  profiel:Partijprofiel|null;
  strategieen:VastgoedStrategie[]|null;
  rollen:Relatie['commercialRoles'];
};
const snapshot=(r:Relatie):Begin=>({
  profiel:r.partijprofiel??null,
  strategieen:r.vastgoedStrategieen??null,
  rollen:r.commercialRoles??null,
});
const gelijk=(a:readonly string[]|null|undefined,b:readonly string[]|null|undefined)=>
  gelijkeRollen(a,b);

/**
 * A15.10: één invoerplek en één relatie-PATCH voor hoofdprofiel,
 * vastgoedstrategieën en aanvullende activiteiten. Legacy type_partij,
 * zoekprofielen, contactmomenten en pipeline worden nooit aangeraakt.
 */
export default function InlineRelatieClassificatie({relatie,onSave}:{
  relatie:Relatie;
  onSave:(wijziging:Partial<Relatie>)=>Promise<void>;
}){
  const [bewerken,setBewerken]=useState(false);
  const [basis,setBasis]=useState<Begin>(()=>snapshot(relatie));
  const [profiel,setProfiel]=useState<Partijprofiel|null>(relatie.partijprofiel??null);
  const [strategieen,setStrategieen]=useState<VastgoedStrategie[]|null>(relatie.vastgoedStrategieen??null);
  const [activiteiten,setActiviteiten]=useState<Transactieactiviteit[]>(()=>
    wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel));
  const [opslaan,setOpslaan]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const rollenBron=JSON.stringify(relatie.commercialRoles??null);
  const strategieBron=JSON.stringify(relatie.vastgoedStrategieen??null);

  const gewijzigdeProfiel=profiel!==basis.profiel;
  const gewijzigdeStrategieen=!gelijk(strategieen,basis.strategieen);
  const gewijzigdeActiviteiten=!gelijk(activiteiten,wijzigbareActiviteiten(basis.rollen,basis.profiel));
  const dirty=gewijzigdeProfiel||gewijzigdeStrategieen||gewijzigdeActiviteiten;
  const {confirmDiscard}=useDirtyGuard(bewerken&&dirty);

  const vul=(r:Relatie)=>{
    setBasis(snapshot(r));
    setProfiel(r.partijprofiel??null);
    setStrategieen(r.vastgoedStrategieen??null);
    setActiviteiten(wijzigbareActiviteiten(r.commercialRoles,r.partijprofiel));
    setFout(null);
  };
  useEffect(()=>{
    setBewerken(false);
    vul(relatie);
  },[relatie.id]);
  useEffect(()=>{
    if(!bewerken)vul(relatie);
  },[bewerken,relatie.partijprofiel,rollenBron,strategieBron]);

  const begin=()=>{vul(relatie);setBewerken(true);};
  const annuleer=()=>{
    if(opslaan||!confirmDiscard())return;
    setBewerken(false);vul(relatie);
  };
  const bewaar=async()=>{
    if(opslaan)return;
    if(!dirty){setBewerken(false);return;}
    // Optimistic check against all source fields used by the combined edit.
    // A different save must not silently rewrite other classification input.
    if((relatie.partijprofiel??null)!==basis.profiel
      ||!gelijk(relatie.vastgoedStrategieen??null,basis.strategieen)
      ||!gelijk(relatie.commercialRoles??null,basis.rollen)){
      setFout('De classificatie is elders gewijzigd. Annuleer en open de actuele gegevens opnieuw.');
      return;
    }
    const wijziging:Partial<Relatie>={};
    if(gewijzigdeProfiel)wijziging.partijprofiel=profiel;
    if(gewijzigdeStrategieen)wijziging.vastgoedStrategieen=strategieen;
    if(gewijzigdeActiviteiten){
      // Hidden roles survive a profile switch; never assume a historical
      // developer role is confirmed unless explicitly selected by the user.
      const aangepast=voegActiviteitenSamen(basis.rollen,activiteiten,profiel);
      if(!gelijk(aangepast,basis.rollen))wijziging.commercialRoles=aangepast;
    }
    if(!Object.keys(wijziging).length){setBewerken(false);return;}
    setOpslaan(true);setFout(null);
    try{
      await onSave(wijziging);
      setBewerken(false);
    }catch(error){
      setFout(error instanceof Error?error.message:'Opslaan mislukt');
    }finally{setOpslaan(false);}
  };
  const mogelijkeActiviteiten=TRANSACTIEACTIVITEITEN.filter(x=>magAanvullendeActiviteit(x.value,profiel));
  const actueleActiviteiten=wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel);
  const historischeRollen=(relatie.commercialRoles??[]).filter(x=>
    !magAanvullendeActiviteit(x,relatie.partijprofiel)
    &&x!==relatie.partijprofiel
    &&!(x==='ontwikkelaar'&&relatie.partijprofiel==='ontwikkelende_belegger'));

  return <section className="section-card p-5 sm:p-6 space-y-4"
    aria-label="Partijprofiel en aanvullende activiteiten" data-testid="inline-relatieclassificatie">
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">Partijprofiel, strategieën en activiteiten</h2>
      {!bewerken&&<button type="button" className="text-sm text-accent hover:text-accent/80"
        onClick={begin}>Wijzig classificatie</button>}
    </div>
    {bewerken ? <div className="space-y-4">
      <PartijprofielVelden partijprofiel={profiel}
        vastgoedStrategieen={strategieen}
        onProfielChange={setProfiel} onStrategieenChange={setStrategieen}/>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Aanvullende activiteiten (meerdere mogelijk)</legend>
        <p className="text-xs text-muted-foreground">
          Kies alleen wat daarnaast is bevestigd. Het hoofdprofiel wordt niet dubbel gevraagd.
          Een activiteit bewijst geen kopersmandaat, bod of economische koper.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {mogelijkeActiviteiten.map(item=><label key={item.value}
            className="flex gap-2 rounded-md border border-border p-3 text-sm cursor-pointer">
            <input type="checkbox" checked={activiteiten.includes(item.value)}
              onChange={e=>setActiviteiten(v=>e.target.checked
                ?[...new Set([...v,item.value])]
                :v.filter(x=>x!==item.value))}/>
            <span><span className="font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.toelichting}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      {(relatie.commercialRoles??[]).some(x=>!magAanvullendeActiviteit(x,profiel))
        &&<p className="text-xs text-muted-foreground">
          Oude of bij dit hoofdprofiel niet-selecteerbare rollen blijven bewaard.
          Ze worden niet stilzwijgend omgezet of verwijderd.
        </p>}
      {fout&&<p role="alert" className="text-sm text-destructive">{fout}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={opslaan} onClick={annuleer}
          className="rounded-md border border-border px-3 py-2 text-sm">Annuleren</button>
        <button type="button" disabled={opslaan} onClick={bewaar}
          className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {opslaan?'Opslaan…':'Opslaan'}
        </button>
      </div>
    </div> : <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div><p className="field-label">Partijprofiel</p>
          <p className="field-value mt-1.5">{relatie.partijprofiel
            ?labelPartijprofiel(relatie.partijprofiel):'Nog niet vastgesteld'}</p></div>
        <div><p className="field-label">Vastgoedstrategieën</p>
          <p className="field-value mt-1.5">{relatie.vastgoedStrategieen?.length
            ?relatie.vastgoedStrategieen.map(labelVastgoedStrategie).join(' · ')
            :'Nog niet vastgesteld'}</p></div>
      </div>
      <div className="border-t border-border/70 pt-3">
        <p className="field-label">Aanvullende activiteiten</p>
        <p className="field-value mt-1.5">{actueleActiviteiten.length
          ?TRANSACTIEACTIVITEITEN.filter(x=>actueleActiviteiten.includes(x.value))
            .map(x=>x.label).join(' · ')
          :'Nog niet vastgesteld'}</p>
      </div>
      {historischeRollen.length>0&&<div className="border-t border-border/70 pt-3">
        <p className="field-label">Historische rolindicaties (alleen lezen)</p>
        <p className="text-sm mt-1">{historischeRollen.map(labelCommercieleRol).join(' · ')}</p>
      </div>}
    </div>}
  </section>;
}
