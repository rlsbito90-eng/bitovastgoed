import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import { bouwPandenverkennerBrief1, kiesPandenverkennerVariant } from '@/lib/acquisitie/pandenverkennerCopy';
import { useUpsertPandenverkennerBriefConcept } from '@/hooks/usePandenverkennerBrieven';

interface Props { open:boolean; onOpenChange:(open:boolean)=>void; kansen:Vastgoedkans[]; onKlaar?:()=>void; }
interface EigenaarRij { vastgoedkans_id:string; eigenaar:{ partij_type?:string|null; naam?:string|null; bedrijfsnaam?:string|null; adres?:string|null; postcode?:string|null; plaats?:string|null }|null; }
type PreflightStatus='klaar_eigenaar'|'klaar_objectadres'|'overslaan_bestaand'|'geblokkeerd';
interface PreflightRij { kans:Vastgoedkans; status:PreflightStatus; reden:string; eigenaar:EigenaarRij['eigenaar']; verzendadres:string|null; }

function postcode(v:string|null|undefined):string{const c=(v??'').replace(/\s+/g,'').toUpperCase();return /^\d{4}[A-Z]{2}$/.test(c)?`${c.slice(0,4)} ${c.slice(4)}`:(v??'').trim()}
function plaats(v:string|null|undefined):string{return(v??'').trim()}
function objectVerzendadres(k:Vastgoedkans):string|null{const a=k.adres?.trim();const p=postcode(k.postcode);const pl=plaats(k.plaats);return a&&p&&pl?`${a}\n${p} ${pl}`:null}
function objectOmschrijving(k:Vastgoedkans):string{const a=k.adres?.trim()??'';const pl=plaats(k.plaats);return a&&pl&&!a.toLowerCase().includes(pl.toLowerCase())?`${a} te ${pl}`:a}
function eigenaarAdres(e:EigenaarRij['eigenaar']):string|null{if(!e?.adres?.trim()||!e.postcode?.trim()||!e.plaats?.trim())return null;return`${e.adres.trim()}\n${postcode(e.postcode)} ${plaats(e.plaats)}`}

