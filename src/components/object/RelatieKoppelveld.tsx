import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import { getRelatieNamen } from '@/lib/relatieNaam';

type Props={
  value?:string|null;
  onChange:(relatieId:string|null)=>void;
  allowCreate?:boolean;
  label?:string;
  disabled?:boolean;
};

const norm=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');

/** Eén zoekbare relatiekeuze voor zowel nieuw als bestaand object.
 * De waarde is altijd de relatie-ID; naam, telefoon en e-mail worden
 * niet opnieuw als losse objectgegevens opgeslagen.
 */
export default function RelatieKoppelveld({
  value,onChange,allowCreate=false,label='Eigenaar / verkoper',disabled=false,
}:Props){
  const {relaties,contactpersonen}=useDataStore();
  const [nieuweRelatieOpen,setNieuweRelatieOpen]=useState(false);
  const {actief,archief}=useMemo(()=>{
    const actief:EntityPickerItem[]=[];
    const archief:EntityPickerItem[]=[];
    for(const relatie of relaties){
      if(relatie.softDeletedAt)continue;
      const namen=getRelatieNamen(relatie,contactpersonen);
      const item:EntityPickerItem={
        id:relatie.id,
        primair:namen.primair,
        secundair:namen.secundair??null,
        searchHaystack:norm([
          namen.primair,namen.secundair,relatie.bedrijfsnaam,relatie.contactpersoon,
        ].filter(Boolean).join(' ')),
      };
      ((relatie as typeof relatie & {isArchived?:boolean}).isArchived?archief:actief).push(item);
    }
    return {actief,archief};
  },[relaties,contactpersonen]);

  return <div className="space-y-2">
    <div className={disabled?'pointer-events-none opacity-50':''}>
      <EntityPicker
        label={label}
        pickerTitle="Kies eigenaar of verkoper"
        searchPlaceholder="Zoek op naam of bedrijfsnaam…"
        emptyLabel="Nog geen eigenaar gekoppeld"
        value={value??''}
        onChange={id=>{if(!disabled)onChange(id||null);}}
        items={actief}
        archivedItems={archief}
      />
    </div>
    {allowCreate&&<div>
      <button type="button" disabled={disabled}
        onClick={()=>setNieuweRelatieOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-40">
        <Plus className="h-3.5 w-3.5"/> Nieuwe relatie aanmaken
      </button>
      <RelatieFormDialog open={nieuweRelatieOpen}
        onOpenChange={setNieuweRelatieOpen}
        onCreated={id=>{onChange(id);setNieuweRelatieOpen(false);}}/>
    </div>}
  </div>;
}
