import { useEffect, useState } from 'react';
import type { Relatie } from '@/data/mock-data';
import { ASSET_CLASS_LABELS } from '@/data/mock-data';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';
import { ClassificatieRij } from '@/components/TaxonomieBadges';
import TaxonomieKeuzelijst from '@/components/taxonomie/TaxonomieKeuzelijst';

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
    {relatie.assetClasses?.length>0&&<details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground">Historische vastgoedklassen</summary>
      <p className="mt-2">{relatie.assetClasses.map(x=>ASSET_CLASS_LABELS[x]||x).join(', ')}</p>
    </details>}
    {editing&&<p className="text-xs text-muted-foreground">
      Dit zijn de algemene vastgoedvoorkeuren. Gebruik een aanvullend zoekprofiel voor een afwijkende zoekrichting.
    </p>}
    {editing&&<div className="space-y-3 border-t border-border/60 pt-4">
      {([
        {key:'propertyTypeIds' as const,label:'Vastgoedtypen',options:types,
          placeholder:'Zoek vastgoedtype…',initOpen:true},
        {key:'propertySubtypeIds' as const,label:'Subcategorieën',options:subtypes,
          placeholder:'Zoek subcategorie…',initOpen:false},
        {key:'dealTypeIds' as const,label:'Dealtype / propositie',options:deals,
          placeholder:'Zoek propositie…',initOpen:false},
      ]).map(group=>
        <details key={group.key} defaultOpen={group.initOpen}
          className="rounded-lg border border-border/70 bg-background">
          <summary className="cursor-pointer flex items-center justify-between gap-2 px-3 py-3 text-sm font-medium hover:bg-muted/25">
            <span>{group.label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {(values[group.key]??[]).length} geselecteerd
            </span>
          </summary>
          <div className="border-t border-border/60 p-3">
            <TaxonomieKeuzelijst options={group.options}
              value={values[group.key]??[]}
              onChange={next=>setValues(prev=>({...prev,[group.key]:next}))}
              disabled={saving}
              searchPlaceholder={group.placeholder}/>
          </div>
        </details>)}
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
