import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, RotateCcw, MapPin, Trash2, AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';
import { buildMapsUrl } from '@/lib/maps';
import { resolveObjectAdressen, kanAdresOpKaart, type ObjectAdresRecord } from '@/lib/objecten/adresModel';

type Scenario='geuzenweg'|'amsterdam'|'leeg';
const pid=(s:Scenario)=>'demo-'+s;
const make=(s:Scenario):ObjectAdresRecord[]=>{
  const adr=s==='geuzenweg'?['Geuzenweg 22A','Geuzenweg 22B']
    :s==='amsterdam'?['Voorbeeldadres 1','Voorbeeldadres 2','Voorbeeldadres 3']:[];
  return adr.map((adres,i)=>({id:pid(s)+'-'+i,objectId:pid(s),adres,
    plaats:s==='geuzenweg'?'Hilversum':'Amsterdam',postcode:'',isHoofdadres:i===0}));
};
export default function AdresModelProefPage(){
  const [scenario,setScenario]=useState<Scenario>('geuzenweg');
  const [adressen,setAdressen]=useState<ObjectAdresRecord[]>(()=>make('geuzenweg'));
  const [counter,setCounter]=useState(10);
  const result=useMemo(()=>resolveObjectAdressen({id:pid(scenario)},adressen),[scenario,adressen]);
  const kies=(next:Scenario)=>{setScenario(next);setAdressen(make(next));setCounter(10);};
  const update=(id:string,k:'adres'|'postcode'|'plaats',value:string)=>
    setAdressen(old=>old.map(a=>a.id===id?{...a,[k]:value}:a));
  const add=()=>{setAdressen(old=>[...old,{id:pid(scenario)+'-'+counter,
    objectId:pid(scenario),adres:'',plaats:'',postcode:'',isHoofdadres:old.length===0}]);setCounter(x=>x+1);};
  return <div className="page-shell-wide space-y-5">
    <Link to="/objecten" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Terug naar Objecten</Link>
    <div className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent"><FlaskConical className="h-4 w-4"/> Interactieve proef</p>
      <h1 className="text-2xl font-semibold">Meerdere adressen per object</h1>
      <Link to="/objecten/samenstellingproef" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
        Bekijk ook de proef voor objectonderdelen en koperscriteria
      </Link>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Test de toekomstige invoer. Dit zijn uitsluitend voorbeeldgegevens. Wijzigingen worden
        <strong className="text-foreground"> niet opgeslagen in je CRM of database</strong>.
        Er worden geen echte objecten of prijzen aangemaakt.
      </p>
    </div>
    <section className="section-card p-4 sm:p-5 space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex-1 min-w-[220px] text-sm font-medium space-y-1">
          <span>Voorbeeld</span>
          <select value={scenario} onChange={e=>kies(e.target.value as Scenario)}
            className="block w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="geuzenweg">Geuzenweg: één dossier, twee adressen</option>
            <option value="amsterdam">Amsterdam: drie fictieve adressen</option>
            <option value="leeg">Leeg dossier</option>
          </select>
        </label>
        <button type="button" onClick={()=>kies(scenario)} className="h-10 inline-flex items-center gap-2 rounded-md border border-border px-3 text-sm">
          <RotateCcw className="h-4 w-4"/> Herstellen
        </button>
      </div>
      <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        Eén objectdossier · {adressen.length} adres(sen) · geen automatische prijs- of huurverdeling
      </p>
      {adressen.map((a,i)=>{
        const maps=kanAdresOpKaart(a)?buildMapsUrl({adres:a.adres,postcode:a.postcode||undefined,plaats:a.plaats||undefined}):null;
        return <div key={a.id} className="rounded-lg border border-border/70 p-3 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <h2 className="font-medium text-sm">Adres {i+1}</h2>
            <button type="button" aria-label={`Verwijder adres ${i+1}`} onClick={()=>setAdressen(old=>old.filter(x=>x.id!==a.id))}
              className="rounded-md p-2 hover:bg-muted text-muted-foreground"><Trash2 className="h-4 w-4"/></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {(['adres','postcode','plaats'] as const).map((key,j)=>
              <label key={key} className="text-xs space-y-1">
                <span>{['Straat + huisnummer','Postcode','Plaats'][j]}</span>
                <input aria-label={`Adres ${i+1} ${key}`} value={a[key]??''}
                  onChange={e=>update(a.id,key,e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/>
              </label>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="radio" name="hoofdadres" checked={a.isHoofdadres}
                onChange={()=>setAdressen(old=>old.map(x=>({...x,isHoofdadres:x.id===a.id})))}/>
              Hoofdadres
            </label>
            {maps?<a href={maps} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"><MapPin className="h-4 w-4"/>Open in Google Maps</a>
              :<span className="text-xs text-muted-foreground">Vul adres en plaats in voor Maps</span>}
          </div>
        </div>;
      })}
      <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
        <Plus className="h-4 w-4"/> Adres toevoegen
      </button>
      <div className="border-t border-border/70 pt-4 space-y-2">
        <h2 className="text-sm font-semibold">Gegevenscontrole</h2>
        {result.controlepunten.length?result.controlepunten.map(e=>
          <p key={e} role="status" className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0"/>{e}
          </p>):adressen.length?
          <p className="inline-flex items-center gap-2 text-xs text-success"><CheckCircle2 className="h-4 w-4"/>Geen adresconflicten gevonden</p>:
          <p className="text-xs text-muted-foreground">Nog geen adresgegevens ingevuld.</p>}
        <p className="text-xs text-muted-foreground">Geen BAG- of eigendomsverificatie. Alleen invoerlogica wordt getoond.</p>
      </div>
    </section>
  </div>;
}
