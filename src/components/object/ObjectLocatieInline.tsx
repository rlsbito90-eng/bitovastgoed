import {useEffect,useState} from 'react';
import {Pencil,Check,AlertTriangle} from 'lucide-react';
import {toast} from 'sonner';
import {PROVINCIES,type ObjectVastgoed} from '@/data/mock-data';
import type {GuardedObjectPatch} from '@/lib/dataIntegrity/objectPayload';
import {locatieInvoerVanObject,maakLocatiePatch,type LocatieInvoer} from '@/lib/objecten/inlineLocatie';

type Props={
  object:ObjectVastgoed;
  onSave:(patch:GuardedObjectPatch)=>Promise<void>;
};

const labels:Record<keyof LocatieInvoer,string>={
  adres:'Adres',postcode:'Postcode',plaats:'Plaats',
  provincie:'Provincie',publiekeRegio:'Publieke regio',
};

export default function ObjectLocatieInline({object,onSave}:Props){
  const [edit,setEdit]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [concept,setConcept]=useState<LocatieInvoer>(()=>locatieInvoerVanObject(object));

  useEffect(()=>{
    if(!edit)setConcept(locatieInvoerVanObject(object));
  },[object.id,object.adres,object.postcode,object.plaats,object.provincie,object.publiekeRegio,edit]);

  function cancel(){setEdit(false);setConcept(locatieInvoerVanObject(object));}
  async function save(){
    if(saving)return;
    let patch:GuardedObjectPatch;
    try{patch=maakLocatiePatch(object,concept);}
    catch(e){toast.error(e instanceof Error?e.message:'Adresgegevens ongeldig');return;}
    if(Object.keys(patch).length===0){setEdit(false);return;}
    setSaving(true);
    try{
      await onSave(patch);
      setSaved(true);
      setEdit(false);
      const opnieuwVerifiëren='geoLat' in patch||'geoLon' in patch;
      toast.success(opnieuwVerifiëren
        ?'Locatie opgeslagen. Oude BAG-verificatie vervallen; controleer het adres opnieuw.'
        :'Locatiegegevens opgeslagen');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setSaving(false);}
  }
  function veld<K extends keyof LocatieInvoer>(key:K,value:LocatieInvoer[K]){
    setConcept(prev=>({...prev,[key]:value}));
  }
  return <div className="space-y-3" data-testid="object-locatie-inline">
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="section-title">Locatie</h3>
        {saved&&!saving&&<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5"/> Opgeslagen
        </span>}
      </div>
      {!edit&&<button type="button" onClick={()=>{setConcept(locatieInvoerVanObject(object));setEdit(true);}}
        className="inline-flex gap-1 items-center text-xs text-accent hover:underline">
        <Pencil className="h-3.5 w-3.5"/> Wijzigen
      </button>}
    </div>
    {edit?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void save();}}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['adres','postcode','plaats'] as const).map(key=>
          <label key={key} className="space-y-1">
            <span className="field-label">{labels[key]}</span>
            <input type="text" value={concept[key]} disabled={saving}
              onChange={e=>veld(key,e.target.value)}
              aria-label={labels[key]}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/>
          </label>)}
        <label className="space-y-1">
          <span className="field-label">Provincie</span>
          <select aria-label="Provincie" value={concept.provincie} disabled={saving}
            onChange={e=>veld('provincie',e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— Niet opgegeven —</option>
            {concept.provincie&&!PROVINCIES.includes(concept.provincie)&&
              <option value={concept.provincie}>{concept.provincie} (bestaand)</option>}
            {PROVINCIES.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="field-label">Publieke regio (anonieme presentatie)</span>
          <input type="text" value={concept.publiekeRegio} disabled={saving}
            onChange={e=>veld('publiekeRegio',e.target.value)}
            aria-label="Publieke regio"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/>
        </label>
      </div>
      {(object.geoLat!=null||object.geoLon!=null)&&
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5"/>
          Bij een adreswijziging wordt de eerdere locatieverificatie ongeldig.
          Verifieer het nieuwe adres daarna opnieuw via BAG/PDOK.
        </p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={cancel}
          className="px-3 py-2 rounded-md border border-border text-sm hover:bg-muted/40">
          Annuleren
        </button>
        <button type="submit" disabled={saving}
          className="px-3 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
          {saving?'Opslaan…':'Opslaan'}
        </button>
      </div>
    </form>:<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
      {(['adres','postcode','plaats','provincie','publiekeRegio'] as const)
        .filter(key=>!!object[key]?.trim())
        .map(key=><div key={key}>
          <p className="field-label">{labels[key]}</p>
          <p className="field-value mt-1.5">{object[key]}</p>
        </div>)}
      {!object.adres&&!object.plaats&&!object.postcode&&
        <p className="text-sm text-muted-foreground">Nog geen volledig adres vastgelegd.</p>}
    </div>}
  </div>;
}
