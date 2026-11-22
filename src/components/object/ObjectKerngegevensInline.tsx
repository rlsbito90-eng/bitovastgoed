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

  async function saveRol(veld:'eigenaarRelatieId'|'verkoperRelatieId'|'aanbiederRelatieId',nieuw:string|null){
    const vorige=object[veld]??null;
    if(busy||nieuw===vorige)return;
    setBusy(true);
    try{
      await onSave({[veld]:nieuw});
      setStatus('saved');
      toast.success('Relatierol opgeslagen',{ 
        action:{label:'Ongedaan maken',onClick:()=>{void onSave({[veld]:vorige})
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
      <h3 className="section-title">Betrokken partijen en verkoopmotivatie</h3>
      {status==='saved'&&!busy&&<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5"/> Opgeslagen
      </span>}
      {busy&&<span className="text-xs text-muted-foreground">Opslaan…</span>}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">
      Koppel partijen op hun rol bij dit specifieke object. De bestaande eigenaar-koppeling
      kan in oudere dossiers ook een makelaar of verkoper zijn; deze gegevens worden niet automatisch gewijzigd.
    </p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-3">
      {([
        {key:'eigenaarRelatieId' as const,label:'Eigenaar (bestaande koppeling)',help:'Controleer of dit daadwerkelijk de eigenaar is.'},
        {key:'verkoperRelatieId' as const,label:'Verkoper / verkoopbevoegde partij',help:'De partij die namens eigendom verkoopt.'},
        {key:'aanbiederRelatieId' as const,label:'Aanbiedende makelaar / tussenpersoon',help:'De partij die deze propositie aanbrengt.'},
      ]).map(rol=><div key={rol.key} className="min-w-0 space-y-1.5">
        <RelatieKoppelveld label={rol.label} value={object[rol.key]}
          onChange={id=>{void saveRol(rol.key,id);}}
          allowCreate disabled={busy} />
        <p className="text-xs leading-4 text-muted-foreground">{rol.help}</p>
        {object[rol.key]&&<Link to={`/relaties/${object[rol.key]}`}
          className="inline-block text-xs text-accent hover:underline">Relatiedossier openen</Link>}
      </div>)}
    </div>
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
