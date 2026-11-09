import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,MapPin,RefreshCw,Search} from 'lucide-react';
import {zoekBagAdressen,zoekPdokWoonplaatsen,normaliseerPostcodeStrikt,type BagAdresResultaat} from '@/lib/bag/pdokLookup';

export type PdokKeuze={
  latitude:number;
  longitude:number;
  bron:string;
  geverifieerdOp:string;
};

type Props={
  mode:'object'|'woonplaats';
  recordId:string;
  adres?:string|null;
  postcode?:string|null;
  plaats?:string|null;
  centrum?:string|null;
  latitude?:number|null;
  longitude?:number|null;
  bron?:string|null;
  onSave:(point:PdokKeuze)=>Promise<void>;
};

const normaliseer=(s:string)=>
  s.toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
const simpleAdres=(adres:string)=>{
  // Een samengesteld object omvat meerdere BAG-adressen. Daarvoor moet de
  // gebruiker zelf één representatief adrespunt selecteren.
  if(/[+&]|\bt\/m\b/i.test(adres))return null;
  const m=adres.trim().match(/^(.+?)\s+(\d{1,5})([a-z]?)(?:[-/]\w+)?$/i);
  return m?{straat:normaliseer(m[1]),nummer:m[2],letter:m[3]?.toLowerCase()??''}:null;
};

export function pdokKeuzeControle(
  doc:BagAdresResultaat,params:{mode:'object'|'woonplaats';adres?:string|null;postcode?:string|null;plaats?:string|null;centrum?:string|null},
):string|null{
  if(!doc.id || doc.latitude==null || doc.longitude==null || !Number.isFinite(doc.latitude)||!Number.isFinite(doc.longitude))
    return 'PDOK heeft geen geldige locatie en bronidentificatie geleverd.';
  if(params.mode==='woonplaats'){
    if(doc.type!=='woonplaats')return 'Het gekozen resultaat is geen officiële woonplaats.';
    if(normaliseer(doc.woonplaats??doc.weergavenaam)!==normaliseer(params.centrum??''))
      return 'De geselecteerde woonplaats wijkt af van de ingestelde startplaats. Wijzig eerst het zoekcentrum.';
    return null;
  }
  if(doc.type!=='adres'||!doc.nummeraanduiding_id)
    return 'Het resultaat heeft geen verifieerbare BAG-adresidentificatie.';
  const pc=normaliseerPostcodeStrikt(params.postcode);
  if(pc && pc!==doc.postcode)
    return 'Postcode wijkt af van het CRM-object. Corrigeer eerst het geregistreerde adres.';
  if(params.plaats?.trim()&&normaliseer(params.plaats)!==normaliseer(doc.woonplaats??''))
    return 'De woonplaats wijkt af van het CRM-object. Corrigeer eerst de locatiegegevens.';
  const expected=simpleAdres(params.adres??'');
  if(expected && (
     expected.straat!==normaliseer(doc.straat??'')||
     expected.nummer!==doc.huisnummer ||
     (expected.letter&&expected.letter!==normaliseer(doc.huisletter??''))))
    return 'Straat of huisnummer wijkt af van het CRM-object. Controleer eerst het adres.';
  return null;
}

/** PDOK wordt uitsluitend aangeroepen ná een bewuste klik op Zoeken.
 * Off-marketadressen blijven intern tot de gebruiker besluit bij PDOK te zoeken.
 */
