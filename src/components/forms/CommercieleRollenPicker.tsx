import type { CommercieleRol } from '@/data/mock-data';
import { COMMERCIELE_ROLLEN } from '@/lib/relaties/commercieleRollen';

interface Props {
  value?: readonly CommercieleRol[] | null;
  onChange:(v:CommercieleRol[] | null)=>void;
}
/** Used by the CRM relation editor and synthetic browser tests. */
export default function CommercieleRollenPicker({value,onChange}:Props){
 const onbekend=value==null;
 return <fieldset className="space-y-3" aria-label="Commerciële rollen selecteren">
  <p className="text-xs text-muted-foreground">
    Eén relatie kan koper, verkoper, makelaar of bemiddelaar zijn.
    Een formeel mandaat is niet verplicht voor de match. De hoofdclassificatie blijft behouden.
  </p>
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <input type="checkbox" checked={onbekend}
      onChange={e=>onChange(e.target.checked ? null : [])}/>
    Nog niet vastgesteld
  </label>
  {!onbekend && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Rollen">
    {COMMERCIELE_ROLLEN.map(rol=>(
      <label key={rol.value} className="flex items-center gap-2 rounded-md border p-2.5 text-sm cursor-pointer">
        <input type="checkbox" checked={value?.includes(rol.value)??false}
          onChange={e=>onChange(e.target.checked
            ? [...new Set([...(value??[]),rol.value])]
            : (value??[]).filter(x=>x!==rol.value))}/>
        <span>{rol.label}</span>
      </label>
    ))}
  </div>}
  {value?.some(x=>x==='makelaar'||x==='bemiddelaar') && <p className="text-xs text-muted-foreground">
    Bij passende zoekcriteria behandelen we deze partij als direct benaderbare kandidaat.
  </p>}
 </fieldset>;
}
