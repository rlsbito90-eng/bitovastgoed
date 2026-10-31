import type { Partijprofiel, VastgoedStrategie } from '@/data/mock-data';
import { PARTIJPROFIELEN, VASTGOEDSTRATEGIEEN } from '@/lib/relaties/partijprofiel';

interface Props {
  partijprofiel:Partijprofiel|null|undefined;
  vastgoedStrategieen:readonly VastgoedStrategie[]|null|undefined;
  onProfielChange:(value:Partijprofiel|null)=>void;
  onStrategieenChange:(value:VastgoedStrategie[]|null)=>void;
}
/** Descriptive party category and strategy, never a mandate or an automatic buyer role. */
export default function PartijprofielVelden({partijprofiel,vastgoedStrategieen,onProfielChange,onStrategieenChange}:Props){
  return <div className="space-y-4" aria-label="Partijprofiel en vastgoedstrategieën">
    <p className="text-sm text-muted-foreground">
      Beschrijf de partij en haar aanpak. De bestaande hoofdclassificatie en commerciële rollen
      blijven apart bestaan. Een belegger kan ook ontwikkelen, zonder automatisch koper of verkoper te worden.
    </p>
    <label className="block space-y-1 text-sm">
      <span className="font-medium">Partijprofiel (optioneel)</span>
      <select aria-label="Partijprofiel" value={partijprofiel ?? ''}
        onChange={e=>onProfielChange((e.target.value||null) as Partijprofiel|null)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">— Nog niet vastgesteld —</option>
        {PARTIJPROFIELEN.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
    </label>
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium mb-2">Vastgoedstrategie (meerdere mogelijk)</legend>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VASTGOEDSTRATEGIEEN.map(item=><label key={item.value}
          className="flex items-center gap-2 rounded-md border border-border p-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={vastgoedStrategieen?.includes(item.value)??false}
            onChange={e=>{
              const next=e.target.checked
                ? [...new Set([...(vastgoedStrategieen??[]),item.value])]
                : (vastgoedStrategieen??[]).filter(x=>x!==item.value);
              onStrategieenChange(next.length?next:null);
            }}/>
          <span>{item.label}</span>
        </label>)}
      </div>
      <p className="text-xs text-muted-foreground">Geen keuze betekent onbekend. Zoekprofielen en concrete aankoopcriteria blijven leidend voor matching.</p>
    </fieldset>
  </div>;
}