export default function PdokLocatieVerifier({
  mode,recordId,adres,postcode,plaats,centrum,latitude,longitude,bron,onSave,
}:Props){
  const begin=mode==='woonplaats'?(centrum??''):[adres,postcode,plaats].filter(Boolean).join(' ');
  const [query,setQuery]=useState(begin);
  const [resultaten,setResultaten]=useState<BagAdresResultaat[]>([]);
  const [gekozen,setGekozen]=useState<BagAdresResultaat|null>(null);
  const [bezig,setBezig]=useState(false);
  const [opslaan,setOpslaan]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  useEffect(()=>{
    setQuery(begin);setResultaten([]);setGekozen(null);setFout(null);
    // Nieuwe entiteit: reset de vorige keuze; geen automatische PDOK-oproep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[recordId,mode]);
  const keuzeFout=useMemo(()=>gekozen?pdokKeuzeControle(gekozen,{
    mode,adres,postcode,plaats,centrum,
  }):null,[gekozen,mode,adres,postcode,plaats,centrum]);

  const zoeken=async()=>{
    if(bezig||opslaan)return;
    if(query.trim().length<2){setFout('Vul eerst een adres of woonplaats in.');return;}
    setBezig(true);setFout(null);setResultaten([]);setGekozen(null);
    try{
      const gevonden=mode==='woonplaats'
        ?await zoekPdokWoonplaatsen(query,{rows:8})
        :await zoekBagAdressen({straat:query},{rows:8});
      setResultaten(gevonden);
      if(!gevonden.length)setFout('PDOK heeft geen geschikte resultaten gevonden. Controleer het adres.');
    }catch(e){setFout(e instanceof Error?e.message:'Locatie zoeken is mislukt.');}
    finally{setBezig(false);}
  };

  const bevestig=async()=>{
    if(!gekozen||keuzeFout||opslaan)return;
    setOpslaan(true);setFout(null);
    try{
      await onSave({
        latitude:gekozen.latitude!,
        longitude:gekozen.longitude!,
        bron:`${mode==='object'?'PDOK-BAG':'PDOK-WOONPLAATS'}:${gekozen.id} | ${gekozen.weergavenaam}`,
        geverifieerdOp:new Date().toISOString(),
      });
      setResultaten([]);setGekozen(null);
    }catch(e){setFout(e instanceof Error?e.message:'Geverifieerde locatie kon niet worden opgeslagen.');}
    finally{setOpslaan(false);}
  };

  return <section className="rounded-lg border border-border p-3 space-y-3" aria-label={mode==='object'?'BAG-adres verifiëren':'Zoekcentrum verifiëren'}>
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-accent"/>
      <h4 className="text-sm font-semibold">{mode==='object'?'BAG-adres controleren':'Centrumplaats controleren'}</h4>
    </div>
    <p className="text-xs text-muted-foreground">
      {mode==='object'
        ? 'Kies het juiste BAG-adres als representatief objectpunt. Bij meerdere huisnummers is dit één referentiepunt, niet de volledige portefeuille.'
        : 'Gebruik het officiële centrum van de genoemde woonplaats. Dit is geen exact vertrekadres of reistijdmeting.'}
      {' '}Bij Zoeken wordt alleen de ingevulde zoektekst naar de publieke PDOK Locatieserver verzonden.
    </p>
    {latitude!=null&&longitude!=null&&bron?.trim()
      ?<p className="flex items-center gap-1.5 text-xs text-foreground break-all">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0"/>
        Locatie bevestigd: {latitude.toFixed(5)}, {longitude.toFixed(5)} · {bron}
       </p>
      :<p className="text-xs text-amber-700 dark:text-amber-400">
        Nog geen geverifieerde coördinaten. Matching op afstand blijft ter controle.
      </p>}
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[180px] flex-1 space-y-1">
        <label htmlFor={`pdok-query-${mode}-${recordId}`} className="text-xs font-medium">
          {mode==='object'?'Zoek een volledig adres':'Zoek een woonplaats'}
        </label>
        <input id={`pdok-query-${mode}-${recordId}`}
          value={query} onChange={e=>{setQuery(e.target.value);setGekozen(null);setResultaten([]);setFout(null);}}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          placeholder={mode==='object'?'Straat 12, 1234 AB Plaats':'Bijv. Amersfoort'}/>
      </div>
      <button type="button" onClick={()=>void zoeken()} disabled={bezig||opslaan}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm disabled:opacity-50">
        {bezig?<RefreshCw className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}
        {bezig?'Zoeken…':'Zoeken bij PDOK'}
      </button>
    </div>
    {resultaten.length>0&&<div className="space-y-1">
      <p className="text-xs font-medium">Selecteer de juiste locatie ({resultaten.length} gevonden)</p>
      {resultaten.map(doc=><button key={doc.id} type="button"
        onClick={()=>{setGekozen(doc);setFout(null);}}
        className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted/40 ${gekozen?.id===doc.id?'border-accent bg-accent/5':'border-border'}`}>
        <span className="block font-medium">{doc.weergavenaam||doc.woonplaats}</span>
        {mode==='object'&&<span className="block text-xs text-muted-foreground">
          {doc.postcode??'Geen postcode'} · {doc.nummeraanduiding_id?'BAG-id beschikbaar':'BAG-id ontbreekt'}
        </span>}
      </button>)}
    </div>}
    {gekozen&&<div className="space-y-2 border-t border-border pt-3">
      {keuzeFout?<p role="alert" className="text-xs text-destructive">{keuzeFout}</p>:
        <p className="text-xs text-muted-foreground">
          Bevestig alleen als dit daadwerkelijk het {mode==='object'?'referentieadres van het object':'bedoelde centrum van de woonplaats'} is.
        </p>}
      <button type="button" onClick={()=>void bevestig()} disabled={!!keuzeFout||opslaan}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
        {opslaan?'Opslaan…':'Bevestig en sla locatie op'}
      </button>
    </div>}
    {fout&&<p role="alert" className="text-xs text-destructive">{fout}</p>}
  </section>;
}
