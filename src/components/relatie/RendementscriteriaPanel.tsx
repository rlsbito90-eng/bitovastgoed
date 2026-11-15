import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Zoekprofiel } from '@/data/mock-data';
import type { Rendementscriterium, Rendementsinvoer, RendementMethode,
  RendementStrategie, RendementType } from '@/hooks/useRelatieMatchingData';

const STRATEGIEEN: Record<RendementStrategie,string> = {
  belegging:'Vastgoedbelegging', ontwikkeling:'Ontwikkeling', transformatie:'Transformatie',
  handel:'Handel / doorverkoop', overig:'Overig', onbekend:'Strategie onbekend',
};
const METHODEN: Record<RendementMethode,string> = {
  bar:'BAR',nar:'NAR',gdv_marge:'Winstmarge op GDV',projectkosten:'Rendement op projectkosten',
  eigen_vermogen:'Cash-on-cash / eigen vermogen',irr:'IRR (jaarlijks)',
  netto_onbekend:'Netto rendement — definitie onbekend',overig:'Overig',onbekend:'Methode onbekend',
};
const TYPES: Record<RendementType,string> = {
  minimum:'Hard minimum',doel:'Gewenst doel',gemiddeld:'Gemiddeld rendement',
  historisch:'Historisch gerealiseerd',
};
type Draft = Omit<Rendementsinvoer,'percentage'> & {percentage:string};
const nieuw:Draft={strategie:'belegging',methode:'onbekend',percentage:'',
  criteriumType:'doel',methodeBevestigd:false,zoekprofielId:null,toelichting:null,bron:null};

