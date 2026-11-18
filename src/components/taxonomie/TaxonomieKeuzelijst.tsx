import {useMemo,useState} from 'react';
import {Check,Search} from 'lucide-react';

export type TaxonomieOptie={id:string;label:string};

type Props={
  options:readonly TaxonomieOptie[];
  value:readonly string[];
  onChange:(next:string[])=>void;
  disabled?:boolean;
  emptyLabel?:string;
  searchPlaceholder?:string;
  searchThreshold?:number;
  maxHeight?:string;
};

/** Een rustige, doorzoekbare checklist als alternatief voor grote tegel/chiprasters.
 * Opgeslagen waarden blijven ID's; deze component wijzigt geen taxonomie.
 */
export default function TaxonomieKeuzelijst({
  options,value,onChange,disabled=false,
  emptyLabel='Geen opties beschikbaar',
  searchPlaceholder='Zoek vastgoedtype of subcategorie…',
  searchThreshold=6,
  maxHeight='max-h-56',
}:Props){
  const [query,setQuery]=useState('');
  const tekst=query.trim().toLocaleLowerCase('nl-NL');
  const volledigeOpties=useMemo(()=>{
    const unique=new Map<string,TaxonomieOptie>();
    for(const opt of options)unique.set(opt.id,opt);
    for(const id of value){
      if(!unique.has(id))unique.set(id,{id,label:`Historische keuze (${id})`});
    }
    return [...unique.values()];
  },[options,value]);
  const items=useMemo(()=>{
    return volledigeOpties
      .filter(opt=>!tekst||opt.label.toLocaleLowerCase('nl-NL').includes(tekst))
      .sort((a,b)=>{
        const aSelected=value.includes(a.id)?0:1;
        const bSelected=value.includes(b.id)?0:1;
        return aSelected-bSelected||a.label.localeCompare(b.label,'nl');
      });
  },[volledigeOpties,value,tekst]);
  const toggle=(id:string)=>{
    if(disabled)return;
    onChange(value.includes(id)?value.filter(v=>v!==id):[...value,id]);
  };
  if(!volledigeOpties.length)return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;

  return <div className="overflow-hidden rounded-lg border border-border/70 bg-background"
    data-testid="taxonomie-keuzelijst">
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
      <span className="text-xs text-muted-foreground">
        {value.length===0?'Nog niets geselecteerd':`${value.length} geselecteerd`}
      </span>
      {query&&<button type="button" onClick={()=>setQuery('')}
        className="text-xs text-accent hover:underline">Wis zoekopdracht</button>}
    </div>
    {(volledigeOpties.length>=searchThreshold||query)&&
      <label className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground"/>
        <span className="sr-only">Zoeken in classificatie</span>
        <input type="search" autoComplete="off" value={query} disabled={disabled}
          onChange={e=>setQuery(e.target.value)}
          aria-label="Zoeken in classificatie"
          placeholder={searchPlaceholder}
          className="w-full min-w-0 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"/>
      </label>}
    <div className={`${maxHeight} overflow-y-auto overscroll-contain divide-y divide-border/50`}>
      {items.map(opt=>{
        const checked=value.includes(opt.id);
        return <label key={opt.id}
          className={`flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/35
            ${checked?'bg-muted/20':''} ${disabled?'cursor-not-allowed opacity-60':''}`}>
          <input type="checkbox" checked={checked} disabled={disabled}
            onChange={()=>toggle(opt.id)}
            className="h-4 w-4 shrink-0 rounded border-border accent-[hsl(var(--accent))]"/>
          <span className="min-w-0 flex-1 break-words text-foreground">{opt.label}</span>
          {checked&&<Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true"/>}
        </label>;
      })}
      {items.length===0&&<p className="px-3 py-4 text-xs text-muted-foreground">
        Geen resultaten. Probeer een andere zoekterm.
      </p>}
    </div>
  </div>;
}
