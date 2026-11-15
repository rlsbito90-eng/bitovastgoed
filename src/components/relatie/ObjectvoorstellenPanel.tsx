import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ObjectVastgoed, Relatie, Zoekprofiel } from '@/data/mock-data';
import type { RelatieObjectBesluit, Rendementscriterium } from '@/hooks/useRelatieMatchingData';
import { maakObjectVoorstellenVoorRelatie } from '@/lib/matching/relatieObjectVoorstellenR2';
import { beoordeelObjectRendement } from '@/lib/matching/rendementsOordeel';

const REDENEN:Record<string,string>={
  type:'Type vastgoed / ontwikkeling',locatie:'Locatie / zoekgebied',
  budget:'Prijs of budget',rendement:'Rendement',strategie:'Investeringsstrategie',
  huursituatie:'Huur- of verhuursituatie',staat:'Staat van onderhoud',overig:'Anders / niet passend',
};
type Props={
  relatie:Relatie;objecten:readonly ObjectVastgoed[];zoekprofielen:readonly Zoekprofiel[];
  criteria:Rendementscriterium[];besluiten:RelatieObjectBesluit[];loading:boolean;fout:string|null;
  onBesluit:(objectId:string,status:'interessant'|'afgewezen',reden?:string|null)=>Promise<void>;
  onWis:(objectId:string)=>Promise<void>;
};
export default function ObjectvoorstellenPanel({
  relatie,objecten,zoekprofielen,criteria,besluiten,loading,fout,onBesluit,onWis,
}:Props){
  const [toonControle,setToonControle]=useState(false);
  const [toonAfgewezen,setToonAfgewezen]=useState(false);
  const [redenen,setRedenen]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const matches=useMemo(()=>maakObjectVoorstellenVoorRelatie(relatie,objecten,zoekprofielen),
    [relatie,objecten,zoekprofielen]);
  const byObject=new Map(besluiten.map(b=>[b.objectId,b]));
  const beoordeeld=matches.map(x=>({
    ...x, rendement:beoordeelObjectRendement(x.object,criteria,x.voorstel.besteRoute.zoekprofielId),
    besluit:byObject.get(x.object.id),
  }));
  const interessant=besluiten.filter(b=>b.status==='interessant')
    .map(b=>({besluit:b,object:objecten.find(o=>o.id===b.objectId)}))
    .filter((x):x is {besluit:RelatieObjectBesluit;object:ObjectVastgoed}=>!!x.object);
  const nieuw=beoordeeld.filter(x=>!x.besluit);
  const direct=nieuw.filter(x=>x.voorstel.besteRoute.kwalificatie==='passend'&&
    ['niet_van_toepassing','indicatief_voldoet'].includes(x.rendement.status));
  const controle=nieuw.filter(x=>!direct.includes(x));
  const afgewezen=besluiten.filter(b=>b.status==='afgewezen').map(b=>({
    besluit:b,object:objecten.find(o=>o.id===b.objectId),
  })).filter((x):x is {besluit:RelatieObjectBesluit;object:ObjectVastgoed}=>!!x.object);

  async function beoordeel(id:string,status:'interessant'|'afgewezen') {
    setBusy(id);
    try{
      await onBesluit(id,status,status==='afgewezen'?(redenen[id]??'overig'):null);
      toast.success(status==='interessant'?'Toegevoegd aan interessant':'Voorstel afgewezen');
    }catch(e){toast.error(e instanceof Error?e.message:'Beoordeling niet opgeslagen');}
    finally{setBusy(null);}
  }
  async function reset(id:string){
    setBusy(id);
    try{await onWis(id);toast.success('Beoordeling teruggezet');}
    catch(e){toast.error(e instanceof Error?e.message:'Terugzetten mislukt');}
    finally{setBusy(null);}
  }
  function Voorstel({item}:{item:typeof beoordeeld[number]}) {
    const route=item.voorstel.besteRoute;
    const label=route.kwalificatie==='passend'?'Indicatief passend':
      route.kwalificatie==='te_verifieren'?'Controle nodig':'Onvoldoende onderbouwd';
    return <div key={item.object.id} className="px-5 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/objecten/${item.object.id}`} className="text-sm font-medium hover:text-accent break-words">
            {item.object.titel}
          </Link>
          <p className="text-xs text-muted-foreground">{item.object.plaats || 'Locatie onbekend'} · {label}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy===item.object.id} onClick={()=>void beoordeel(item.object.id,'interessant')}
          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
          <Check className="h-3.5 w-3.5"/> Interessant
        </button>
        <select aria-label="Reden niet passend" value={redenen[item.object.id]??'overig'}
          onChange={e=>setRedenen(v=>({...v,[item.object.id]:e.target.value}))}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs max-w-[180px]">
          {Object.entries(REDENEN).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" disabled={busy===item.object.id} onClick={()=>void beoordeel(item.object.id,'afgewezen')}
          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
          <X className="h-3.5 w-3.5"/> Niet passend
        </button>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Waarom voorgesteld?</summary>
        <div className="mt-2 space-y-1">
          {route.toelichting.matcht.map((t,i)=><p key={i}>✓ {t}</p>)}
          {route.toelichting.controleer.map((t,i)=><p key={i}>Nog controleren: {t}</p>)}
          {route.toelichting.afwijkend.map((t,i)=><p key={i}>{t}</p>)}
          {item.rendement.status!=='niet_van_toepassing'&&<p>Rendement: {item.rendement.uitleg}</p>}
        </div>
      </details>
    </div>;
  }

  if(fout) return <section className="section-card px-5 py-4">
    <h2 className="section-title mb-2">Objectvoorstellen</h2>
    <p className="text-sm text-destructive">Eerdere beoordelingen kunnen niet worden opgehaald. Voorstellen blijven verborgen om afwijzingen niet opnieuw te tonen.</p>
  </section>;
  return <section className="section-card">
    <header className="section-header">
      <h2 className="section-title">Objectvoorstellen</h2>
      <span className="text-xs text-muted-foreground">{interessant.length+direct.length} op shortlist</span>
    </header>
    {loading&&<p className="px-5 py-2 text-xs text-muted-foreground">Beoordelingen laden…</p>}
    <div className="divide-y divide-border/70">
      {interessant.map(({object})=><div key={'interessant-'+object.id}
        className="px-5 py-3 flex items-start justify-between gap-2">
        <div>
          <Link to={`/objecten/${object.id}`} className="text-sm font-medium hover:text-accent">{object.titel}</Link>
          <p className="text-xs text-muted-foreground mt-1">Door jou interessant bevonden</p>
        </div>
        <button type="button" disabled={busy===object.id} onClick={()=>void reset(object.id)}
          title="Beoordeling ongedaan maken"
          className="rounded border border-border p-2 text-muted-foreground disabled:opacity-50">
          <RotateCcw className="h-3.5 w-3.5"/>
        </button>
      </div>)}
      {!loading&&direct.length===0&&interessant.length===0&&
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Geen voldoende onderbouwde voorstellen. Onzekere indicaties staan hieronder apart.
        </p>}
      {!loading&&direct.slice(0,8).map(x=><Voorstel key={x.object.id} item={x}/>)}
    </div>
    {controle.length>0&&<div className="border-t border-border/70">
      <button type="button" onClick={()=>setToonControle(x=>!x)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-xs text-muted-foreground hover:bg-muted/40">
        <span>{controle.length} indicatie{controle.length===1?'':'s'} die nog controle vragen</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${toonControle?'rotate-180':''}`}/>
      </button>
      {toonControle&&<div className="divide-y divide-border/70">
        {controle.slice(0,30).map(x=><Voorstel key={x.object.id} item={x}/>)}
      </div>}
    </div>}
    {afgewezen.length>0&&<div className="border-t border-border/70">
      <button type="button" onClick={()=>setToonAfgewezen(x=>!x)}
        className="w-full px-5 py-3 text-left text-xs text-muted-foreground hover:bg-muted/40">
        {afgewezen.length} afgewezen voorstel{afgewezen.length===1?'':'len'} {toonAfgewezen?'verbergen':'tonen'}
      </button>
      {toonAfgewezen&&<div className="divide-y divide-border/70">
        {afgewezen.map(({object,besluit})=><div key={'afgewezen-'+object.id}
          className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/objecten/${object.id}`} className="text-sm hover:text-accent">{object.titel}</Link>
            <p className="text-xs text-muted-foreground">{REDENEN[besluit.redenCode??'']??'Niet passend'}</p>
          </div>
          <button type="button" disabled={busy===object.id} onClick={()=>void reset(object.id)}
            className="text-xs rounded border border-border px-2 py-1.5 disabled:opacity-50">Herstellen</button>
        </div>)}
      </div>}
    </div>}
  </section>;
}
