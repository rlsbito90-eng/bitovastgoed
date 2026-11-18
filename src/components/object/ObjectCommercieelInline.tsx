import { useEffect, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import EditableValueButton from '@/components/ui/editable-value-button';
import { toast } from 'sonner';
import { NumberField } from '@/components/ui/number-field';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ObjectVastgoed } from '@/data/mock-data';
import { formatCurrency } from '@/data/mock-data';
import ObjectStatusInline from './ObjectStatusInline';
import ObjectAanbiedingInline from './ObjectAanbiedingInline';
import type { VerhuurMetrics } from '@/lib/derivations/verhuur';
import type { GuardedObjectPatch } from '@/lib/dataIntegrity/objectPayload';
import {
  type FinancieelVeld, maakInlineFinancieelPatch, maakInlineWisPatch,
} from '@/lib/objecten/inlineCommercieel';

type Props={
  object:ObjectVastgoed;
  verhuur:VerhuurMetrics;
  onSave:(wijziging:GuardedObjectPatch)=>Promise<void>;
  toonStatus?:boolean;
  embedded?:boolean;
};

function GeldVeld({
  veld,naam,waarde,onSave,
}:{
  veld:FinancieelVeld;naam:string;waarde:number|undefined;
  onSave:Props['onSave'];
}){
  const [edit,setEdit]=useState(false);
  const [saving,setSaving]=useState(false);
  const [concept,setConcept]=useState<number|undefined>(waarde);
  const conceptRef=useRef<number|undefined>(waarde);
  const cancelled=useRef(false);
  const [wisOpen,setWisOpen]=useState(false);

  useEffect(()=>{
    if(!edit){
      setConcept(waarde);
      conceptRef.current=waarde;
    }
  },[waarde,edit]);

  function start(){
    if(saving)return;
    cancelled.current=false;
    conceptRef.current=waarde;
    setConcept(waarde);
    setEdit(true);
  }
  function annuleren(){
    cancelled.current=true;
    setConcept(waarde);
    conceptRef.current=waarde;
    setEdit(false);
  }
  async function opslaan(){
    if(!edit||saving||cancelled.current)return;
    const next=conceptRef.current;
    if(next===waarde){setEdit(false);return;}
    if(next===undefined){
      setEdit(false);
      toast.info('Gebruik Waarde wissen om een bestaand bedrag te verwijderen.');
      return;
    }
    let patch:GuardedObjectPatch;
    try{patch=maakInlineFinancieelPatch(veld,next);}
    catch(e){
      toast.error(e instanceof Error?e.message:'Ongeldige invoer');
      return;
    }
    setSaving(true);
    setEdit(false);
    try{
      await onSave(patch);
      toast.success(`${naam} opgeslagen`,{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave(waarde===undefined?maakInlineWisPatch(veld):maakInlineFinancieelPatch(veld,waarde))
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      setEdit(true);
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setSaving(false);}
  }
  async function wis(){
    setWisOpen(false);
    setSaving(true);
    try{
      await onSave(maakInlineWisPatch(veld));
      toast.success(`${naam} gewist`,{
        action:{label:'Ongedaan maken',onClick:()=>{
          if(waarde!==undefined)void onSave(maakInlineFinancieelPatch(veld,waarde))
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){toast.error(e instanceof Error?e.message:'Wissen mislukt');}
    finally{setSaving(false);}
  }
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <label className="field-label" htmlFor={`inline-${veld}`}>{naam}</label>
      {!edit&&waarde!==undefined&&<button type="button" disabled={saving}
        onClick={()=>setWisOpen(true)}
        aria-label={`Wis ${naam}`}
        className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
        title="Waarde wissen">
        <Trash2 className="h-3.5 w-3.5"/>
      </button>}
    </div>
    {edit?<NumberField
      autoFocus id={`inline-${veld}`}
      aria-label={naam}
      value={concept}
      decimals={2}
      onChange={next=>{setConcept(next);conceptRef.current=next;}}
      onBlur={()=>{if(!cancelled.current)void opslaan();}}
      onKeyDown={e=>{
        if(e.key==='Escape'){e.preventDefault();annuleren();}
        if(e.key==='Enter'){e.preventDefault();void opslaan();}
      }}
      className="w-full"
    />:
      <EditableValueButton label={naam} onClick={start} disabled={saving}
        className="font-medium tabular-nums">
        {waarde===undefined?<span className="text-muted-foreground font-normal">Niet opgegeven</span>:formatCurrency(waarde)}
        {saving&&<span className="text-xs font-normal text-muted-foreground ml-2">Opslaan…</span>}
      </EditableValueButton>}
    <AlertDialog open={wisOpen} onOpenChange={setWisOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{naam} wissen?</AlertDialogTitle>
          <AlertDialogDescription>
            Deze financiële waarde wordt expliciet uit het object verwijderd.
            Andere velden en eventuele huurdersregels blijven ongewijzigd.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={()=>void wis()}>Waarde wissen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

function IndicatieVeld({
  waarde,onSave,
}:{
  waarde:string|undefined;onSave:Props['onSave'];
}){
  const [edit,setEdit]=useState(false);
  const [concept,setConcept]=useState(waarde??'');
  const conceptRef=useRef(waarde??'');
  const cancelled=useRef(false);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(!edit){setConcept(waarde??'');conceptRef.current=waarde??'';}},[waarde,edit]);
  function annuleren(){cancelled.current=true;setEdit(false);setConcept(waarde??'');conceptRef.current=waarde??'';}
  async function commit(){
    if(!edit||saving||cancelled.current)return;
    setEdit(false);
    const next=conceptRef.current.trim();
    if(next===(waarde??'').trim())return;
    setSaving(true);
    try{
      await onSave({prijsindicatie:next});
      toast.success('Prijsindicatie opgeslagen',{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave({prijsindicatie:waarde??''}).catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      setConcept(next);
      conceptRef.current=next;
      setEdit(true);
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setSaving(false);}
  }
  return <div className="min-w-0 space-y-2">
    <div className="flex justify-between items-center gap-2">
      <label htmlFor="inline-prijsindicatie" className="field-label">Prijsindicatie / toelichting</label>

    </div>
    {edit?<textarea id="inline-prijsindicatie" aria-label="Prijsindicatie" autoFocus rows={2}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={concept}
      onChange={e=>{setConcept(e.target.value);conceptRef.current=e.target.value;}}
      onBlur={()=>{void commit();}}
      onKeyDown={e=>{
        if(e.key==='Escape'){e.preventDefault();annuleren();}
        if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void commit();}
      }}
    />:<EditableValueButton label="Prijsindicatie / toelichting"
      multiline disabled={saving}
      onClick={()=>{cancelled.current=false;setEdit(true);}}>
      {waarde?.trim()||<span className="text-muted-foreground">Niet opgegeven</span>}
      {saving&&<span className="text-xs text-muted-foreground ml-2">Opslaan…</span>}
    </EditableValueButton>}
    <p className="text-xs text-muted-foreground">Tekstuele prijsindicatie; wordt niet gebruikt voor BAR, factor of €/m².</p>
  </div>;
}

export default function ObjectCommercieelInline({
  object,verhuur,onSave,toonStatus=true,embedded=false,
}:Props){
  const heeftHuurders=verhuur.detail.tenantsCount>0;
  return <section className={embedded?'space-y-4 border-b border-border/60 pb-4':'section-card p-5 space-y-4'}
    data-testid="object-commercieel-inline">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="section-title">Commerciële kerngegevens</h3>
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Check className="h-3.5 w-3.5"/> Direct bewerkbaar
      </span>
    </div>
    {toonStatus&&<ObjectStatusInline object={object}/>}
    {toonStatus&&<ObjectAanbiedingInline object={object} onSave={onSave}/>}
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-4">
      <GeldVeld key={`${object.id}-vraagprijs`} veld="vraagprijs" naam="Vraagprijs"
        waarde={object.vraagprijs} onSave={onSave}/>
      <GeldVeld key={`${object.id}-huurinkomsten`} veld="huurinkomsten" naam="Jaarhuur (objectniveau)"
        waarde={object.huurinkomsten} onSave={onSave}/>
    </div>
    <div className="border-t border-border/60 pt-3">
      <IndicatieVeld key={object.id} waarde={object.prijsindicatie} onSave={onSave}/>
    </div>
    {heeftHuurders&&<div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
      <p>Er zijn {verhuur.detail.tenantsCount} huurdersregels. Wijzigingen aan de objectjaarhuur passen deze huurcontracten niet aan.</p>
      {verhuur.detail.sumTenantRent!==null&&<p>
        Jaarhuur volgens huurdersregels: <strong className="text-foreground">{formatCurrency(verhuur.detail.sumTenantRent)}</strong>.
        Voor de verhuurgegevens zijn deze regels leidend.
      </p>}
      {verhuur.warnings.rentMismatch&&
        <p className="text-amber-600 dark:text-amber-400">
          De objectjaarhuur wijkt af van de optelsom. Controleer de bedragen vóór een rendementsoordeel.
        </p>}
    </div>}
    <p className="text-xs text-muted-foreground">
      Automatisch berekende kengetallen volgen de opgeslagen bedragen.
      Bestaande handmatige rendementsoverrides worden niet overschreven.
    </p>
  </section>;
}