export default function RendementscriteriaPanel({
  criteria,zoekprofielen,loading,onSave,onDelete,
}:{
  criteria: Rendementscriterium[];
  zoekprofielen: Zoekprofiel[];
  loading:boolean;
  onSave:(input:Rendementsinvoer,id?:string)=>Promise<Rendementscriterium>;
  onDelete:(id:string)=>Promise<void>;
}){
  const [editing,setEditing]=useState<string|null>(null);
  const [draft,setDraft]=useState<Draft>(nieuw);
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState<'klaar'|'bezig'|'opgeslagen'|'fout'>('klaar');
  const [busy,setBusy]=useState(false);
  const lastRef=useRef('');
  const active=criteria.filter(x=>x.status==='actief');

  function start(c?:Rendementscriterium){
    setEditing(c?.id??'nieuw');
    setDraft(c?{strategie:c.strategie,methode:c.methode,percentage:String(c.percentage),
      criteriumType:c.criteriumType,methodeBevestigd:c.methodeBevestigd,
      zoekprofielId:c.zoekprofielId,toelichting:c.toelichting,bron:c.bron}:{...nieuw});
    setDirty(false);setStatus('klaar');lastRef.current='';
  }
  function wijzig(p:Partial<Draft>){setDraft(d=>({...d,...p}));setDirty(true);setStatus('bezig');}
  async function bewaar(d:Draft,id?:string) {
    const percentage=d.percentage.trim()===''?NaN:Number(d.percentage.replace(',','.'));
    if(!Number.isFinite(percentage)||percentage<0||percentage>1000) {
      setStatus('fout');return;
    }
    const data: Rendementsinvoer={...d,percentage};
    const fingerprint=JSON.stringify({id,data});
    if(id && fingerprint===lastRef.current){setStatus('opgeslagen');return;}
    setBusy(true);
    try{
      const saved=await onSave(data,id);
      lastRef.current=fingerprint;
      setStatus('opgeslagen');
      setDirty(false);
      if(!id) setEditing(null);
      else if(saved.id!==id) setEditing(saved.id);
    }catch(e){
      setStatus('fout');
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!editing||editing==='nieuw'||!dirty||busy)return;
    const timeout=setTimeout(()=>{void bewaar(draft,editing);},850);
    return ()=>clearTimeout(timeout);
    // Draft changes are the debounce trigger; the server response does not trigger another write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[editing,draft,dirty,busy]);

  return <section className="section-card">
    <header className="section-header">
      <h2 className="section-title">Rendementscriteria</h2>
      <button type="button" onClick={()=>start()} className="inline-flex items-center gap-1 text-xs font-medium text-accent">
        <Plus className="h-3.5 w-3.5"/> Toevoegen
      </button>
    </header>
    {loading&&<p className="px-5 py-3 text-xs text-muted-foreground">Rendementscriteria laden…</p>}
    <div className="divide-y divide-border/70">
      {!loading&&active.length===0&&editing!=='nieuw'&&
        <p className="px-5 py-4 text-sm text-muted-foreground">Nog geen rendementscriteria vastgelegd.</p>}
      {active.map(c=><div key={c.id} className="px-5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{STRATEGIEEN[c.strategie]} · {c.percentage.toLocaleString('nl-NL')}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {TYPES[c.criteriumType]} · {METHODEN[c.methode]}
            </p>
            {(!c.methodeBevestigd||c.methode==='onbekend'||c.methode==='netto_onbekend')&&
              <p className="text-xs text-muted-foreground mt-1">Berekeningsmethode nog verifiëren</p>}
            {c.toelichting&&<p className="text-xs text-muted-foreground mt-1">{c.toelichting}</p>}
          </div>
          <button type="button" aria-label="Rendementscriterium bewerken" onClick={()=>start(c)}
            className="rounded border border-border p-2 text-muted-foreground hover:text-accent">
            <Pencil className="h-3.5 w-3.5"/>
          </button>
        </div>
        {editing===c.id&&<Editor draft={draft} wijzig={wijzig} zoekprofielen={zoekprofielen}
          status={status} busy={busy} onSave={()=>void bewaar(draft,c.id)}
          onClose={()=>setEditing(null)} onDelete={async()=>{
            try{await onDelete(c.id);setEditing(null);toast.success('Criterium gearchiveerd');}
            catch(e){toast.error(e instanceof Error?e.message:'Verwijderen mislukt');}
          }}/>}
      </div>)}
      {editing==='nieuw'&&<div className="px-5 py-4">
        <p className="text-sm font-medium mb-3">Nieuw rendementscriterium</p>
        <Editor draft={draft} wijzig={wijzig} zoekprofielen={zoekprofielen} status={status}
          busy={busy} onSave={()=>void bewaar(draft)} onClose={()=>setEditing(null)}/>
      </div>}
    </div>
  </section>;
}

function Editor({draft,wijzig,zoekprofielen,status,busy,onSave,onClose,onDelete}:{
  draft:Draft;wijzig:(x:Partial<Draft>)=>void;zoekprofielen:Zoekprofiel[];
  status:string;busy:boolean;onSave:()=>void;onClose:()=>void;onDelete?:()=>void;
}){
  return <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 space-y-3 text-xs">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="space-y-1"><span>Strategie</span>
        <select value={draft.strategie} onChange={e=>wijzig({strategie:e.target.value as RendementStrategie})}
          className="w-full rounded border border-input bg-background p-2">
          {Object.entries(STRATEGIEEN).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="space-y-1"><span>Percentage</span>
        <input inputMode="decimal" value={draft.percentage} onChange={e=>wijzig({percentage:e.target.value})}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onSave();}}}
          placeholder="Bijv. 8,5" className="w-full rounded border border-input bg-background p-2"/>
      </label>
      <label className="space-y-1"><span>Betekenis</span>
        <select value={draft.criteriumType} onChange={e=>wijzig({criteriumType:e.target.value as RendementType})}
          className="w-full rounded border border-input bg-background p-2">
          {Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="space-y-1"><span>Berekeningsmethode</span>
        <select value={draft.methode} onChange={e=>wijzig({methode:e.target.value as RendementMethode,methodeBevestigd:false})}
          className="w-full rounded border border-input bg-background p-2">
          {Object.entries(METHODEN).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </label>
    </div>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={draft.methodeBevestigd}
        disabled={['onbekend','netto_onbekend'].includes(draft.methode)}
        onChange={e=>wijzig({methodeBevestigd:e.target.checked})}/>
      Berekeningsmethode door investeerder bevestigd
    </label>
    {zoekprofielen.length>0&&<label className="block space-y-1">
      <span>Geldt voor</span>
      <select value={draft.zoekprofielId??''} onChange={e=>wijzig({zoekprofielId:e.target.value||null})}
        className="w-full rounded border border-input bg-background p-2">
        <option value="">Algemene investeringsstrategie</option>
        {zoekprofielen.map(z=><option key={z.id} value={z.id}>{z.naam}</option>)}
      </select>
    </label>}
    <label className="block space-y-1"><span>Toelichting</span>
      <textarea value={draft.toelichting??''} onChange={e=>wijzig({toelichting:e.target.value||null})}
        rows={2} className="w-full rounded border border-input bg-background p-2"/>
    </label>
    <label className="block space-y-1"><span>Bron</span>
      <input value={draft.bron??''} onChange={e=>wijzig({bron:e.target.value||null})}
        className="w-full rounded border border-input bg-background p-2"/>
    </label>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground">
        {status==='opgeslagen'?'Opgeslagen':status==='fout'?'Controleer percentage of opslaan':
          status==='bezig'?'Wijzigingen worden opgeslagen…':''}
      </span>
      <div className="flex gap-2">
        {onDelete&&<button onClick={onDelete} className="text-destructive inline-flex items-center gap-1">
          <Trash2 className="h-3.5 w-3.5"/> Archiveren
        </button>}
        <button type="button" onClick={onClose} className="rounded border border-border px-2 py-1">Sluiten</button>
        <button type="button" onClick={onSave} disabled={busy||draft.percentage.trim()===''}
          className="rounded bg-accent px-3 py-1.5 text-accent-foreground disabled:opacity-50">Opslaan</button>
      </div>
    </div>
  </div>;
}
