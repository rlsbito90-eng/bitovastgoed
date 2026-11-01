import { useEffect, useState } from 'react';
import type { Relatie } from '@/data/mock-data';
import { labelCommercieleRol } from '@/lib/relaties/commercieleRollen';
import {
  TRANSACTIEACTIVITEITEN, wijzigbareActiviteiten, voegActiviteitenSamen,
  gelijkeRollen, type Transactieactiviteit,
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
  const [rollen,setRollen]=useState<Transactieactiviteit[]>(()=>wijzigbareActiviteiten(relatie.commercialRoles));
  const [basis,setBasis]=useState<Relatie['commercialRoles']>(relatie.commercialRoles);
  const [opslaan,setOpslaan]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const dirty=!gelijkeRollen(rollen,wijzigbareActiviteiten(basis));
  const {confirmDiscard}=useDirtyGuard(bewerken&&dirty);
  const bronRollen=JSON.stringify(relatie.commercialRoles??null);

  useEffect(()=>{
    setBewerken(false);
    setRollen(wijzigbareActiviteiten(relatie.commercialRoles));
    setBasis(relatie.commercialRoles);
    setFout(null);
  },[relatie.id]);
  useEffect(()=>{
    if(!bewerken){
      setRollen(wijzigbareActiviteiten(relatie.commercialRoles));
      setBasis(relatie.commercialRoles);
    }
  },[bewerken,bronRollen]);

  const begin=()=>{
    setBasis(relatie.commercialRoles);
    setRollen(wijzigbareActiviteiten(relatie.commercialRoles));
    setFout(null);
    setBewerken(true);
  };
  const annuleer=()=>{
    if(opslaan||!confirmDiscard())return;
    setBewerken(false);
    setFout(null);
    setRollen(wijzigbareActiviteiten(relatie.commercialRoles));
  };
  const bewaar=async()=>{
    if(opslaan)return;
    if(!dirty){setBewerken(false);return;}
    if(JSON.stringify(relatie.commercialRoles??null)!==JSON.stringify(basis??null)){
      setFout('Deze rollen zijn elders gewijzigd. Annuleer en open de actuele gegevens opnieuw.');
      return;
    }
    setOpslaan(true);setFout(null);
    try{
      await onSave({commercialRoles:voegActiviteitenSamen(basis,rollen)});
      setBewerken(false);
    }catch(err){
      setFout(err instanceof Error?err.message:'Opslaan mislukt');
    }finally{
      setOpslaan(false);
    }
  };

  const historisch=(relatie.commercialRoles??[])
    .filter(x=>!TRANSACTIEACTIVITEITEN.some(item=>item.value===x));
  return <section className="section-card p-5 sm:p-6 space-y-3" aria-label="Activiteiten en transactierollen">
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">Activiteiten en transactierollen</h2>
      {!bewerken&&<button type="button" onClick={begin}
        className="text-sm text-accent hover:text-accent/80">Wijzig activiteiten</button>}
    </div>
    <p className="text-xs text-muted-foreground">
      Meerdere activiteiten mogelijk. Deze beschrijven wat de relatie kan doen,
      niet het soort onderneming, het mandaat of een bevestigde aankoop.
      Partijprofiel leg je alleen vast in de sectie hierboven.
    </p>
    {bewerken?<div className="space-y-3">
      <fieldset className="grid sm:grid-cols-2 gap-2">
        <legend className="text-sm font-medium mb-2">Activiteiten (meerdere mogelijk)</legend>
        {TRANSACTIEACTIVITEITEN.map(item=><label key={item.value}
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
      {wijzigbareActiviteiten(relatie.commercialRoles).length
        ?TRANSACTIEACTIVITEITEN
          .filter(x=>wijzigbareActiviteiten(relatie.commercialRoles).includes(x.value))
          .map(x=>x.label).join(' · ')
        :'Nog geen transactierollen vastgesteld'}
    </p>}
    {historisch.length>0&&<div className="border-t border-border/70 pt-3">
      <p className="field-label">Historische rolindicaties (alleen lezen)</p>
      <p className="text-sm mt-1">{historisch.map(labelCommercieleRol).join(' · ')}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Deze oude gegevens blijven behouden totdat de matchingcontrole is afgerond.
        Ontwikkelaar of makelaar vul je voortaan niet opnieuw als activiteit in.
      </p>
    </div>}
  </section>;
}
