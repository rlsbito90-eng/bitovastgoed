import { useEffect, useState } from 'react';
import type { Relatie } from '@/data/mock-data';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';

export type InlineRelatieVeld = {
  key: keyof Relatie;
  label: string;
  kind?: 'text'|'email'|'url'|'number'|'date'|'textarea'|'select'|'checkbox'|'multi'|'readonly';
  options?: readonly {value:string;label:string}[];
  note?: string;
};
type Props = {
  titel:string;
  relatie:Relatie;
  velden:readonly InlineRelatieVeld[];
  onSave:(patch:Partial<Relatie>)=>Promise<void>;
};

const gelijk=(a:unknown,b:unknown):boolean=>{
  if(Array.isArray(a)&&Array.isArray(b)) return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
  return a===b || (a==null&&b==null);
};
const alsString=(v:unknown):string=> v==null?'':String(v);
function leesbaar(veld:InlineRelatieVeld,waarde:unknown):string{
  if(veld.kind==='checkbox') return waarde?'Ja':'Nee';
  if(Array.isArray(waarde)) {
    if(waarde.length===0) return '—';
    return waarde.map(v=>veld.options?.find(o=>o.value===v)?.label??String(v)).join(', ');
  }
  if(waarde==null||waarde==='') return '—';
  if(veld.options) return veld.options.find(o=>o.value===waarde)?.label??String(waarde);
  if(veld.kind==='number') return new Intl.NumberFormat('nl-NL',{maximumFractionDigits:2}).format(Number(waarde));
  return String(waarde);
}

/** Inline veldgroep met alleen een wijzigingspatch. Bestaande, ongewijzigde
 * waarden komen nooit in een UPDATE terecht. */
export default function InlineRelatieSectie({titel,relatie,velden,onSave}:Props){
  const [bewerken,setBewerken]=useState(false);
  const [concept,setConcept]=useState<Partial<Relatie>>({});
  const [basis,setBasis]=useState<Partial<Relatie>>({});
  const [bezig,setBezig]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const patch:Partial<Relatie>={};
  for(const veld of velden){
    const v=veld.key;
    if(veld.kind==='readonly') continue;
    if(Object.prototype.hasOwnProperty.call(concept,v)&&!gelijk(concept[v],basis[v])){
      (patch as Record<string,unknown>)[v]=concept[v];
    }
  }
  const vuil=bewerken&&Object.keys(patch).length>0;
  const {confirmDiscard}=useDirtyGuard(vuil);
  useEffect(()=>{setBewerken(false);setConcept({});setBasis({});setFout(null);},[relatie.id]);

  const begin=()=>{
    const snapshot:Record<string,unknown>={};
    for(const veld of velden) snapshot[veld.key]=relatie[veld.key];
    setBasis(snapshot as Partial<Relatie>);
    setConcept(snapshot as Partial<Relatie>);
    setFout(null);
    setBewerken(true);
  };
  const wijzig=(key:keyof Relatie,value:unknown)=>{
    setConcept(prev=>({...prev,[key]:value}));
    setFout(null);
  };
  const annuleren=()=>{
    if(bezig||!confirmDiscard()) return;
    setBewerken(false);setFout(null);setConcept({});setBasis({});
  };
  const opslaan=async()=>{
    if(bezig) return;
    if('bedrijfsnaam' in patch&&!String(patch.bedrijfsnaam??'').trim()){
      setFout('Een relatie moet een bedrijfsnaam hebben.');return;
    }
    for(const veld of velden){
      if(veld.kind==='number'&&veld.key in patch){
        const v=patch[veld.key];
        if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<0)){
          setFout(`Ongeldige waarde bij ${veld.label}.`);return;
        }
      }
    }
    // Voorkom stilzwijgend overschrijven van dezelfde veldwaarde die elders is bijgewerkt.
    for(const key of Object.keys(patch) as (keyof Relatie)[]){
      if(!gelijk(relatie[key],basis[key])){
        setFout('Dit veld is elders gewijzigd. Annuleer en open het opnieuw om de nieuwste waarde te zien.');return;
      }
    }
    if(Object.keys(patch).length===0){setBewerken(false);return;}
    setBezig(true);setFout(null);
    try{await onSave(patch);setBewerken(false);setConcept({});setBasis({});}
    catch(e){setFout(e instanceof Error?e.message:'Opslaan is mislukt.');}
    finally{setBezig(false);}
  };
  return <section className="section-card p-5 sm:p-6 space-y-4" aria-label={titel}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">{titel}</h2>
      {!bewerken&&<button type="button" className="text-sm text-accent hover:text-accent/80"
        aria-label={`${titel} bewerken`} onClick={begin}>Wijzig hier</button>}
    </div>
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
      {velden.map(veld=>{
        const waarde=bewerken?concept[veld.key]:relatie[veld.key];
        const id=`relatie-${String(veld.key)}`;
        const kind=veld.kind??'text';
        return <div key={veld.key} className="min-w-0 space-y-1.5">
          <label htmlFor={bewerken&&kind!=='readonly'?id:undefined} className="field-label">{veld.label}</label>
          {bewerken&&kind!=='readonly'
            ?kind==='textarea'
              ?<textarea id={id} rows={3} value={alsString(waarde)}
                onChange={e=>wijzig(veld.key,e.target.value)}
                className="flex min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"/>
              :kind==='select'
                ?<select id={id} value={alsString(waarde)}
                  onChange={e=>wijzig(veld.key,e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">— Niet ingevuld —</option>
                    {veld.options?.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}
                  </select>
                :kind==='multi'
                  ?<div className="flex flex-wrap gap-2">{veld.options?.map(o=><label key={o.value}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">
                      <input type="checkbox" checked={Array.isArray(waarde)&&waarde.includes(o.value)}
                        onChange={e=>{
                          const a=Array.isArray(waarde)?waarde as string[]:[];
                          wijzig(veld.key,e.target.checked?[...new Set([...a,o.value])]:a.filter(v=>v!==o.value));
                        }}/>
                      {o.label}
                    </label>)}</div>
                  :kind==='checkbox'
                    ?<input id={id} type="checkbox" checked={Boolean(waarde)}
                      onChange={e=>wijzig(veld.key,e.target.checked)}/>
                    :<input id={id} type={kind==='number'?'number':kind==='email'?'email':kind==='url'?'url':kind==='date'?'date':'text'}
                      min={kind==='number'?0:undefined} step={kind==='number'?'any':undefined}
                      value={alsString(waarde)}
                      onChange={e=>wijzig(veld.key,kind==='number'?(e.target.value===''?undefined:Number(e.target.value)):e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"/>
            :<p className="field-value min-h-5 break-words whitespace-pre-wrap">{leesbaar(veld,relatie[veld.key])}</p>}
          {veld.note&&<p className="text-xs text-muted-foreground">{veld.note}</p>}
        </div>;
      })}
    </div>
    {bewerken&&<div className="space-y-2">
      {fout&&<p role="alert" className="text-sm text-destructive">{fout}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={bezig} className="rounded-md border border-border px-3 py-2 text-sm"
          onClick={annuleren}>Annuleren</button>
        <button type="button" disabled={bezig}
          className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
          onClick={opslaan}>{bezig?'Opslaan…':'Opslaan'}</button>
      </div>
    </div>}
  </section>;
}
