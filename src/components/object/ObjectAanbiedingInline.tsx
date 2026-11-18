import {useState} from 'react';
import {toast} from 'sonner';
import {
  AANBIEDINGSWIJZE_LABELS,type Aanbiedingswijze,type ObjectVastgoed,
} from '@/data/mock-data';

const keuzes=Object.entries(AANBIEDINGSWIJZE_LABELS) as Array<[Aanbiedingswijze,string]>;

export default function ObjectAanbiedingInline({
  object,onSave,
}:{
  object:ObjectVastgoed;
  onSave:(patch:Partial<ObjectVastgoed>)=>Promise<void>;
}){
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  async function wijzig(value:Aanbiedingswijze){
    if(saving||value===object.aanbiedingswijze)return;
    setSaving(true);
    const previous=object.aanbiedingswijze;
    try{
      await onSave({aanbiedingswijze:value});
      setSaved(true);
      toast.success('Aanbiedingswijze opgeslagen',{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave({aanbiedingswijze:previous})
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      toast.error(e instanceof Error?e.message:'Aanbiedingswijze opslaan mislukt');
    }finally{setSaving(false);}
  }
  return <div className="space-y-1.5" data-testid="object-aanbieding-inline">
    <label htmlFor="inline-aanbiedingswijze" className="field-label">Aanbiedingswijze</label>
    <select id="inline-aanbiedingswijze" aria-label="Aanbiedingswijze"
      disabled={saving} value={object.aanbiedingswijze??''}
      onChange={e=>void wijzig(e.target.value as Aanbiedingswijze)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
      {!object.aanbiedingswijze&&<option value="">— Niet opgegeven —</option>}
      {keuzes.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
    {saving?<p className="text-xs text-muted-foreground">Opslaan…</p>:
      saved?<p className="text-xs text-muted-foreground">Opgeslagen</p>:null}
  </div>;
}
