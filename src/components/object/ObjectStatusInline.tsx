import { useState } from 'react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { type ObjectStatus, type ObjectVastgoed, OBJECT_STATUS_LABELS } from '@/data/mock-data';
import ArchiveerDialog from '@/components/ArchiveerDialog';

/** Eén bron voor beschikbaarheidsstatus, zowel in Overzicht als in Dealflow.
 * De commerciële trajectfase blijft exclusief in de Object Pipeline.
 * Terminale statussen vereisen de bestaande archiefredenworkflow.
 */
const BESCHIKBAARHEIDSSTATUSSEN:ReadonlyArray<ObjectStatus>=[
  'beschikbaar','on_hold','onder_optie','verkocht','ingetrokken',
];

export default function ObjectStatusInline({object}:{object:ObjectVastgoed}){
  const {updateObject,unarchiveObject}=useDataStore();
  const [bezig,setBezig]=useState(false);
  const [pending,setPending]=useState<ObjectStatus|null>(null);
  const [open,setOpen]=useState(false);
  const isLegacy=!BESCHIKBAARHEIDSSTATUSSEN.includes(object.status);

  async function wijzig(nieuw:ObjectStatus){
    if(bezig||nieuw===object.status)return;
    if(nieuw==='verkocht'||nieuw==='ingetrokken'){
      setPending(nieuw);
      setOpen(true);
      return;
    }
    setBezig(true);
    try{
      await updateObject(object.id,{status:nieuw});
      if(object.isArchived)await unarchiveObject(object.id);
      toast.success(`Objectstatus gewijzigd naar ${OBJECT_STATUS_LABELS[nieuw]}`);
    }catch(e){
      toast.error(e instanceof Error?e.message:'Status wijzigen mislukt');
    }finally{setBezig(false);}
  }
  return <div className="space-y-2" data-testid="object-status-inline">
    <label className="field-label block" htmlFor="objectstatus-inline">Objectstatus</label>
    <select id="objectstatus-inline"
      className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
      value={isLegacy?'':object.status}
      disabled={bezig}
      onChange={e=>void wijzig(e.target.value as ObjectStatus)}>
      {isLegacy&&<option value="" disabled>
        {OBJECT_STATUS_LABELS[object.status]} — oudere status, kies een actuele beschikbaarheidsstatus
      </option>}
      {BESCHIKBAARHEIDSSTATUSSEN.map(status=>
        <option key={status} value={status}>{OBJECT_STATUS_LABELS[status]}</option>)}
    </select>
    {isLegacy&&<p className="text-xs text-muted-foreground">
      De bestaande processtatus blijft behouden totdat je zelf een beschikbaarheidsstatus kiest.
    </p>}
    <p className="text-xs text-muted-foreground">
      Dit is de beschikbaarheid van het object. De trajectfase wijzig je onder Dealflow.
    </p>
    <ArchiveerDialog
      open={open}
      onOpenChange={next=>{setOpen(next);if(!next)setPending(null);}}
      kind="object"
      requireReasonSelection
      triggerHint={pending==='verkocht'
        ? 'Het object wordt als Verkocht gearchiveerd. Geef aan of de verkoop via Bito of extern is verlopen; dit beïnvloedt de funnel- en fee-rapportage.'
        : 'Het object wordt als Ingetrokken gearchiveerd. Geef de feitelijke reden op. Gekoppelde actieve Deals worden als verloren afgesloten.'}
      onConfirm={async ({reason,note})=>{
        if(!pending)return;
        setBezig(true);
        try{
          await updateObject(object.id,{status:pending,archivedReason:reason,archivedNote:note});
          toast.success(`Objectstatus gewijzigd naar ${OBJECT_STATUS_LABELS[pending]}`);
          setOpen(false);
          setPending(null);
        }catch(e){
          toast.error(e instanceof Error?e.message:'Status wijzigen mislukt');
        }finally{setBezig(false);}
      }}
    />
  </div>;
}
