import { useEffect, useState } from 'react';
import type { Relatie } from '@/data/mock-data';
import { labelCommercieleRol } from '@/lib/relaties/commercieleRollen';
import {
  TRANSACTIEACTIVITEITEN, wijzigbareActiviteiten, voegActiviteitenSamen,
  gelijkeRollen, magAanvullendeActiviteit, type Transactieactiviteit,
} from '@/lib/relaties/transactieactiviteiten';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';

/** A15.4 — één bestaande opslagbron, alleen een gerichte rollenpatch. */
export default function InlineTransactierollen({
  relatie, onSave,
}:{
  relatie:Relatie;
  onSave:(wijziging:Partial<Relatie>)=>Promise<void>;
}){
  const [bewerken,setBewerken]=useState(false);
  const [rollen,setRollen]=useState<Transactieactiviteit[]>(()=>wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel));
  const [basis,setBasis]=useState<Relatie['commercialRoles']>(relatie.commercialRoles);
  const [basisProfiel,setBasisProfiel]=useState(relatie.partijprofiel??null);
  const [opslaan,setOpslaan]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const dirty=!gelijkeRollen(rollen,wijzigbareActiviteiten(basis,basisProfiel));
  const {confirmDiscard}=useDirtyGuard(bewerken&&dirty);
  const bronRollen=JSON.stringify(relatie.commercialRoles??null);

  useEffect(()=>{
    setBewerken(false);
    setRollen(wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel));
    setBasis(relatie.commercialRoles);
    setBasisProfiel(relatie.partijprofiel??null);
    setFout(null);
  },[relatie.id]);
  useEffect(()=>{
    if(!bewerken){
      setRollen(wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel));
      setBasis(relatie.commercialRoles);
      setBasisProfiel(relatie.partijprofiel??null);
    }
  },[bewerken,bronRollen,relatie.partijprofiel]);

  const begin=()=>{
    setBasis(relatie.commercialRoles);
    setBasisProfiel(relatie.partijprofiel??null);
    setRollen(wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel));
    setFout(null);
    setBewerken(true);
  };
  const annuleer=()=>{
    if(opslaan||!confirmDiscard())return;
    setBewerken(false);
    setFout(null);
    setRollen(wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel));
  };
  const bewaar=async()=>{
    if(opslaan)return;
    if(!dirty){setBewerken(false);return;}
    if(JSON.stringify(relatie.commercialRoles??null)!==JSON.stringify(basis??null)
      ||(relatie.partijprofiel??null)!==basisProfiel){
      setFout('Deze rollen zijn elders gewijzigd. Annuleer en open de actuele gegevens opnieuw.');
      return;
    }
    setOpslaan(true);setFout(null);
    try{
      await onSave({commercialRoles:voegActiviteitenSamen(basis,rollen,basisProfiel)});
      setBewerken(false);
    }catch(err){
      setFout(err instanceof Error?err.message:'Opslaan mislukt');
    }finally{
      setOpslaan(false);
    }
  };

  const zichtbaar=TRANSACTIEACTIVITEITEN.filter(item=>
    magAanvullendeActiviteit(item.value,relatie.partijprofiel));
  const gekozen=wijzigbareActiviteiten(relatie.commercialRoles,relatie.partijprofiel);
  const historisch=(relatie.commercialRoles??[])
    .filter(x=>!magAanvullendeActiviteit(x,relatie.partijprofiel)
      // Een hoofdprofiel hoeft niet als historische dubbele rol terug te komen.
      &&x!==relatie.partijprofiel);
  return <section className="section-card p-5 sm:p-6 space-y-3" aria-label="Activiteiten en transactierollen">
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">Activiteiten en transactierollen</h2>
      {!bewerken&&<button type="button" onClick={begin}
        className="text-sm text-accent hover:text-accent/80">Wijzig activiteiten</button>}
    </div>
    <p className="text-xs text-muted-foreground">
      Meerdere aanvullende activiteiten zijn mogelijk. Bijvoorbeeld een bemiddelaar
      die ook vastgoed ontwikkelt. Het hoofdprofiel vul je maar één keer in.
      Activiteiten bevestigen geen aankoop, mandaat of economische koper.
    </p>
    {bewerken?<div className="space-y-3">
      <fieldset className="grid sm:grid-cols-2 gap-2">
        <legend className="text-sm font-medium mb-2">Activiteiten (meerdere mogelijk)</legend>
        {zichtbaar.map(item=><label key={item.value}
          className="flex gap-2 rounded-md border border-border p-3 text-sm cursor-pointer">
          <input type="checkbox" checked={rollen.includes(item.value)}
            onChange={e=>setRollen(v=>e.target.checked
              ?[...new Set([...v,item.value])]
              :v.filter(r=>r!==item.value))} />
          <span><span className="font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.toelichting}</span>
          </span>
        </label>)}
      </fieldset>
      {fout&&<p role="alert" className="text-sm text-destructive">{fout}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={annuleer} disabled={opslaan}
          className="rounded-md border border-border px-3 py-2 text-sm">Annuleren</button>
        <button type="button" onClick={bewaar} disabled={opslaan}
          className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {opslaan?'Opslaan…':'Opslaan'}
        </button>
      </div>
    </div>:<p className="field-value">
      {gekozen.length
        ?zichtbaar
          .filter(x=>gekozen.includes(x.value))
          .map(x=>x.label).join(' · ')
        :'Nog geen transactierollen vastgesteld'}
    </p>}
    {historisch.length>0&&<div className="border-t border-border/70 pt-3">
      <p className="field-label">Historische rolindicaties (alleen lezen)</p>
      <p className="text-sm mt-1">{historisch.map(labelCommercieleRol).join(' · ')}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Oude waarden blijven behouden totdat de matchingcontrole is afgerond.
        Ontwikkelen kun je alleen als aanvullende activiteit selecteren wanneer dit
        nog niet in het hoofdprofiel is vastgelegd.
      </p>
    </div>}
  </section>;
}
