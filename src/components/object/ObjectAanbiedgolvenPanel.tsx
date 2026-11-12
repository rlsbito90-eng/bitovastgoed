import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Send, MessageSquareText, RefreshCw } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  berekenGolfVoortgang,GOLF_STATUS_LABELS,valideerNieuweGolf,
  type AanbiedGolf,type GolfSelectie,
} from '@/lib/objecten/aanbiedGolven';
import { laadAanbiedgolven,maakNieuweAanbiedgolf } from '@/lib/objecten/aanbiedGolvenApi';
import { datumVandaagNL } from '@/lib/relaties/aanbiedingRegistreren';

interface Props {
  objectId:string;
  onAanbieding:(relatieId:string)=>void;
  onReactie:(relatieId:string)=>void;
}

/** Golfselecties hebben geen eigen kandidaatstatus en verzenden niets.
 * De voortgang wordt uitsluitend uit object_pipeline + contactmomenten gelezen.
 */
export default function ObjectAanbiedgolvenPanel({
  objectId,onAanbieding,onReactie,
}:Props){
  const store=useDataStore();
  const kandidaten=store.getPipelineVoorObject(objectId);
  const [golven,setGolven]=useState<AanbiedGolf[]>([]);
  const [selecties,setSelecties]=useState<GolfSelectie[]>([]);
  const [gekozen,setGekozen]=useState<string[]>([]);
  const [toelichting,setToelichting]=useState('');
  const [laden,setLaden]=useState(true);
  const [bezig,setBezig]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const today=datumVandaagNL();

  const refresh=async()=>{
    const data=await laadAanbiedgolven(objectId);
    setGolven(data.golven);
    setSelecties(data.selecties);
    setFout(null);
  };
  useEffect(()=>{
    let actief=true;
    setLaden(true);setFout(null);setGolven([]);setSelecties([]);setGekozen([]);
    void laadAanbiedgolven(objectId)
      .then(data=>{if(!actief)return;setGolven(data.golven);setSelecties(data.selecties);})
      .catch(e=>{if(actief)setFout(e instanceof Error?e.message:'Golven niet beschikbaar');})
      .finally(()=>{if(actief)setLaden(false);});
    return ()=>{actief=false;};
  },[objectId]);

  const bestaandeIds=useMemo(()=>new Set(selecties.map(x=>x.kandidaatId)),[selecties]);
  const beschikbaar=kandidaten.filter(k=>!bestaandeIds.has(k.id));
  const laatsteGolf=golven.length?golven[golven.length-1]:undefined;
  const laatsteKandidaten=laatsteGolf
    ?kandidaten.filter(k=>selecties.some(x=>x.golfId===laatsteGolf.id&&x.kandidaatId===k.id))
    :[];
  const laatsteVoortgang=laatsteGolf
    ?berekenGolfVoortgang(laatsteKandidaten,store.contactMoments??[],today)
    :undefined;
  const validatie=valideerNieuweGolf(gekozen,kandidaten,selecties);
  const bepaalNaam=(relatieId:string)=>{
    const r=(store.relaties??[]).find(x=>x.id===relatieId);
    return r?getRelatieDropdownLabel(r,store.contactpersonen??[]):'Relatie onbekend';
  };
  const toggle=(id:string,aan:boolean)=>{
    setGekozen(prev=>aan
      ?prev.length>=3?prev:prev.includes(id)?prev:[...prev,id]
      :prev.filter(x=>x!==id));
  };
  const slaOp=async()=>{
    if(bezig||laden||fout||gekozen.length===0)return;
    if(validatie){toast.error(validatie);return;}
    if(toelichting.length>1000){toast.error('Maximaal 1.000 tekens toelichting');return;}
    setBezig(true);
    try{
      await maakNieuweAanbiedgolf({
        objectId,kandidaatIds:gekozen,
        toelichting:toelichting.trim(),
      });
      await refresh();
      setGekozen([]);setToelichting('');
      toast.success('Aanbiedgolf samengesteld. Er is niets verstuurd.');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Aanbiedgolf kon niet worden opgeslagen.');
    }finally{setBezig(false);}
  };

  return <section className="section-card p-5 sm:p-6 space-y-4"
    data-testid="object-aanbiedgolven">
    <div className="flex flex-wrap justify-between items-start gap-2">
      <div>
        <h3 className="section-title">Aanbieden in golven</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Kies per ronde maximaal drie kandidaten. Alleen een apart
          geregistreerde teaser of propositie telt als daadwerkelijk aangeboden.
        </p>
      </div>
      <Link to={'/objecten/'+objectId+'?tab=dealflow#commercieel'}
        className="text-xs underline text-muted-foreground hover:text-primary">
        Commerciële beoordeling
      </Link>
    </div>
    {fout&&<div role="alert" className="rounded-md border border-destructive/30 p-3 text-xs text-destructive">
      Aanbiedgolven niet beschikbaar: {fout}. Controleer of de database-uitbreiding is toegepast.
      <Button size="sm" type="button" variant="outline" className="ml-2"
        onClick={()=>{setLaden(true);void refresh().catch(e=>setFout(String(e))).finally(()=>setLaden(false));}}>
        <RefreshCw className="h-3 w-3 mr-1"/> Opnieuw
      </Button>
    </div>}
    {laden&&<p className="text-sm text-muted-foreground">Golven laden…</p>}

    {!laden&&!fout&&<>
      {golven.length===0&&<p className="text-sm text-muted-foreground">
        Nog geen aanbiedgolf samengesteld. Voeg eerst kandidaten toe aan
        het object en selecteer daarna de best passende partijen voor golf 1.
      </p>}
      {golven.map(g=>{
        const deelnemers=kandidaten.filter(k=>selecties.some(x=>
          x.golfId===g.id&&x.kandidaatId===k.id));
        const voortgang=berekenGolfVoortgang(deelnemers,store.contactMoments??[],today);
        return <div key={g.id} className="border border-border/70 rounded-md p-3 space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="text-sm font-semibold">Golf {g.volgnummer} · {voortgang.aantal} kandidaten</p>
            <p className="text-xs text-muted-foreground">
              {voortgang.gereageerd} gereageerd · {voortgang.wachten} wachten
              {voortgang.opvolgen>0?' · '+voortgang.opvolgen+' opvolgen':''}
            </p>
          </div>
          {g.toelichting&&<p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {g.toelichting}
          </p>}
          {deelnemers.map(k=>{
            const info=voortgang.leden.find(x=>x.kandidaatId===k.id);
            return <div key={k.id} className="flex flex-wrap gap-2 justify-between items-center border-t border-border/50 pt-2">
              <div className="min-w-0">
                <Link to={'/relaties/'+k.relatieId} className="text-sm font-medium underline break-words">
                  {bepaalNaam(k.relatieId)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {info?GOLF_STATUS_LABELS[info.status]:'Status niet bekend'}
                  {info?.laatsteAanbieddatum?' · verstuurd '+info.laatsteAanbieddatum:''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" onClick={()=>onAanbieding(k.relatieId)}>
                  <Send className="h-3.5 w-3.5 mr-1"/> Aanbieding
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={()=>onReactie(k.relatieId)}>
                  <MessageSquareText className="h-3.5 w-3.5 mr-1"/> Reactie
                </Button>
              </div>
            </div>;
          })}
          <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
            {voortgang.vervolgadvies}
          </p>
        </div>;
      })}

      {laatsteVoortgang &&
        (laatsteVoortgang.nietBenaderd>0 || laatsteVoortgang.opvolgen>0 ||
         laatsteVoortgang.wachten>0 || laatsteVoortgang.datumOnbekend>0) &&
        <p className="text-xs border-l-2 border-amber-500/60 pl-3">
          De vorige golf is nog niet afgerond. Overweeg eerst opvolging en
          beoordeel de reacties. Een volgende golf wordt niet automatisch geblokkeerd.
        </p>}

      {beschikbaar.length>0
        ?<div className="space-y-3 pt-2 border-t border-border/70">
          <div>
            <p className="font-medium text-sm">
              Golf {golven.length+1} samenstellen
            </p>
            <p className="text-xs text-muted-foreground">
              {gekozen.length} van maximaal 3 geselecteerd. Eerder gekozen
              kandidaten staan niet opnieuw in de lijst.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {beschikbaar.map(k=><label key={k.id}
              className="flex gap-2 items-start border border-border/70 rounded-md p-2 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1"
                checked={gekozen.includes(k.id)}
                disabled={gekozen.length>=3&&!gekozen.includes(k.id)}
                onChange={e=>toggle(k.id,e.target.checked)}/>
              <span className="min-w-0">
                <span className="block font-medium break-words">
                  {bepaalNaam(k.relatieId)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {k.matchscore!=null?k.matchscore+'% match · ':''}
                  {k.pipelineFase.replaceAll('_',' ')}
                </span>
              </span>
            </label>)}
          </div>
          <div>
            <Label htmlFor="golf-toelichting">Selectie en markttoets (optioneel)</Label>
            <Textarea id="golf-toelichting" rows={2} maxLength={1000}
              value={toelichting} onChange={e=>setToelichting(e.target.value)}
              placeholder="Bijv. eerste toets bij drie bewezen kopers; prijs is nog niet besproken."/>
          </div>
          <Button type="button" onClick={()=>void slaOp()}
            disabled={!gekozen.length||!!validatie||bezig||toelichting.length>1000}>
            <Plus className="h-4 w-4 mr-1"/>
            {bezig?'Samenstellen…':'Golf '+(golven.length+1)+' opslaan'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Het opslaan van de selectie verstuurt niets, verandert geen
            kandidaatstatus en maakt geen contactmoment aan.
          </p>
        </div>
        :<p className="text-xs text-muted-foreground border-t border-border/70 pt-2">
          Alle bestaande kandidaten zijn aan een golf toegewezen. Voeg via
          Kandidaten eerst nieuwe partijen toe om een volgende ronde samen te stellen.
        </p>}
    </>}
  </section>;
}
