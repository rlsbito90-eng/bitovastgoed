import { useMemo, useState } from 'react';
import { gemeentenVoorProvincies } from '@/lib/geo/gemeenten2026';
import { Input } from '@/components/ui/input';

interface Props {
  provincies: readonly string[];
  gekozen: readonly string[];
  onChange: (gemeenten: string[]) => void;
}
/** In een profiel meerdere gemeenten selecteren, beperkt tot de gekozen provincies. */
export default function GemeentePicker({provincies,gekozen,onChange}: Props) {
  const [zoek,setZoek]=useState('');
  const opties=useMemo(()=>gemeentenVoorProvincies(provincies),[provincies]);
  const zichtbaar=opties.filter(n=>n.toLocaleLowerCase('nl-NL').includes(zoek.trim().toLocaleLowerCase('nl-NL')));
  return <div className="space-y-2" aria-label="Gemeenten selecteren">
    <p className="text-xs text-muted-foreground">Selecteer eerst een provincie. Gemeenten beperken het zoekgebied binnen deze provincie.
      Als de gemeente van een object onbekend is, krijgt de match de status te controleren.
    </p>
    {gekozen.length>0 && <div className="flex flex-wrap gap-2" aria-label="Geselecteerde gemeenten">
      {gekozen.map(g=><button key={g} type="button" onClick={()=>onChange(gekozen.filter(n=>n!==g))}
        className="px-2 py-1 rounded border text-xs hover:bg-muted" title={'Verwijder '+g}>{g} ×</button>)}
    </div>}
    {opties.length===0
      ? <p className="text-xs text-muted-foreground">Kies één of meer provincies (niet alleen ‘Heel Nederland’ of ‘Randstad’) om gemeenten te selecteren.</p>
      : <>
        <Input value={zoek} onChange={e=>setZoek(e.target.value)}
          placeholder={`Zoek in ${opties.length} gemeenten…`} aria-label="Gemeente zoeken"/>
        <div className="max-h-44 overflow-y-auto border rounded-md p-2 space-y-1" role="group" aria-label="Gemeenten uit gekozen provincie">
          {zichtbaar.slice(0,40).map(g=><label key={g} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
            <input type="checkbox" checked={gekozen.includes(g)}
              onChange={e=>onChange(e.target.checked?[...gekozen,g]:gekozen.filter(x=>x!==g))}/>
            {g}
          </label>)}
          {zichtbaar.length>40 && <p className="text-xs text-muted-foreground px-2">Typ een naam om meer resultaten te zien.</p>}
          {!zichtbaar.length && <p className="text-xs text-muted-foreground px-2">Geen gemeente gevonden.</p>}
        </div>
      </>}
    {gekozen.some(x=>!opties.includes(x)) && <p className="text-xs text-destructive">
      Een eerder geselecteerde gemeente valt buiten de huidige provincieselectie. Verwijder die keuze of selecteer de bijbehorende provincie.
    </p>}
  </div>;
}
