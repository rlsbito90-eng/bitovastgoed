import {useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {cn} from '@/lib/utils';
import EditableValueButton from '@/components/ui/editable-value-button';

type InlineTekstProps={
  label:string;
  value?:string|null;
  onSave:(value:string)=>Promise<void>;
  multiline?:boolean;
  required?:boolean;
  emptyLabel?:string;
  displayClassName?:string;
  showPencil?:boolean;
};

/** Eén direct aanklikbare dossierwaarde, met gerichte patch en expliciet wissen. */
export function InlineDossierTekst({
  label,value,onSave,multiline=false,required=false,
  emptyLabel='Niet opgegeven',displayClassName,showPencil=true,
}:InlineTekstProps){
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(value??'');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const base=useRef(value??'');
  const cancelled=useRef(false);
  const savingRef=useRef(false);

  useEffect(()=>{if(!editing)setDraft(value??'');},[value,editing]);

  function start(){
    if(savingRef.current)return;
    base.current=value??'';
    setDraft(base.current);setError(null);cancelled.current=false;setEditing(true);
  }
  function cancel(){
    cancelled.current=true;
    setDraft(value??'');setError(null);setEditing(false);
  }
  async function save(wissen=false){
    if(!editing||cancelled.current||savingRef.current)return;
    const next=wissen?'':draft.trim();
    const original=base.current;
    if(required&&!next){setError(`${label} mag niet leeg zijn.`);return;}
    if(!wissen&&!next&&original.trim()){
      setError('Gebruik Wissen om een bestaande tekst bewust te verwijderen.');
      return;
    }
    if(next===original.trim()){setEditing(false);setError(null);return;}
    if((value??'')!==original){
      setError('Dit veld is elders gewijzigd. Annuleer en open de actuele waarde opnieuw.');
      return;
    }
    savingRef.current=true;setSaving(true);setError(null);
    try{
      await onSave(next);
      setEditing(false);
      toast.success(`${label} opgeslagen`,{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave(original).catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      setError(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{
      savingRef.current=false;setSaving(false);
    }
  }
  return <div className="min-w-0 space-y-1.5">
    {editing?
      <>
        {multiline?
          <textarea autoFocus rows={3} aria-label={label} disabled={saving}
            value={draft} onChange={e=>{setDraft(e.target.value);setError(null);}}
            onBlur={()=>{void save();}}
            onKeyDown={e=>{
              if(e.key==='Escape'){e.preventDefault();cancel();}
              if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void save();}
            }}
            className="w-full min-h-20 rounded-md border border-input bg-background p-3 text-sm"/>:
          <input autoFocus type="text" aria-label={label} disabled={saving}
            value={draft} onChange={e=>{setDraft(e.target.value);setError(null);}}
            onBlur={()=>{void save();}}
            onKeyDown={e=>{
              if(e.key==='Escape'){e.preventDefault();cancel();}
              if(e.key==='Enter'){e.preventDefault();void save();}
            }}
            className="w-full min-h-10 rounded-md border border-input bg-background px-3 text-sm"/>
        }
        {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {saving&&<span role="status" className="text-xs text-muted-foreground">Opslaan…</span>}
          {!required&&!!base.current.trim()&&
            <button type="button" disabled={saving} onMouseDown={e=>e.preventDefault()}
              onClick={()=>{if(window.confirm(`${label} wissen?`))void save(true);}}
              className="rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              Wissen
            </button>}
          <button type="button" disabled={saving} onMouseDown={e=>e.preventDefault()}
            onClick={cancel} className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40">
            Annuleren
          </button>
        </div>
      </>:
      <EditableValueButton label={label} onClick={start} multiline={multiline}
        showPencil={showPencil} className={cn('w-full',displayClassName)}>
        <span className={cn('break-words',displayClassName)}>
          {value?.trim()||<span className="text-muted-foreground font-normal">{emptyLabel}</span>}
        </span>
      </EditableValueButton>}
  </div>;
}

type Option={value:string;label:string};
export function InlineDossierKeuze({
  label,value,options,onSave,children,showPencil=true,
}:{
  label:string;value:string;options:readonly Option[];
  onSave:(value:string)=>Promise<void>;children?:ReactNode;showPencil?:boolean;
}){
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selected,setSelected]=useState(value);
  useEffect(()=>{if(!editing)setSelected(value);},[value,editing]);
  async function save(next:string){
    if(saving||next===value){setEditing(false);return;}
    setSelected(next);setSaving(true);setError(null);
    try{
      await onSave(next);setEditing(false);
    }catch(e){
      setError(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setSaving(false);}
  }
  return <div className="min-w-0 space-y-1.5">
    {editing?
      <select autoFocus aria-label={label} disabled={saving} value={selected}
        onChange={e=>{void save(e.target.value);}}
        onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setSelected(value);setEditing(false);}}}
        className="min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
        {!options.some(o=>o.value===value)&&<option value={value}>{value}</option>}
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>:
      <EditableValueButton label={label} showPencil={showPencil} onClick={()=>{setError(null);setEditing(true);}}>
        {children??options.find(o=>o.value===value)?.label??value}
      </EditableValueButton>}
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
