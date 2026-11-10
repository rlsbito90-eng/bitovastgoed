import { useEffect, useId, useMemo, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GEMEENTEN_2026_PER_PROVINCIE } from '@/lib/geo/gemeenten2026';
import { zoekPdokWoonplaatsen, type BagAdresResultaat } from '@/lib/bag/pdokLookup';

export interface ZoekgebiedKeuze {
  gemeenten: string[];
  plaatsen: string[];
}

interface Props {
  gemeenten: readonly string[];
  plaatsen: readonly string[];
  onChange: (selectie: ZoekgebiedKeuze) => void;
  id?: string;
}

const gemeenteOpties=Object.entries(GEMEENTEN_2026_PER_PROVINCIE)
  .flatMap(([provincie,namen])=>namen.map(naam=>({naam,provincie})))
  .sort((a,b)=>a.naam.localeCompare(b.naam,'nl-NL'));
const canon=(s:string)=>s.toLocaleLowerCase('nl-NL').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').trim();

/** Eén zoekveld voor officiële plaatsen én gemeenten, met typegebonden opslag.
 * Er wordt pas een netwerkverzoek gedaan nadat de gebruiker minimaal twee
 * letters typt. De selectie heeft nooit automatisch gevolgen voor provincies.
 */
export default function ZoekgebiedPicker({gemeenten,plaatsen,onChange,id}:Props){
  const uid=useId();
  const veldId=id??uid;
  const [zoek,setZoek]=useState('');
  const [gevondenPlaatsen,setGevondenPlaatsen]=useState<BagAdresResultaat[]>([]);
  const [bezig,setBezig]=useState(false);
  const [gezocht,setGezocht]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const q=canon(zoek);

  const gemeenteResultaten=useMemo(()=>
    q.length<2?[]:gemeenteOpties.filter(x=>canon(x.naam).includes(q)).slice(0,12),
    [q],
  );

  useEffect(()=>{
    if(q.length<2){
      setGevondenPlaatsen([]);setFout(null);setBezig(false);setGezocht(false);
      return;
    }
    const controller=new AbortController();
    setGevondenPlaatsen([]);setFout(null);setBezig(true);setGezocht(false);
    const timer=window.setTimeout(()=>{
      void zoekPdokWoonplaatsen(zoek.trim(),{rows:15,signal:controller.signal})
        .then(docs=>{
          if(controller.signal.aborted)return;
          const gezien=new Set<string>();
          setGevondenPlaatsen(docs.filter(doc=>{
            const naam=(doc.woonplaats??doc.weergavenaam).trim();
            if(!naam||gezien.has(canon(naam)))return false;
            gezien.add(canon(naam));return true;
          }));
          setGezocht(true);
        })
        .catch(()=>{
          if(!controller.signal.aborted)setFout('Woonplaatsen konden niet worden opgehaald. Probeer opnieuw.');
        })
        .finally(()=>{
          if(!controller.signal.aborted)setBezig(false);
        });
    },350);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  },[zoek,q]);

  const geselecteerd=(lijst:readonly string[],naam:string)=>lijst.some(x=>canon(x)===canon(naam));
  const kies=(type:'gemeente'|'plaats',naam:string)=>{
    const isGemeente=type==='gemeente';
    const lijst=isGemeente?gemeenten:plaatsen;
    const volgende=geselecteerd(lijst,naam)
      ?lijst.filter(x=>canon(x)!==canon(naam))
      :[...lijst,naam];
    onChange({
      gemeenten:isGemeente?[...volgende]:[...gemeenten],
      plaatsen:isGemeente?[...plaatsen]:[...volgende],
    });
    setZoek('');
  };

  return <div className="space-y-2 min-w-0" aria-label="Zoekgebied selecteren">
    {(plaatsen.length>0||gemeenten.length>0)&&
      <div className="flex flex-wrap gap-2" aria-label="Geselecteerd zoekgebied">
        {plaatsen.map((naam,i)=><button key={'plaats:'+naam+i} type="button"
          aria-label={'Verwijder plaats '+naam}
          title={'Plaats '+naam+' verwijderen'} onClick={()=>kies('plaats',naam)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
          <MapPin className="h-3 w-3"/><span>Plaats: {naam}</span><X className="h-3 w-3"/>
        </button>)}
        {gemeenten.map((naam,i)=><button key={'gemeente:'+naam+i} type="button"
          aria-label={'Verwijder gemeente '+naam}
          title={'Gemeente '+naam+' verwijderen'} onClick={()=>kies('gemeente',naam)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
          <span>Gemeente: {naam}</span><X className="h-3 w-3"/>
        </button>)}
      </div>}
    <Input id={veldId} value={zoek} autoComplete="off"
      aria-label="Zoek plaats of gemeente" placeholder="Zoek bijvoorbeeld Apeldoorn of Deventer"
      onChange={e=>setZoek(e.target.value)}/>
    {q.length>0&&q.length<2&&<p className="text-xs text-muted-foreground">Typ minimaal twee letters.</p>}
    {q.length>=2&&<div className="max-h-56 overflow-y-auto rounded-md border border-border p-2 space-y-2"
      role="group" aria-label="Zoekresultaten plaatsen en gemeenten">
      <div role="group" aria-label="Plaatsen">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Plaatsen en steden</p>
        {gevondenPlaatsen.map(doc=>{
          const naam=(doc.woonplaats??doc.weergavenaam).trim();
          return <label key={'plaats:'+doc.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
            <input type="checkbox" checked={geselecteerd(plaatsen,naam)} onChange={()=>kies('plaats',naam)}/>
            <span>{naam}</span><span className="ml-auto text-xs text-muted-foreground">Plaats</span>
          </label>;
        })}
        {bezig&&<p className="flex items-center gap-1 px-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3 w-3 animate-spin"/> Plaatsen zoeken…
        </p>}
        {!bezig&&gezocht&&gevondenPlaatsen.length===0&&<p className="px-2 text-xs text-muted-foreground">
          Geen woonplaats gevonden.
        </p>}
        {fout&&<p role="alert" className="px-2 text-xs text-destructive">{fout}</p>}
      </div>
      {gemeenteResultaten.length>0&&<div role="group" aria-label="Gemeenten">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Gemeenten (hele gemeente)</p>
        {gemeenteResultaten.map(g=><label key={'gemeente:'+g.provincie+g.naam}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
          <input type="checkbox" checked={geselecteerd(gemeenten,g.naam)} onChange={()=>kies('gemeente',g.naam)}/>
          <span>{g.naam}</span>
          <span className="ml-auto text-xs text-muted-foreground">{g.provincie}</span>
        </label>)}
      </div>}
      {!bezig&&gezocht&&!gevondenPlaatsen.length&&!gemeenteResultaten.length&&!fout&&
        <p className="px-2 text-xs text-muted-foreground">Geen plaats of gemeente gevonden.</p>}
    </div>}
    <p className="text-xs text-muted-foreground">
      Kies ‘Plaats’ voor één woonplaats, of ‘Gemeente’ als ook andere kernen binnen die gemeente meetellen.
      Een provincie selecteren is niet nodig.
    </p>
  </div>;
}
