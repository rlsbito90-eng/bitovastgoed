import { useEffect, useState } from 'react';
import type { Relatie } from '@/data/mock-data';
import { ASSET_CLASS_LABELS } from '@/data/mock-data';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';
import { ClassificatieRij } from '@/components/TaxonomieBadges';

type Sleutel='propertyTypeIds'|'propertySubtypeIds'|'dealTypeIds';
type Patch=Pick<Relatie,Sleutel>;
type Props={relatie:Relatie; onSave:(patch:Partial<Relatie>)=>Promise<void>};
const norm=(v:readonly string[]|undefined)=>[...(v??[])].sort();
const gelijk=(a:readonly string[]|undefined,b:readonly string[]|undefined)=>
  JSON.stringify(norm(a))===JSON.stringify(norm(b));

export default function InlineVastgoedVoorkeuren({relatie,onSave}:Props){
  const tax=usePropertyTaxonomie();
  const [editing,setEditing]=useState(false);
  const [base,setBase]=useState<Patch>({});
  const [values,setValues]=useState<Patch>({});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const wijziging:Partial<Relatie>={};
  for(const key of ['propertyTypeIds','propertySubtypeIds','dealTypeIds'] as const){
    if(!gelijk(values[key],base[key])) wijziging[key]=values[key]??[];
  }
  const { confirmDiscard }=useDirtyGuard(editing&&Object.keys(wijziging).length>0);
  useEffect(()=>{setEditing(false);setError(null);setValues({});setBase({});},[relatie.id]);
  const start=()=>{
    const init:Patch={
      propertyTypeIds:[...(relatie.propertyTypeIds??[])],
      propertySubtypeIds:[...(relatie.propertySubtypeIds??[])],
      dealTypeIds:[...(relatie.dealTypeIds??[])],
    };
    setBase(init);setValues(init);setError(null);setEditing(true);
  };
  const cancel=()=>{
    if(saving||!confirmDiscard())return;
    setEditing(false);setError(null);
  };
  const toggle=(key:Sleutel,id:string,checked:boolean)=>{
    setValues(prev=>{
      const values=prev[key]??[];
      return {...prev,[key]:checked?[...new Set([...values,id])]:values.filter(v=>v!==id)};
    });
    setError(null);
  };
  const save=async()=>{
    if(saving)return;
    const chosen=values.propertyTypeIds??[];
    const children=values.propertySubtypeIds??[];
    const knownOrphans=children.filter(id=>{
      const subtype=tax.propertySubtypeById(id);
      return subtype && !chosen.includes(subtype.propertyTypeId);
    });
    // Bestaande historische/inconsistente data niet stilzwijgend aanpassen:
    // controle alleen verplicht bij wijziging van typen of subtypen.
    const changedTypes=!gelijk(values.propertyTypeIds,base.propertyTypeIds);
    const changedSubs=!gelijk(values.propertySubtypeIds,base.propertySubtypeIds);
    if((changedTypes||changedSubs)&&knownOrphans.length){
      setError('Er zijn geselecteerde subtypen waarvan het hoofdtype niet is geselecteerd. Selecteer het hoofdtype of verwijder het subtype bewust.');
      return;
    }
    for(const key of Object.keys(wijziging) as Sleutel[]){
      if(!gelijk(relatie[key],base[key])){
        setError('Deze vastgoedvoorkeur is elders gewijzigd. Annuleer en heropen de sectie om de nieuwste gegevens te laden.');
        return;
      }
    }
    if(!Object.keys(wijziging).length){setEditing(false);return;}
    setSaving(true);setError(null);
    try{await onSave(wijziging);setEditing(false);}
    catch(err){setError(err instanceof Error?err.message:'Opslaan is mislukt');}
    finally{setSaving(false);}
  };
  const types=[
    ...tax.propertyTypes.map(t=>({id:t.id,label:t.name})),
    ...(values.propertyTypeIds??[]).filter(id=>!tax.propertyTypeById(id)).map(id=>({id,label:`Historisch type (${id})`}))
  ];
  const subtypes=[
    ...tax.propertySubtypes.filter(t=>
      (values.propertyTypeIds??[]).includes(t.propertyTypeId) ||
      (values.propertySubtypeIds??[]).includes(t.id)
    ).map(s=>({id:s.id,label:s.name})),
    ...(values.propertySubtypeIds??[]).filter(id=>!tax.propertySubtypeById(id))
      .map(id=>({id,label:`Historisch subtype (${id})`}))
  ];
  const deals=[
    ...tax.dealTypes.map(d=>({id:d.id,label:d.name})),
    ...(values.dealTypeIds??[]).filter(id=>!tax.dealTypeById(id))
      .map(id=>({id,label:`Historisch dealtype (${id})`}))
  ];
  return <section className="section-card p-5 sm:p-6 space-y-4" aria-label="Vastgoedvoorkeuren">
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">Vastgoedvoorkeuren</h2>
      {!editing&&<button type="button" onClick={start}
        className="text-sm text-accent hover:text-accent/80">Wijzig hier</button>}
    </div>
    <ClassificatieRij propertyTypeIds={relatie.propertyTypeIds}
      fallbackAssetClasses={relatie.assetClasses}
      subtypeIds={relatie.propertySubtypeIds} dealTypeIds={relatie.dealTypeIds} mode="multi"/>
    {relatie.assetClasses?.length>0&&<p className="text-xs text-muted-foreground">
      Historische vastgoedklassen: {relatie.assetClasses.map(x=>ASSET_CLASS_LABELS[x]||x).join(', ')}
    </p>}
    <p className="text-xs text-muted-foreground">
      Dit zijn de bestaande algemene voorkeuren voor oudere matching. Concrete zoekrichtingen leg je vast bij Zoekprofielen.
      Er worden geen gegevens automatisch gekopieerd of verwijderd.
    </p>
    {editing&&<div className="space-y-4">
      {([
        {key:'propertyTypeIds' as const,label:'Vastgoedtypen',options:types},
        {key:'propertySubtypeIds' as const,label:'Subtypen',options:subtypes},
        {key:'dealTypeIds' as const,label:'Dealtypen',options:deals},
      ]).map(group=><fieldset key={group.key} className="space-y-2">
        <legend className="field-label">{group.label}</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {group.options.map(opt=><label key={opt.id} className="inline-flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input type="checkbox" checked={(values[group.key]??[]).includes(opt.id)}
              onChange={e=>toggle(group.key,opt.id,e.target.checked)} />
            <span className="break-words">{opt.label}</span>
          </label>)}
          {!group.options.length&&<p className="text-xs text-muted-foreground">Nog geen opties in taxonomie.</p>}
        </div>
      </fieldset>)}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={cancel}
          className="rounded-md border border-border px-3 py-2 text-sm">Annuleren</button>
        <button type="button" disabled={saving} onClick={save}
          className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">{saving?'Opslaan…':'Opslaan'}</button>
      </div>
    </div>}
  </section>;
}
