import {useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,ShieldCheck} from 'lucide-react';
import {toast} from 'sonner';
import {useDirtyGuard} from '@/hooks/useDirtyGuard';
import {
  RISICO_CATEGORIEEN,RISICO_BEREIDHEID,
  type Risicotype,type Risicobereidheid,type Risicovoorkeur,
} from '@/lib/relaties/risicovoorkeuren';
import type {RisicovoorkeurInvoer} from '@/hooks/useRelatieRisicovoorkeuren';

type Draft={
  bereidheid:Risicobereidheid|'onbekend';
  bevestigd:boolean;
  bron:string;
  toelichting:string;
};
const leeg:Draft={bereidheid:'onbekend',bevestigd:false,bron:'',toelichting:''};
function uitVoorkeur(v?:Risicovoorkeur):Draft{
  return v?{
    bereidheid:v.bereidheid,bevestigd:v.bevestigd,
    bron:v.bron??'',toelichting:v.toelichting??'',
  }:{...leeg};
}

export default function RisicovoorkeurenPanel({
  relatieId,voorkeuren,loading,fout,onSave,onDelete,
}:{
  relatieId:string;
  voorkeuren:Risicovoorkeur[];
  loading:boolean;
  fout:string|null;
  onSave:(input:RisicovoorkeurInvoer)=>Promise<Risicovoorkeur>;
  onDelete:(risicotype:Risicotype)=>Promise<void>;
}){
  const [editing,setEditing]=useState<Risicotype|null>(null);
  const [draft,setDraft]=useState<Draft>(leeg);
  const [busy,setBusy]=useState(false);
  const basis=useRef<Draft>(leeg);
  const dirty=JSON.stringify(basis.current)!==JSON.stringify(draft);
  const {confirmDiscard}=useDirtyGuard(editing!==null&&dirty);
  useEffect(()=>{
    setEditing(null);setDraft({...leeg});basis.current={...leeg};
  },[relatieId]);

  const open=(type:Risicotype)=>{
    if(busy || (editing!==null && !confirmDiscard()))return;
    const next=uitVoorkeur(voorkeuren.find(x=>x.risicotype===type));
    basis.current=next;setDraft(next);setEditing(type);
  };
  const sluit=()=>{
    if(busy || !confirmDiscard())return;
    setEditing(null);
  };
  const bewaar=async()=>{
    if(!editing||busy)return;
    setBusy(true);
    try {
      if(draft.bereidheid==='onbekend') {
        await onDelete(editing);
      }else{
        await onSave({
          risicotype:editing,bereidheid:draft.bereidheid,
          bevestigd:draft.bevestigd,
          bron:draft.bron.trim()||null,toelichting:draft.toelichting.trim()||null,
        });
      }
      setEditing(null);basis.current={...draft};
      toast.success('Risicovoorkeur opgeslagen');
    }catch(err){
      toast.error(err instanceof Error?err.message:'Risicovoorkeur kon niet worden opgeslagen');
    }finally{setBusy(false);}
  };

  return <section className="section-card">
    <header className="section-header">
      <div>
        <h2 className="section-title">Risicobereidheid</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Vastleggen wat de belegger expliciet accepteert, alleen onder voorwaarden doet of uitsluit.
        </p>
      </div>
    </header>
    {fout&&<div className="px-5 py-4 text-sm text-destructive" role="alert">
      Risicovoorkeuren zijn niet beschikbaar. Wijzigen is uitgeschakeld; controleer de databasekoppeling.
    </div>}
    {loading&&!fout&&<p className="px-5 py-3 text-xs text-muted-foreground">Risicovoorkeuren laden…</p>}
    {!loading&&!fout&&<div className="divide-y divide-border/70">
      {RISICO_CATEGORIEEN.map(item=>{
        const r=voorkeuren.find(x=>x.risicotype===item.waarde);
        const isEditing=editing===item.waarde;
        return <div key={item.waarde} className="px-4 sm:px-5 py-2.5">
          <button type="button" onClick={()=>open(item.waarde)}
            aria-expanded={isEditing}
            aria-label={`Risicovoorkeur ${item.label} wijzigen`}
            disabled={busy}
            className="flex w-full items-center gap-2 text-left rounded-md px-1 py-1.5 hover:bg-muted/35 disabled:opacity-50">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.uitleg}</span>
            </span>
            <span className="text-xs text-muted-foreground shrink-0 text-right">
              {r?RISICO_BEREIDHEID[r.bereidheid]:'Niet besproken'}
              {r?.bevestigd&&<span className="flex items-center justify-end gap-1 mt-0.5 text-[11px]">
                <ShieldCheck className="h-3 w-3"/> Bevestigd
              </span>}
              {r&&!r.bevestigd&&<span className="block mt-0.5 text-[11px]">Indicatie</span>}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isEditing?'rotate-180':''}`}/>
          </button>
          {isEditing&&<div className="mt-3 space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <label className="block space-y-1 text-xs">
              <span>Uitspraak / positie</span>
              <select value={draft.bereidheid}
                onChange={e=>setDraft(d=>({...d,bereidheid:e.target.value as Draft['bereidheid'],
                  bevestigd:e.target.value==='onbekend'?false:d.bevestigd}))}
                className="w-full rounded-md border border-input bg-background p-2 text-sm">
                <option value="onbekend">Niet besproken / wissen</option>
                {Object.entries(RISICO_BEREIDHEID).map(([key,label])=>
                  <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            {draft.bereidheid!=='onbekend'&&<>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={draft.bevestigd}
                  onChange={e=>setDraft(d=>({...d,bevestigd:e.target.checked}))}/>
                Door de belegger bevestigd
              </label>
              <label className="block space-y-1 text-xs">
                <span>Bron {draft.bevestigd?'(verplicht)':'(optioneel)'}</span>
                <input value={draft.bron}
                  onChange={e=>setDraft(d=>({...d,bron:e.target.value}))}
                  placeholder="Bijv. telefoongesprek of e-mail van 23-11-2026"
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"/>
              </label>
              <label className="block space-y-1 text-xs">
                <span>Voorwaarden / toelichting (optioneel)</span>
                <textarea rows={2} value={draft.toelichting}
                  onChange={e=>setDraft(d=>({...d,toelichting:e.target.value}))}
                  placeholder="Bijv. alleen bij korting, voldoende rendement of vergunning onder voorbehoud"
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"/>
              </label>
            </>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={sluit} disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-xs">Annuleren</button>
              <button type="button" onClick={()=>void bewaar()} disabled={busy||!dirty||
                (draft.bevestigd&&!draft.bron.trim())}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-50">
                <Check className="h-3.5 w-3.5"/>{busy?'Opslaan…':'Opslaan'}
              </button>
            </div>
          </div>}
        </div>;
      })}
    </div>}
    <div className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
      Onbekend is geen acceptatie. Indicaties zijn geen harde uitsluitingen.
      Alleen een bevestigde uitspraak én verifieerbaar objectrisico mogen later een
      automatische uitsluitingsgrond vormen. De huidige matching wijzigt hierdoor nog niet.
    </div>
  </section>;
}
