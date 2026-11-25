import { CalendarPlus, AlertCircle } from 'lucide-react';
import { deadlineLabel } from '@/lib/taakHelpers';
import type { KandidaatOpvolging } from '@/lib/pipeline/kandidaatOpvolging';

const datum=(s:string)=>s.slice(0,10).split('-').reverse().join('-');
export default function KandidaatOpvolgingPanel({info,onTaak}:{info:KandidaatOpvolging;onTaak:()=>void}){
  return <div className="space-y-1 text-xs text-muted-foreground" onClick={e=>e.stopPropagation()}>
    <p>{info.historie.bewijs==='niet_geregistreerd'?'Geen aanbieding geregistreerd':info.historie.eersteAanbieddatum?'Aangeboden: '+datum(info.historie.eersteAanbieddatum):'Aanbieding geregistreerd; datum onbekend'}</p>
    {info.contact&&<p>Laatste contact over dit object: {datum(info.contact.momentDate)}</p>}
    {info.reactie&&<p className="break-words"><span className="font-medium text-foreground">{info.reactie.label}</span> · {datum(info.reactie.datum)}{info.reactie.redenen?' · '+info.reactie.redenen:''}</p>}
    {info.taak?<div className="space-y-1">
      <p className={info.teLaat?'text-destructive font-medium':'text-foreground font-medium'}>{info.teLaat?'Deadline verstreken · ':''}{info.taak.titel}</p>
      <p>{info.taak.status==='wacht_op_reactie'?'Wachten op reactie · ':''}{deadlineLabel(info.taak)}{info.openTaken.length>1?' · '+info.openTaken.length+' open taken':''}</p>
      <button type="button" className="underline underline-offset-2 hover:text-foreground text-left" onClick={onTaak}>Open taak</button>
    </div>:info.actief?<div className="space-y-1">
      <p className="flex items-start gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0"/> Geen gekoppelde open taak</p>
      <button type="button" onClick={onTaak} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted"><CalendarPlus className="h-3.5 w-3.5"/> Plan opvolging</button>
    </div>:null}
  </div>;
}
