import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Taak } from '@/data/mock-data';
import { useDataStore } from '@/hooks/useDataStore';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import { deadlineLabel, isTaakTeLaat } from '@/lib/taakHelpers';

type Props={
  taken:readonly Taak[];
  titel?:string;
  embedded?:boolean;
  defaultRelatieId?:string;
  defaultObjectId?:string;
};

/** In beide dossiers hetzelfde patroon: direct afronden, andere wijzigingen
 * met een compacte taakdialoog, alle open taken onder één klik.
 */
export default function DossierTakenPanel({
  taken,titel='Open taken',embedded=false,defaultRelatieId,defaultObjectId,
}:Props){
  const {updateTaak}=useDataStore();
  const [toonAlle,setToonAlle]=useState(false);
  const [open,setOpen]=useState(false);
  const [geselecteerd,setGeselecteerd]=useState<Taak|null>(null);
  const [bezig,setBezig]=useState<string|null>(null);
  const zichtbaar=toonAlle?taken:taken.slice(0,3);
  const resterend=Math.max(0,taken.length-zichtbaar.length);

  function edit(taak:Taak|null){
    setGeselecteerd(taak);
    setOpen(true);
  }
  async function rondAf(taak:Taak){
    setBezig(taak.id);
    try{
      await updateTaak(taak.id,{status:'afgerond'});
      toast.success('Taak afgerond',{
        action:{label:'Ongedaan maken',onClick:()=>{
          void updateTaak(taak.id,{status:taak.status})
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      toast.error(e instanceof Error?e.message:'Afronden mislukt');
    }finally{setBezig(null);}
  }
  return <section className={embedded?'space-y-2':'section-card'} aria-label={titel}>
    {!embedded&&<header className="section-header">
      <h2 className="section-title">{titel} ({taken.length})</h2>
      <button type="button" onClick={()=>edit(null)}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <Plus className="h-3.5 w-3.5"/> Taak toevoegen
      </button>
    </header>}
    {embedded&&<div className="flex justify-end">
      <button type="button" onClick={()=>edit(null)}
        className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
        <Plus className="h-3 w-3"/> Taak toevoegen
      </button>
    </div>}
    {taken.length===0&&<p className="px-4 py-3 text-sm text-muted-foreground">
      Geen open taken.
    </p>}
    {taken.length>0&&<div className="divide-y divide-border/70">
      {zichtbaar.map(taak=>{
        const wacht=taak.status==='wacht_op_reactie';
        const laat=!wacht&&isTaakTeLaat(taak);
        return <div key={taak.id} className="flex items-center justify-between gap-2 px-3 py-3">
          <button type="button" onClick={()=>edit(taak)}
            className="min-w-0 flex-1 text-left group">
            <p className="text-sm text-foreground group-hover:text-accent break-words">
              {taak.titel}
            </p>
            <p className={`text-xs mt-1 tabular-nums ${laat?'text-destructive':'text-muted-foreground'}`}>
              {wacht?'Wachten op reactie · ':taak.status==='in_uitvoering'?'In uitvoering · ':''}
              {deadlineLabel(taak)}
              {laat?' · te laat':''}
            </p>
          </button>
          <button type="button"
            aria-label={`Rond taak ${taak.titel} af`}
            title="Afronden"
            disabled={bezig===taak.id}
            onClick={()=>void rondAf(taak)}
            className="shrink-0 rounded-md border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50">
            <Check className="h-4 w-4"/>
          </button>
        </div>;
      })}
    </div>}
    {taken.length>3&&<button type="button"
      aria-expanded={toonAlle}
      onClick={()=>setToonAlle(v=>!v)}
      className="w-full flex justify-between items-center px-4 py-3 text-xs text-muted-foreground hover:text-foreground border-t border-border/60">
      <span>{toonAlle?'Toon minder':`Toon alle taken (+${resterend})`}</span>
      <ChevronDown className={`h-4 w-4 transition-transform ${toonAlle?'rotate-180':''}`}/>
    </button>}
    <TaakFormDialog open={open}
      onOpenChange={v=>{setOpen(v);if(!v)setGeselecteerd(null);}}
      taak={geselecteerd}
      defaultRelatieId={defaultRelatieId}
      defaultObjectId={defaultObjectId}/>
  </section>;
}
