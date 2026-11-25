import { ArrowDown, CheckCircle2 } from 'lucide-react';
import type { ProfielCheckRoute, ProfielCheckPunt } from '@/lib/matching/kopersprofielCheck';

export default function KopersprofielCheckPanel({routes,loading,fout,onGaNaar}:{
  routes:readonly ProfielCheckRoute[];loading:boolean;fout:boolean;
  onGaNaar:(punt:ProfielCheckPunt,profielId:string|null)=>void;
}){
  if(!routes.length)return null;
  const aantal=routes.reduce((n,r)=>n+r.punten.length,0);
  return <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Kopersprofiel verbeteren">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="section-title">Kopersprofiel verbeteren</h2>
        <p className="text-xs text-muted-foreground mt-1">Gerichte vragen voor je volgende contactmoment. Een open punt is geen afwijzing.</p>
      </div>
      {!loading&&!fout&&<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{aantal} open</span>}
    </div>
    {loading||fout?<p className="text-xs text-muted-foreground">{fout?'Profielcheck niet volledig beschikbaar.':'Profielcheck laden…'}</p>:
      aantal===0?<p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600"/> Basiscriteria vastgelegd; inhoudelijke bevestiging blijft nodig.</p>:
      routes.filter(r=>r.punten.length).map(r=><details key={r.id??'basis'} open={routes.length===1||r.id===null} className="rounded-md border border-border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium">{r.naam} · {r.punten.length} open</summary>
        <div className="divide-y divide-border/70 border-t border-border/70">
          {r.punten.map(p=><div key={p.id} className="flex items-start gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.label}</p><p className="text-xs text-muted-foreground mt-1">{p.vraag}</p></div>
            <button type="button" onClick={()=>onGaNaar(p,r.id)} aria-label={p.label+' aanpassen'} className="shrink-0 rounded-md border border-border px-2 py-2 text-xs hover:bg-muted flex items-center gap-1"><ArrowDown className="h-3 w-3"/> Aanpassen</button>
          </div>)}
        </div>
      </details>)}
  </section>;
}
