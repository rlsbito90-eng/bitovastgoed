import { useMemo, useState } from 'react';
import { FileCheck2, Loader2, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useVastgoedkansBrieven, type AcquisitieBrief } from '@/hooks/useAcquisitieBrieven';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { maakBestaandConceptDefinitief } from '@/lib/offMarket/acquisitie/bestaandConceptNaarProductie';
import ProductiekernPrintbatchActies from '@/components/offmarket/acquisitie/ProductiekernPrintbatchActies';
import { useQueryClient } from '@tanstack/react-query';

interface Props { vastgoedkansId:string; compact?:boolean; }
function label(brief:AcquisitieBrief):string{return brief.eigenaar_bedrijfsnaam?.trim()||brief.eigenaar_naam?.trim()||(brief as AcquisitieBrief&{geadresseerde_label?:string|null}).geadresseerde_label?.trim()||'Aan de eigenaar van'}

export default function PandenverkennerProductiekernActies({vastgoedkansId,compact=false}:Props){
  const qc=useQueryClient();const{data:selectie=[]}=useAcquisitieSelectie();const{data:brieven=[]}=useVastgoedkansBrieven(vastgoedkansId);const[bezigId,setBezigId]=useState<string|null>(null);
  const writes=useMemo(()=>maakStandaardProductiekernBrowserWriteSamenstelling(),[]);const lezen=useMemo(()=>maakStandaardProductiekernBrowserLeesSamenstelling(),[]);
  const selectieItem=useMemo(()=>selectie.find(i=>i.vastgoedkans_id===vastgoedkansId)??null,[selectie,vastgoedkansId]);
  const postConcepten=useMemo(()=>brieven.filter(b=>(b.kanaal??'post')==='post'&&b.status==='concept'&&!b.archived_at),[brieven]);
  const definitief=useMemo(()=>brieven.filter(b=>(b as AcquisitieBrief&{status:string}).status==='definitief'),[brieven]);
  const actief=writes.activatie.schrijvenActief&&lezen.activatie.lezenActief;
  if(!actief||!selectieItem||(postConcepten.length===0&&definitief.length===0))return null;

  const maakDefinitief=async(brief:AcquisitieBrief)=>{if(bezigId)return;setBezigId(brief.id);try{
    const auth=await supabase.auth.getUser();if(auth.error||!auth.data.user?.id)throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');
    const actorId=auth.data.user.id;
    const gestart=await writes.dossierBronRepository.startDossier({selectieId:selectieItem.id,actorId,operationKey:`dossier-start:vastgoedkans:${vastgoedkansId}`});
    if(gestart.vastgoedkansId!==vastgoedkansId||gestart.signaalId)throw new Error('Productiedossier is niet aan de verwachte Vastgoedkans gekoppeld.');
    const resultaat=await maakBestaandConceptDefinitief({selectieId:selectieItem.id,vastgoedkansId,brief:brief as any,actorId},{bridge:writes.bestaandConceptBridgeRepository,vroeg:writes.vroegeRepository,lezen:lezen.repository,transacties:writes.transactieRepository});
    await Promise.all([qc.invalidateQueries({queryKey:['off_market_brieven','vastgoedkans',vastgoedkansId]}),qc.invalidateQueries({queryKey:['off-market-acquisitie-selectie']}),qc.invalidateQueries({queryKey:['off-market-acquisitie-productiekern']})]);
    toast.success(`Pandenverkenner-brief definitief: ${resultaat.briefnummer}`);
  }catch(e){toast.error(e instanceof Error?e.message:'Definitief maken is mislukt.')}finally{setBezigId(null)}};

  return <section className={compact?'mt-2 space-y-2':'rounded-lg border border-border bg-card p-3 space-y-2'} data-testid="pandenverkenner-productiekern-acties"><div className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-muted-foreground"/><p className="text-xs font-medium">Formele briefproductie · Pandenverkenner</p></div>{definitief.map(b=><div key={`d-${b.id}`} className="flex items-center justify-between gap-2 text-xs"><span>{label(b)}</span><span className="font-mono-data font-semibold">{(b as AcquisitieBrief&{briefnummer?:string|null}).briefnummer||'Definitief'}</span></div>)}{postConcepten.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 p-2"><div className="text-xs"><p className="font-medium">{label(b)}</p><p className="text-[11px] text-muted-foreground">BR wordt pas nu uitgegeven; het concept zelf heeft nog geen formele productie-identiteit.</p></div><Button size="sm" onClick={()=>void maakDefinitief(b)} disabled={Boolean(bezigId)}>{bezigId===b.id?<Loader2 className="h-4 w-4 animate-spin"/>:<FileCheck2 className="h-4 w-4"/>}Definitief maken (BR)</Button></div>)}{postConcepten.length===0&&definitief.length>0&&<ProductiekernPrintbatchActies vastgoedkansId={vastgoedkansId} briefIds={definitief.map(b=>b.id)}/>}</section>;
}
