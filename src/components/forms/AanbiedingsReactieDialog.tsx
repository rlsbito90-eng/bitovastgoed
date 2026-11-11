import { useEffect,useMemo,useState } from 'react';
import { toast } from 'sonner';
import { MessageSquareText } from 'lucide-react';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { useDataStore } from '@/hooks/useDataStore';
import { datumVandaagNL, AANBIED_KANALEN, type AanbiedKanaal } from '@/lib/relaties/aanbiedingRegistreren';
import {
  REACTIE_STATUS_LABELS, REACTIE_REDEN_LABELS, REACTIE_DUIDING_LABELS,
  registreerAanbiedingsReactie, ReactiePipelineNietBijgewerkt,
  controleerReactie,
  type AanbiedingsReactieStatus, type ReactieDuiding, type ReactieReden,
  type ReactieInvoer,
} from '@/lib/relaties/aanbiedingsReacties';
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  defaultObjectId?:string;
  defaultRelatieId?:string;
}
const norm=(s:string)=>s.toLocaleLowerCase('nl-NL').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');

export default function AanbiedingsReactieDialog({
  open,onOpenChange,defaultObjectId,defaultRelatieId,
}:Props){
  const store=useDataStore();
  const [objectId,setObjectId]=useState(defaultObjectId??'');
  const [relatieId,setRelatieId]=useState(defaultRelatieId??'');
  const [status,setStatus]=useState<AanbiedingsReactieStatus>('informatie_gevraagd');
  const [kanaal,setKanaal]=useState<AanbiedKanaal>('email');
  const [datum,setDatum]=useState(datumVandaagNL);
  const [redenen,setRedenen]=useState<ReactieReden[]>([]);
  const [duiding,setDuiding]=useState<ReactieDuiding>('onbekend');
  const [notitie,setNotitie]=useState('');
  const [bezig,setBezig]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setObjectId(defaultObjectId??'');setRelatieId(defaultRelatieId??'');
    setStatus('informatie_gevraagd');setKanaal('email');setDatum(datumVandaagNL());
    setRedenen([]);setDuiding('onbekend');setNotitie('');
  },[open,defaultObjectId,defaultRelatieId]);

  const relatieItems=useMemo<EntityPickerItem[]>(()=> (store.relaties??[])
    .filter(r=>!r.softDeletedAt).map(r=>{
      const n=getRelatieNamen(r,store.contactpersonen??[]);
      return {id:r.id,primair:n.primair,secundair:n.secundair,
        searchHaystack:norm([n.primair,n.secundair,r.bedrijfsnaam,r.contactpersoon]
          .filter(Boolean).join(' '))};
    }),[store.relaties,store.contactpersonen]);

  const objectItems=useMemo<EntityPickerItem[]>(()=> (store.objecten??[])
    .filter(o=>!o.softDeletedAt).map(o=>({
      id:o.id,primair:o.titel,secundair:o.plaats??undefined,
      searchHaystack:norm([o.titel,o.plaats,o.provincie].filter(Boolean).join(' ')),
    })),[store.objecten]);

  const object=store.getObjectById(objectId);
  const kandidaat=objectId && relatieId
    ? store.getPipelineVoorObject(objectId).find(k=>k.relatieId===relatieId)
    : undefined;
  const invoer:ReactieInvoer={
    objectId,relatieId,objectTitel:object?.titel??'',status,kanaal,
    datum,redenen,duiding,notitie,
  };
  const kanGeenReactie=!!kandidaat &&
    (kandidaat.teaserVerstuurd || kandidaat.informatieGedeeld ||
      ['teaser_verstuurd','informatie_gedeeld'].includes(kandidaat.pipelineFase));
  const fout=controleerReactie(invoer,datumVandaagNL()) ||
    (status==='geen_reactie'&&!kanGeenReactie
      ?'Leg eerst de oorspronkelijke aanbieding vast voordat je stilte als opvolgsignaal registreert.'
      :null);

  const veranderReden=(reden:ReactieReden,gekozen:boolean)=>{
    setRedenen(prev=>gekozen
      ?prev.includes(reden)?prev:prev.length>=5?prev:[...prev,reden]
      :prev.filter(r=>r!==reden));
  };
  const slaOp=async()=>{
    if(bezig)return;
    if(fout){toast.error(fout);return;}
    if(!store.getRelatieById(relatieId)||!object){
      toast.error('Object of relatie bestaat niet meer.');return;
    }
    setBezig(true);
    try{
      await registreerAanbiedingsReactie(invoer,{
        bestaandeKandidaat:kandidaat,
        bestaandeMomenten:store.contactMoments??[],
        maakKandidaat:store.addPipelineKandidaat,
        voegMomentToe:store.addContactMoment,
        werkKandidaatBij:store.updatePipelineKandidaat,
      },datumVandaagNL());
      toast.success(status==='geen_reactie'
        ?'Opvolgsignaal vastgelegd. Dit is geen afwijzing.'
        :'Reactie vastgelegd bij relatie én object.');
      onOpenChange(false);
    }catch(e){
      toast.error(e instanceof Error?e.message:'Reactie registreren mislukt.');
      if(e instanceof ReactiePipelineNietBijgewerkt)onOpenChange(false);
    }finally{setBezig(false);}
  };
  return <Dialog open={open} onOpenChange={next=>{if(!bezig)onOpenChange(next);}}>
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Reactie op aanbieding registreren</DialogTitle>
        <DialogDescription>
          Leg de reactie van een kandidaat vast. Er wordt niets verstuurd en
          zoekprofielen worden niet automatisch aangepast.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <EntityPicker value={objectId} onChange={setObjectId} items={objectItems}
          label="Object" pickerTitle="Kies object"
          searchPlaceholder="Zoek object" emptyLabel="Kies object"/>
        <EntityPicker value={relatieId} onChange={setRelatieId} items={relatieItems}
          label="Relatie" pickerTitle="Kies kandidaat"
          searchPlaceholder="Zoek belegger" emptyLabel="Kies relatie"/>
        <div className="space-y-1.5">
          <Label htmlFor="reactie-status">Reactie</Label>
          <select id="reactie-status" value={status}
            onChange={e=>{
              const gekozen=e.target.value as AanbiedingsReactieStatus;
              setStatus(gekozen);
              if(gekozen==='geen_reactie'){setRedenen([]);setDuiding('onbekend');}
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {Object.entries(REACTIE_STATUS_LABELS).map(([key,label])=>
              <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reactie-datum">{status==='geen_reactie'?'Datum controle':'Datum reactie'}</Label>
            <Input id="reactie-datum" type="date" max={datumVandaagNL()}
              value={datum} onChange={e=>setDatum(e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reactie-kanaal">Kanaal</Label>
            <select id="reactie-kanaal" value={kanaal}
              onChange={e=>setKanaal(e.target.value as AanbiedKanaal)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {Object.entries(AANBIED_KANALEN).map(([key,label])=>
                <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </div>
        {status==='geen_reactie'&&<p className="text-sm text-muted-foreground">
          Dit is uitsluitend een intern opvolgsignaal. De kandidaat wordt
          niet op ‘Afgevallen’ gezet en er wordt geen afwijzing aangenomen.
        </p>}
        {status!=='geen_reactie'&&<>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Reden(en) (optioneel, maximaal 5)</legend>
          <div className="grid sm:grid-cols-2 gap-x-3 gap-y-1 max-h-44 overflow-y-auto rounded border p-2">
            {(Object.entries(REACTIE_REDEN_LABELS) as Array<[ReactieReden,string]>).map(([key,label])=>
              <label key={key} className="flex items-start gap-2 text-xs cursor-pointer py-1.5">
                <input type="checkbox" checked={redenen.includes(key)}
                  disabled={!redenen.includes(key)&&redenen.length>=5}
                  onChange={e=>veranderReden(key,e.target.checked)}/>
                <span>{label}</span>
              </label>)}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="reactie-duiding">Waar lijkt het vooral aan te liggen?</Label>
          <select id="reactie-duiding" value={duiding}
            onChange={e=>setDuiding(e.target.value as ReactieDuiding)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {Object.entries(REACTIE_DUIDING_LABELS).map(([key,label])=>
              <option key={key} value={key}>{label}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">
            Dit is jouw voorlopige duiding, geen bewezen oordeel over de koper of de prijs.
          </p>
        </div>
        </>}
        <div className="space-y-1.5">
          <Label htmlFor="reactie-notitie">Wat zei de koper? (optioneel)</Label>
          <Textarea id="reactie-notitie" rows={3} value={notitie}
            onChange={e=>setNotitie(e.target.value)}
            placeholder="Bijv. aantrekkelijk, maar eerst de actuele huurcontracten ontvangen"/>
        </div>
        {!!fout&&<p role="alert" className="text-sm text-destructive">{fout}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={bezig}
          onClick={()=>onOpenChange(false)}>Annuleren</Button>
        <Button type="button" disabled={bezig||!!fout} onClick={()=>void slaOp()}>
          <MessageSquareText className="h-4 w-4 mr-1.5"/>
          {bezig?'Registreren…':'Reactie opslaan'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
