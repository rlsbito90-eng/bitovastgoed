import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import EditableValueButton from '@/components/ui/editable-value-button';
import { toast } from 'sonner';
import type { ObjectVastgoed } from '@/data/mock-data';
import RelatieKoppelveld from './RelatieKoppelveld';

type Props={
  object:ObjectVastgoed;
  onSave:(wijziging:Partial<ObjectVastgoed>)=>Promise<void>;
};

/** Direct wijzigen op de objectkaart. Alleen een eerste registratie vraagt
 * een formulier. Een selectiewijziging wordt meteen opgeslagen; notities
 * slaan op bij het verlaten van het veld of met Ctrl/Cmd+Enter.
 */
export default function ObjectKerngegevensInline({object,onSave}:Props){
  const [busy,setBusy]=useState(false);
  const [motivatieOpen,setMotivatieOpen]=useState(false);
  const [motivatie,setMotivatie]=useState(object.verkoopmotivatie??'');
  const [status,setStatus]=useState<'idle'|'saved'>('idle');

  useEffect(()=>{
    if(!motivatieOpen)setMotivatie(object.verkoopmotivatie??'');
  },[object.verkoopmotivatie,motivatieOpen]);

  async function saveOwner(nieuw:string|null){
    const vorige=object.eigenaarRelatieId??null;
    if(busy||nieuw===vorige)return;
    setBusy(true);
    try{
      await onSave({eigenaarRelatieId:nieuw});
      setStatus('saved');
      toast.success('Eigenaar gekoppeld',{
        action:{label:'Ongedaan maken',onClick:()=>{void onSave({eigenaarRelatieId:vorige})
          .catch(()=>toast.error('Herstellen mislukt'));}},
      });
    }catch(e){toast.error(e instanceof Error?e.message:'Koppelen mislukt');}
    finally{setBusy(false);}
  }

  async function saveMotivatie(){
    if(!motivatieOpen)return;
    const nieuw=motivatie.trim();
    const vorige=object.verkoopmotivatie??'';
    setMotivatieOpen(false);
    if(nieuw===vorige.trim())return;
    setBusy(true);
    try{
      await onSave({verkoopmotivatie:nieuw});
      setStatus('saved');
      toast.success('Verkoopmotivatie opgeslagen',{
        action:{label:'Ongedaan maken',onClick:()=>{void onSave({verkoopmotivatie:vorige})
          .catch(()=>toast.error('Herstellen mislukt'));}},
      });
    }catch(e){
      setMotivatie(vorige);
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setBusy(false);}
  }

  return <div className="space-y-4 border-b border-border/60 pb-4" data-testid="object-inline-kerngegevens">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="section-title">Eigenaar en verkoopmotivatie</h3>
      {status==='saved'&&!busy&&<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5"/> Opgeslagen
      </span>}
      {busy&&<span className="text-xs text-muted-foreground">Opslaan…</span>}
    </div>
    <RelatieKoppelveld
      label="Gekoppelde eigenaar / verkoper"
      value={object.eigenaarRelatieId}
      onChange={id=>{void saveOwner(id);}}
      allowCreate
      disabled={busy}
    />
    {object.eigenaarRelatieId&&<Link to={`/relaties/${object.eigenaarRelatieId}`}
      className="text-xs text-accent hover:underline">
      Relatiedossier openen
    </Link>}
    {!object.eigenaarRelatieId&&object.verkoperNaam?.trim()&&
      <p className="text-xs text-muted-foreground">
        Historische naam: {object.verkoperNaam}. Koppel deze aan een bestaande of nieuwe relatie;
        de oude waarde blijft bewaard.
      </p>}
    <div className="border-t border-border/60 pt-3">
      <span className="field-label">Verkoopmotivatie</span>
      {motivatieOpen?
        <textarea autoFocus rows={3} aria-label="Verkoopmotivatie"
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={motivatie}
          onChange={e=>setMotivatie(e.target.value)}
          onBlur={()=>{void saveMotivatie();}}
          onKeyDown={e=>{
            if(e.key==='Escape'){setMotivatie(object.verkoopmotivatie??'');setMotivatieOpen(false);}
            if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void saveMotivatie();}
          }}/>:
        <EditableValueButton label="Verkoopmotivatie" disabled={busy} multiline
          onClick={()=>setMotivatieOpen(true)} className="mt-1.5">
          {object.verkoopmotivatie?.trim()||<span className="text-muted-foreground">Nog niet vastgelegd</span>}
        </EditableValueButton>}
    </div>
  </div>;
}
