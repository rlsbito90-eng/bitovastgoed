import { useState } from 'react';
import { useBiedingen } from '@/hooks/useBiedingen';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import { EXTRA_VOORWAARDEN_LABELS, VOORBEHOUD_LABELS, KOSTEN_LABELS, type Bieding } from '@/lib/biedingen/types';
import { fmtDate, fmtEur } from '@/lib/biedingen/format';
import { localDateKey } from '@/lib/tasks/workView';

type Condition = {key:string; label:string; detail:string; deadline?:string|null; track:boolean};
function acceptedConditions(b:Bieding):Condition[] {
  const rows:Condition[] = [
    {key:'financiering',label:'Financieringsvoorbehoud',detail:VOORBEHOUD_LABELS[b.financieringsvoorbehoud] ?? 'Onbekend',track:b.financieringsvoorbehoud==='ja'},
    {key:'dd',label:'Due diligence',detail:VOORBEHOUD_LABELS[b.ddVoorbehoud] ?? 'Onbekend',track:b.ddVoorbehoud==='ja'},
  ];
  for (const [index,v] of (b.extraVoorwaarden ?? []).entries()) {
    rows.push({key:'extra-'+index+'-'+v.type,label:EXTRA_VOORWAARDEN_LABELS[v.type] ?? v.type,detail:[v.karakter==='voorbehoud'?'Voorbehoud':v.karakter==='transactiebepaling'?'Transactiebepaling':'Karakter niet vastgesteld',v.toelichting].filter(Boolean).join(' · '),deadline:v.deadline,track:true});
  }
  if(b.voorwaarden) rows.push({key:'tekst',label:'Aanvullende vrije tekst',detail:b.voorwaarden,track:true});
  if(b.gewensteLevering || b.gewensteLeveringTekst) rows.push({key:'levering',label:'Gewenste levering',detail:b.gewensteLeveringTekst || 'Afgesproken datum',deadline:b.gewensteLevering,track:true});
  if(b.waarborgsomBedrag!=null || b.waarborgsomPct!=null) rows.push({key:'waarborg',label:'Waarborgsom',detail:[b.waarborgsomBedrag!=null?fmtEur(b.waarborgsomBedrag):null,b.waarborgsomPct!=null?b.waarborgsomPct+'%':null].filter(Boolean).join(' · '),track:true});
  if(b.kostenType) rows.push({key:'kosten',label:'Kosten',detail:KOSTEN_LABELS[b.kostenType],track:false});
  return rows;
}

export default function DealAcceptedConditions({dealId,objectId,relatieId,readOnly=false}:{dealId:string;objectId:string;relatieId:string;readOnly?:boolean}) {
  const {items,loading,error} = useBiedingen({dealId});
  const {taken} = useDataStore();
  const [selected,setSelected] = useState<{condition:Condition;marker:string;bid:Bieding}|null>(null);
  const accepted = items.filter(b=>b.status==='geaccepteerd' && b.richting==='van_koper' && b.objectId===objectId && b.relatieId===relatieId);
  if(loading) return <section className="section-card p-5 text-sm text-muted-foreground">Transactievoorwaarden laden…</section>;
  if(error) return <section className="section-card p-5 text-sm text-destructive">Transactievoorwaarden konden niet worden geladen.</section>;
  if(!accepted.length) return null;
  if(accepted.length!==1) return <section className="section-card p-5 space-y-2"><h2 className="section-title">Transactievoorwaarden</h2><p className="text-sm text-muted-foreground">Meerdere geaccepteerde biedingen gevonden. Controleer eerst in het biedboek welke overeenkomst leidend is.</p></section>;
  const bid=accepted[0];
  const today=localDateKey(new Date());
  return <section className="section-card p-5 sm:p-6 space-y-3">
    <h2 className="section-title">Transactievoorwaarden</h2>
    <p className="text-xs text-muted-foreground">Bron: geaccepteerd kopersbod van {fmtDate(bid.bieddatum)} · {fmtEur(bid.bedrag)}. Taken bewaken de opvolging; een afgeronde taak is geen juridische bevestiging dat een voorbehoud is vervallen.</p>
    {bid.extraVoorwaarden==null && <p className="text-xs text-muted-foreground">Aanvullende gestructureerde voorwaarden niet vastgesteld.</p>}
    {bid.extraVoorwaarden?.length===0 && <p className="text-xs text-muted-foreground">Geen aanvullende gestructureerde voorwaarden geregistreerd.</p>}
    {acceptedConditions(bid).map(c=>{
      const marker='[bieding:'+bid.id+':'+c.key+']';
      const linked=taken.filter(t=>!t.softDeletedAt && t.dealId===dealId && t.notities?.includes(marker) && t.status!=='geannuleerd');
      const done=linked.some(t=>t.status==='afgerond');
      const overdue=!done && c.track && c.deadline && c.deadline<today;
      return <div key={c.key} className="rounded-lg border p-3 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{c.label}</span>{c.track && <span className={'text-xs '+(overdue?'text-destructive':'text-muted-foreground')}>{done?'Opvolgtaak afgerond':overdue?'Deadline verstreken':linked.length?'Opvolging gepland':'Opvolging nog niet gepland'}</span>}</div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.detail}</p>
        {c.deadline && <p className="text-xs">Uiterlijk {fmtDate(c.deadline)}</p>}
        {!readOnly && c.track && !linked.length && <Button size="sm" variant="outline" onClick={()=>setSelected({condition:c,marker,bid})}>Opvolgtaak aanmaken</Button>}
      </div>;
    })}
    {selected && <TaakFormDialog open onOpenChange={open=>!open&&setSelected(null)} defaultDealId={dealId} defaultObjectId={objectId} defaultRelatieId={relatieId} defaultTitel={'Bewaken · '+selected.condition.label} defaultDeadline={selected.condition.deadline ?? undefined} defaultNotities={selected.marker+'\n'+selected.condition.detail} onSaved={()=>setSelected(null)} />}
  </section>;
}
