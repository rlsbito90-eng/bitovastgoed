import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AANBIED_KANALEN, datumVandaagNL, heeftZelfdeAanbieding,
  registreerAanbieding, GedeeltelijkeAanbiedingRegistratie,
  type AanbiedSoort, type AanbiedKanaal, type AanbiedingInvoer,
} from '@/lib/relaties/aanbiedingRegistreren';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultObjectId?: string;
  defaultRelatieId?: string;
}

const zoekSleutel=(waarde:string)=>
  waarde.toLocaleLowerCase('nl-NL').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');

/** Gedeeld aanbod vastleggen, NIET verzenden. Één scherm vanuit object en relatie. */
export default function AanbiedingRegistrerenDialog({
  open,onOpenChange,defaultObjectId,defaultRelatieId,
}:Props){
  const store=useDataStore();
  const [objectId,setObjectId]=useState(defaultObjectId??'');
  const [relatieId,setRelatieId]=useState(defaultRelatieId??'');
  const [datum,setDatum]=useState(datumVandaagNL);
  const [soort,setSoort]=useState<AanbiedSoort>('teaser');
  const [kanaal,setKanaal]=useState<AanbiedKanaal>('email');
  const [notitie,setNotitie]=useState('');
  const [bezig,setBezig]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setObjectId(defaultObjectId??'');
    setRelatieId(defaultRelatieId??'');
    setDatum(datumVandaagNL());
    setSoort('teaser');
    setKanaal('email');
    setNotitie('');
  },[open,defaultObjectId,defaultRelatieId]);

  const relaties=useMemo<EntityPickerItem[]>(()=>(store.relaties??[])
    .filter(r=>!r.softDeletedAt).map(r=>{
      const namen=getRelatieNamen(r,store.contactpersonen??[]);
      return {
        id:r.id,primair:namen.primair,secundair:namen.secundair,
        searchHaystack:zoekSleutel([
          namen.primair,namen.secundair,r.bedrijfsnaam,r.contactpersoon,
        ].filter(Boolean).join(' ')),
      };
    }),[store.relaties,store.contactpersonen]);

  const objecten=useMemo<EntityPickerItem[]>(()=>(store.objecten??[])
    .filter(o=>!o.softDeletedAt).map(o=>({
      id:o.id,primair:o.titel,secundair:o.plaats || undefined,
      searchHaystack:zoekSleutel([o.titel,o.plaats,o.provincie].filter(Boolean).join(' ')),
    })),[store.objecten]);

  const object=store.getObjectById(objectId);
  const bestaande=objectId&&relatieId
    ?store.getPipelineVoorObject(objectId).find(k=>k.relatieId===relatieId)
    :undefined;
  const invoer:AanbiedingInvoer={
    objectId,relatieId,objectTitel:object?.titel??'',
    datum,soort,kanaal,notitie,
  };
  const dubbel=objectId&&relatieId&&datum
    ?heeftZelfdeAanbieding(store.contactMoments??[],invoer):false;

  const slaOp=async()=>{
    if(bezig)return;
    if(!store.getObjectById(objectId) || !store.getRelatieById(relatieId)){
      toast.error('Selecteer een bestaande relatie en een bestaand object.');
      return;
    }
    setBezig(true);
    try{
      await registreerAanbieding(invoer,{
        bestaandeKandidaat:bestaande,
        bestaandeMomenten:store.contactMoments??[],
        voegKandidaatToe:store.addPipelineKandidaat,
        werkKandidaatBij:store.updatePipelineKandidaat,
        voegMomentToe:store.addContactMoment,
      });
      toast.success('Aanbieding vastgelegd in de CRM. Er is niets verzonden.');
      onOpenChange(false);
    }catch(e){
      toast.error(e instanceof Error ? e.message : 'Registreren mislukt.');
      // Bij een gedeeltelijke registratie blijft het formulier open om
      // het ontbrekende contactmoment opnieuw te kunnen proberen.
      if(e instanceof GedeeltelijkeAanbiedingRegistratie)return;
    }finally{setBezig(false);}
  };

  return <Dialog open={open} onOpenChange={next=>{if(!bezig)onOpenChange(next);}}>
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Aanbieding registreren</DialogTitle>
        <DialogDescription>
          Leg vast wat je al naar een belegger hebt gestuurd. Deze actie verstuurt
          zelf geen e-mail, WhatsApp of teaser.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <EntityPicker value={objectId} onChange={setObjectId}
          items={objecten} label="Object" pickerTitle="Kies het aangeboden object"
          searchPlaceholder="Zoek object of plaats" emptyLabel="Selecteer een object"/>
        <EntityPicker value={relatieId} onChange={setRelatieId}
          items={relaties} label="Ontvanger" pickerTitle="Kies de belegger / relatie"
          searchPlaceholder="Zoek naam of bedrijf" emptyLabel="Selecteer een relatie"/>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="aanbieding-soort">Wat is gedeeld?</Label>
            <select id="aanbieding-soort" value={soort}
              onChange={e=>setSoort(e.target.value as AanbiedSoort)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="teaser">Teaser / eerste aanbieding</option>
              <option value="informatie">Volledige propositie / informatie / IM</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aanbieding-datum">Datum verstuurd</Label>
            <Input id="aanbieding-datum" type="date" value={datum}
              max={datumVandaagNL()} onChange={e=>setDatum(e.target.value)}/>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aanbieding-kanaal">Via welk kanaal?</Label>
          <select id="aanbieding-kanaal" value={kanaal}
            onChange={e=>setKanaal(e.target.value as AanbiedKanaal)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {Object.entries(AANBIED_KANALEN).map(([key,value])=>
              <option key={key} value={key}>{value}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aanbieding-notitie">Toelichting (optioneel)</Label>
          <Textarea id="aanbieding-notitie" value={notitie}
            onChange={e=>setNotitie(e.target.value)} rows={2}
            placeholder="Bijv. geanonimiseerde aanbieding, IM op verzoek, mondeling besproken"/>
        </div>
        {bestaande?.pipelineFase==='afgevallen'&&<p className="text-xs text-muted-foreground">
          Deze kandidaat staat op ‘Afgevallen’. Het vastleggen van de aanbieding
          zal die fase niet wijzigen.
        </p>}
        {!!dubbel&&<p className="text-sm text-destructive" role="alert">
          Deze soort aanbieding is op deze datum al als contactmoment vastgelegd
          voor dit object en deze relatie. Controleer de bestaande tijdlijn.
        </p>}
        <p className="text-xs text-muted-foreground">
          De registratie verschijnt bij zowel Objecten als Relaties. Bestaat nog
          geen kandidaatpositie voor deze combinatie, dan wordt die aangemaakt.
          Een gewone interessepeiling zonder objectinformatie hoort als
          contactmoment te worden vastgelegd, niet als verstuurde aanbieding.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}
          disabled={bezig}>Annuleren</Button>
        <Button type="button" onClick={()=>void slaOp()}
          disabled={bezig||!objectId||!relatieId||!datum||!!dubbel}>
          <Send className="h-4 w-4 mr-1.5"/>
          {bezig?'Registreren…':'Aanbieding vastleggen'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
