import {useState} from 'react';
import {Check,Pencil} from 'lucide-react';
import {toast} from 'sonner';
import type {ObjectVastgoed} from '@/data/mock-data';
import type {GuardedObjectPatch} from '@/lib/dataIntegrity/objectPayload';
import {usePropertyTaxonomie} from '@/hooks/usePropertyTaxonomie';
import {ClassificatieRij} from '@/components/TaxonomieBadges';
import MultiSelectChips from '@/components/object/MultiSelectChips';
import {maakObjectTypePatch} from '@/lib/objecten/inlineFysiek';
import {
  AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,
  AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props={object:ObjectVastgoed;onSave:(patch:GuardedObjectPatch)=>Promise<void>};

export default function ObjectClassificatieInline({object,onSave}:Props){
  const {loading,propertyTypes,dealTypes,subtypesForType,propertyTypeById}=usePropertyTaxonomie();
  const [bewerken,setBewerken]=useState(false);
  const [bezig,setBezig]=useState(false);
  const [saved,setSaved]=useState(false);
  const [pending,setPending]=useState<string|null>(null);
  const oudeSubtypes=object.propertySubtypeIds??[];

  async function schrijf(patch:GuardedObjectPatch,vorige?:GuardedObjectPatch){
    if(bezig)return;
    setBezig(true);
    try{
      await onSave(patch);
      setSaved(true);
      toast.success('Classificatie opgeslagen',vorige?{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave(vorige).catch(()=>toast.error('Herstellen mislukt'));
        }},
      }:undefined);
    }catch(e){
      toast.error(e instanceof Error?e.message:'Wijzigen mislukt');
    }finally{setBezig(false);}
  }
  function wilTypeWijzigen(id:string){
    if(bezig||!id||id===object.propertyTypeId)return;
    if(oudeSubtypes.length){
      setPending(id);
      return;
    }
    void kiesType(id);
  }
  async function kiesType(id:string){
    setPending(null);
    const type=propertyTypeById(id);
    if(!type){toast.error('Onbekend type vastgoed');return;}
    try{
      const patch=maakObjectTypePatch(type);
      const vorige={
        propertyTypeId:object.propertyTypeId??null,
        type:object.type,
        propertySubtypeIds:oudeSubtypes,
        subcategorieId:object.subcategorieId??null,
      } as unknown as GuardedObjectPatch;
      await schrijf(patch,vorige);
    }catch(e){
      toast.error(e instanceof Error?e.message:'Type wijzigen mislukt');
    }
  }

  return <section className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-3"
    data-testid="object-classificatie-inline">
    <div className="flex items-center justify-between gap-2">
      <h3 className="section-title">Vastgoedclassificatie</h3>
      <button type="button" aria-expanded={bewerken}
        disabled={bezig} onClick={()=>setBewerken(x=>!x)}
        className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50">
        <Pencil className="h-3.5 w-3.5"/>{bewerken?'Sluiten':'Wijzigen'}
      </button>
    </div>
    <ClassificatieRij propertyTypeId={object.propertyTypeId}
      fallbackAssetClass={object.type} subtypeIds={object.propertySubtypeIds}
      dealTypeIds={object.dealTypeIds} mode="single"/>
    {saved&&!bezig&&<p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5"/> Opgeslagen
    </p>}
    {bewerken&&<div className="border-t border-border/60 pt-4 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="inline-vastgoedtype" className="field-label">Type vastgoed</label>
        <select id="inline-vastgoedtype" value={object.propertyTypeId??''}
          disabled={bezig||loading}
          onChange={e=>wilTypeWijzigen(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {!object.propertyTypeId&&<option value="">— Nog geen type gekoppeld (legacy) —</option>}
          {object.propertyTypeId&&!propertyTypeById(object.propertyTypeId)&&
            <option value={object.propertyTypeId}>Bestaand type (niet meer actief)</option>}
          {propertyTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">
          Dit type wordt ook gebruikt voor kandidaatmatching. Het oudere vastgoedtype wordt mee bijgewerkt.
        </p>
      </div>
      <fieldset disabled={bezig||loading||!object.propertyTypeId} className="space-y-2">
        <legend className="field-label mb-2">Subcategorieën</legend>
        <MultiSelectChips
          options={subtypesForType(object.propertyTypeId).map(x=>({value:x.id,label:x.name}))}
          value={oudeSubtypes}
          onChange={next=>void schrijf({propertySubtypeIds:next},{propertySubtypeIds:oudeSubtypes})}
          emptyLabel="Geen subcategorieën voor dit vastgoedtype"/>
      </fieldset>
      <fieldset disabled={bezig||loading} className="space-y-2">
        <legend className="field-label mb-2">Dealtype / propositie</legend>
        <MultiSelectChips options={dealTypes.map(d=>({value:d.id,label:d.name}))}
          value={object.dealTypeIds??[]}
          onChange={next=>void schrijf({dealTypeIds:next},{dealTypeIds:object.dealTypeIds??[]})}/>
      </fieldset>
    </div>}
    <AlertDialog open={pending!==null} onOpenChange={open=>{if(!open)setPending(null);}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Type vastgoed wijzigen?</AlertDialogTitle>
          <AlertDialogDescription>
            Het object heeft {oudeSubtypes.length} gekoppelde subcategorieën. Bij wijziging van
            hoofdtype worden deze subcategorieën gewist om tegenstrijdige matching te voorkomen.
            Dealtypen blijven behouden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={()=>{if(pending)void kiesType(pending);}}>
            Type wijzigen en subcategorieën wissen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
