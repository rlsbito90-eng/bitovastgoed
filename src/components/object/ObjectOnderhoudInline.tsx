import {useEffect,useRef,useState} from 'react';
import {Pencil} from 'lucide-react';
import {toast} from 'sonner';
import {
  ONDERHOUDSSTAAT_LABELS,
  type ObjectVastgoed,type OnderhoudsstaatNiveau,
} from '@/data/mock-data';

type OnderhoudTekstVeld='recenteInvesteringen'|'achterstalligOnderhoud'|'technischeStaatOmschrijving';
type Props={
  object:ObjectVastgoed;
  onSave:(patch:Partial<ObjectVastgoed>)=>Promise<void>;
};
const labels:Record<OnderhoudTekstVeld,string>={
  recenteInvesteringen:'Recente investeringen',
  achterstalligOnderhoud:'Achterstallig onderhoud',
  technischeStaatOmschrijving:'Technische staat / MJOP',
};
function InlineOnderhoudNotitie({
  veld,waarde,onSave,
}:{
  veld:OnderhoudTekstVeld;waarde:string|undefined;onSave:Props['onSave'];
}){
  const [edit,setEdit]=useState(false);
  const [concept,setConcept]=useState(waarde??'');
  const latest=useRef(waarde??'');
  const inFlight=useRef(false);
  const cancelled=useRef(false);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(edit)return;
    latest.current=waarde??'';
    setConcept(waarde??'');
  },[waarde,edit]);

  function cancel(){
    cancelled.current=true;
    setEdit(false);
    latest.current=waarde??'';
    setConcept(waarde??'');
  }
  async function save(){
    if(!edit||inFlight.current||cancelled.current)return;
    const next=latest.current.trim();
    const previous=waarde??'';
    if(next===previous.trim()){setEdit(false);return;}
    inFlight.current=true;setSaving(true);setEdit(false);
    try{
      await onSave({[veld]:next} as Partial<ObjectVastgoed>);
      toast.success(`${labels[veld]} opgeslagen`,{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave({[veld]:previous} as Partial<ObjectVastgoed>)
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      setEdit(true);
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{inFlight.current=false;setSaving(false);}
  }
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <span className="field-label">{labels[veld]}</span>
      {!edit&&<button type="button" disabled={saving}
        aria-label={`Wijzig ${labels[veld]}`}
        onClick={()=>{cancelled.current=false;setEdit(true);}}
        className="inline-flex gap-1 items-center text-xs text-accent hover:underline disabled:opacity-50">
        <Pencil className="h-3.5 w-3.5"/> Wijzigen
      </button>}
    </div>
    {edit?<textarea
      autoFocus aria-label={labels[veld]} rows={3}
      value={concept}
      onChange={e=>{setConcept(e.target.value);latest.current=e.target.value;}}
      onBlur={()=>{void save();}}
      onKeyDown={e=>{
        if(e.key==='Escape'){e.preventDefault();cancel();}
        if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void save();}
      }}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"/>:
      <p className="text-sm whitespace-pre-wrap break-words">
        {waarde?.trim()||<span className="text-muted-foreground">Niet vastgelegd</span>}
        {saving&&<span className="text-xs text-muted-foreground ml-2">Opslaan…</span>}
      </p>}
  </div>;
}

export default function ObjectOnderhoudInline({object,onSave}:Props){
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const current=object.onderhoudsstaatNiveau;
  async function setLevel(next:string){
    if(saving||next===(current??''))return;
    setSaving(true);
    const vorig=current??null;
    try{
      await onSave({onderhoudsstaatNiveau:(next||null) as OnderhoudsstaatNiveau});
      setSaved(true);
      toast.success('Onderhoudsstaat opgeslagen',{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave({onderhoudsstaatNiveau:vorig as OnderhoudsstaatNiveau})
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      toast.error(e instanceof Error?e.message:'Onderhoudsstaat opslaan mislukt');
    }finally{setSaving(false);}
  }
  return <section className="space-y-4 border-t border-border/60 pt-4"
    data-testid="object-onderhoud-inline">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <h3 className="section-title">Onderhoud en technische staat</h3>
      {saved&&!saving&&<span className="text-xs text-muted-foreground">Opgeslagen</span>}
    </div>
    <div className="space-y-1.5">
      <label htmlFor="inline-onderhoudsstaat" className="field-label">Onderhoudsstaat</label>
      <select id="inline-onderhoudsstaat" value={current??''} disabled={saving}
        onChange={e=>{void setLevel(e.target.value);}}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">— Nog niet beoordeeld —</option>
        {(Object.entries(ONDERHOUDSSTAAT_LABELS) as Array<[OnderhoudsstaatNiveau,string]>)
          .map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
      {!current&&object.onderhoudsstaat?.trim()&&
        <p className="text-xs text-muted-foreground">
          Eerder vastgelegd: {object.onderhoudsstaat}. Dit blijft bewaard.
        </p>}
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      <InlineOnderhoudNotitie key={`${object.id}-investeringen`}
        veld="recenteInvesteringen" waarde={object.recenteInvesteringen} onSave={onSave}/>
      <InlineOnderhoudNotitie key={`${object.id}-achterstallig`}
        veld="achterstalligOnderhoud" waarde={object.achterstalligOnderhoud} onSave={onSave}/>
      <div className="sm:col-span-2">
        <InlineOnderhoudNotitie key={`${object.id}-technisch`}
          veld="technischeStaatOmschrijving"
          waarde={object.technischeStaatOmschrijving} onSave={onSave}/>
      </div>
    </div>
  </section>;
}