export default function PandenverkennerBulkBriefDialog({open,onOpenChange,kansen,onKlaar}:Props){
  const[rijen,setRijen]=useState<PreflightRij[]>([]);const[laden,setLaden]=useState(false);const[uitvoeren,setUitvoeren]=useState(false);const upsert=useUpsertPandenverkennerBriefConcept();
  const ids=useMemo(()=>kansen.map(k=>k.id),[kansen]);const idsKey=ids.join('|');

  useEffect(()=>{if(!open||ids.length===0){setRijen([]);return}let stop=false;const laad=async()=>{setLaden(true);try{
    const[{data:brieven,error:briefFout},{data:koppelingen,error:eigenaarFout}]=await Promise.all([
      (supabase as any).from('off_market_brieven').select('vastgoedkans_id,campagne_stap,status,archived_at').in('vastgoedkans_id',ids).is('archived_at',null),
      (supabase as any).from('eigenaar_koppelingen').select('vastgoedkans_id,eigenaar:eigenaren(partij_type,naam,bedrijfsnaam,adres,postcode,plaats)').in('vastgoedkans_id',ids),
    ]);
    if(briefFout)throw new Error(briefFout.message);if(eigenaarFout)throw new Error(eigenaarFout.message);
    const bestaand=new Set((brieven??[]).filter((b:any)=>(b.campagne_stap??'brief_1')==='brief_1').map((b:any)=>b.vastgoedkans_id));
    const perKans=new Map<string,EigenaarRij['eigenaar'][]>() ;for(const r of (koppelingen??[]) as EigenaarRij[]){const arr=perKans.get(r.vastgoedkans_id)??[];if(r.eigenaar)arr.push(r.eigenaar);perKans.set(r.vastgoedkans_id,arr)}
    const volgende=kansen.map((k):PreflightRij=>{if(bestaand.has(k.id))return{kans:k,status:'overslaan_bestaand',reden:'Brief 1 bestaat al; geen dubbel concept.',eigenaar:null,verzendadres:null};const eigenaren=perKans.get(k.id)??[];const bruikbaar=eigenaren.filter(e=>Boolean(eigenaarAdres(e)));if(bruikbaar.length===1)return{kans:k,status:'klaar_eigenaar',reden:'Exact één eigenaar met bruikbaar correspondentieadres.',eigenaar:bruikbaar[0],verzendadres:eigenaarAdres(bruikbaar[0])};const objectadres=objectVerzendadres(k);if(objectadres)return{kans:k,status:'klaar_objectadres',reden:bruikbaar.length>1?'Meerdere bruikbare eigenaren; veilige algemene eigenaarspost naar objectadres.':'Geen bruikbare eigenaar nodig; algemene eigenaarspost naar objectadres.',eigenaar:null,verzendadres:objectadres};return{kans:k,status:'geblokkeerd',reden:'Objectadres mist straat, postcode of plaats.',eigenaar:null,verzendadres:null}});
    if(!stop)setRijen(volgende);
  }catch(e){if(!stop)toast.error(e instanceof Error?e.message:'Briefpreflight laden mislukt.')}finally{if(!stop)setLaden(false)}};void laad();return()=>{stop=true};},[open,idsKey]);

  const klaar=rijen.filter(r=>r.status==='klaar_eigenaar'||r.status==='klaar_objectadres');
  const maakConcepten=async()=>{if(uitvoeren||klaar.length===0)return;setUitvoeren(true);let gemaakt=0;try{for(const rij of klaar){const bevestigd=rij.status==='klaar_eigenaar';const omschrijving=objectOmschrijving(rij.kans);const copy=kiesPandenverkennerVariant({vastgoedkansId:rij.kans.id,typeVastgoed:rij.kans.typeVastgoed,objectomschrijving:omschrijving,plaats:rij.kans.plaats,eigenaarBevestigd:bevestigd});const tekst=bouwPandenverkennerBrief1({vastgoedkansId:rij.kans.id,typeVastgoed:rij.kans.typeVastgoed,objectomschrijving:omschrijving,plaats:rij.kans.plaats,eigenaarBevestigd:bevestigd},copy);const e=rij.eigenaar;const isBedrijf=e?.partij_type==='rechtspersoon';await upsert.mutateAsync({vastgoedkans_id:rij.kans.id,campagne_stap:'brief_1',eigenaar_naam:bevestigd&&!isBedrijf?(e?.naam??null):null,eigenaar_bedrijfsnaam:bevestigd?(e?.bedrijfsnaam??(isBedrijf?e?.naam:null)??null):null,geadresseerde_label:bevestigd?null:'Aan de eigenaar van',adresseerwijze:bevestigd?'eigenaar_bekend':'eigenaar_objectadres',verzendadres:rij.verzendadres!,objectadres:rij.kans.adres,objectomschrijving:omschrijving,aanhef:'Geachte heer/mevrouw,',onderwerp:tekst.onderwerp,brieftekst:tekst.brieftekst,copy});gemaakt++}toast.success(`${gemaakt} Pandenverkenner Brief 1-concept${gemaakt===1?'':'en'} voorbereid.`);onKlaar?.();onOpenChange(false)}catch(e){toast.error(e instanceof Error?e.message:'Bulkbrieven voorbereiden mislukt.')}finally{setUitvoeren(false)}};

  const telling=useMemo(()=>({eigenaar:rijen.filter(r=>r.status==='klaar_eigenaar').length,object:rijen.filter(r=>r.status==='klaar_objectadres').length,bestaand:rijen.filter(r=>r.status==='overslaan_bestaand').length,blok:rijen.filter(r=>r.status==='geblokkeerd').length}),[rijen]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto"><DialogHeader><DialogTitle>Bulk brieven voorbereiden — Pandenverkenner</DialogTitle><DialogDescription>Maakt uitsluitend Brief 1-concepten. Geen brief wordt automatisch definitief, geprint of verzonden.</DialogDescription></DialogHeader>{laden?<div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Preflight uitvoeren…</div>:<><div className="flex flex-wrap gap-2"><Badge variant="outline">{telling.eigenaar} eigenaar bekend</Badge><Badge variant="outline">{telling.object} Aan de eigenaar van</Badge><Badge variant="secondary">{telling.bestaand} bestaand</Badge>{telling.blok>0&&<Badge variant="destructive">{telling.blok} geblokkeerd</Badge>}</div><div className="divide-y rounded-md border">{rijen.map(r=><div key={r.kans.id} className="flex items-start justify-between gap-3 p-3 text-sm"><div><p className="font-medium">{objectOmschrijving(r.kans)||r.kans.kansnummer||r.kans.id}</p><p className="mt-1 text-xs text-muted-foreground">{r.reden}</p></div><Badge variant={r.status==='geblokkeerd'?'destructive':r.status==='overslaan_bestaand'?'secondary':'outline'}>{r.status==='klaar_eigenaar'?'Eigenaar':r.status==='klaar_objectadres'?'Eigenaar objectadres':r.status==='overslaan_bestaand'?'Overslaan':'Geblokkeerd'}</Badge></div>)}</div></>}<DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>Annuleren</Button><Button onClick={()=>void maakConcepten()} disabled={laden||uitvoeren||klaar.length===0}><FileText className="mr-1.5 h-4 w-4"/>{uitvoeren?'Voorbereiden…':`${klaar.length} concept${klaar.length===1?'':'en'} maken`}</Button></DialogFooter></DialogContent></Dialog>;
}
