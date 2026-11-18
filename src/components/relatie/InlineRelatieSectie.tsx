import { useEffect, useRef, useState } from 'react';
import type { Relatie } from '@/data/mock-data';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';
import GemeentePicker from '@/components/forms/GemeentePicker';
import { parseerSteden } from '@/lib/matching/zoekprofielCriteria';

export type InlineRelatieVeld = {
  key: keyof Relatie;
  label: string;
  kind?: 'text'|'email'|'url'|'number'|'date'|'textarea'|'select'|'checkbox'|'multi'|'gemeenten'|'plaatsen'|'readonly';
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
/** Bestaande waarden blijven beschikbaar, maar lege CRM-velden voegen
 * in de leesweergave geen informatie toe. 0 en false zijn expliciete waarden.
 */
export function relatieVeldIsIngevuld(waarde:unknown):boolean {
  if(waarde==null)return false;
  if(typeof waarde==='string')return waarde.trim().length>0;
  if(Array.isArray(waarde))return waarde.length>0;
  return true;
}
function leesbaar(veld:InlineRelatieVeld,waarde:unknown):string{
  if(veld.kind==='checkbox') return waarde==null?'—':waarde?'Ja':'Nee';
  if(Array.isArray(waarde)) {
    if(waarde.length===0) return '—';
    return waarde.map(v=>veld.options?.find(o=>o.value===v)?.label??String(v)).join(', ');
  }
  if(waarde==null||waarde==='') return '—';
  if(veld.options) return veld.options.find(o=>o.value===waarde)?.label??String(waarde);
  if(veld.kind==='number') return new Intl.NumberFormat('nl-NL',{maximumFractionDigits:2}).format(Number(waarde));
  return String(waarde);
}

import EditableValueButton from '@/components/ui/editable-value-button';

/**
 * De hele veldwaarde is klikbaar. Normale velden slaan op bij blur/Enter;
 * meervoudige selecties gebruiken een lokale bevestiging om onbedoelde
 * dataverliezen te voorkomen. Alleen het gewijzigde sleutelveld wordt gepatcht.
 */
export default function InlineRelatieSectie({titel,relatie,velden,onSave}:Props){
  const [actief,setActief]=useState<keyof Relatie|null>(null);
  const [toonAlleVelden,setToonAlleVelden]=useState(false);
  const [concept,setConcept]=useState<unknown>(undefined);
  const [plaatsenInvoer,setPlaatsenInvoer]=useState('');
  const [bezig,setBezig]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const conceptRef=useRef<unknown>(undefined);
  const basisRef=useRef<unknown>(undefined);
  const actiefRef=useRef<keyof Relatie|null>(null);
  const cancelledRef=useRef(false);
  const busyRef=useRef(false);
  const relatieRef=useRef(relatie);
  relatieRef.current=relatie;

  const dirty=actief!==null&&!gelijk(concept,basisRef.current);
  const {confirmDiscard}=useDirtyGuard(dirty);

  useEffect(()=>{
    setActief(null);actiefRef.current=null;setToonAlleVelden(false);
    setConcept(undefined);conceptRef.current=undefined;basisRef.current=undefined;
    setFout(null);cancelledRef.current=false;
  },[relatie.id]);

  function start(veld:InlineRelatieVeld){
    if(veld.kind==='readonly'||busyRef.current)return;
    if(actiefRef.current!==null&&!confirmDiscard())return;
    const base=relatieRef.current[veld.key];
    basisRef.current=Array.isArray(base)?[...base]:base;
    conceptRef.current=Array.isArray(base)?[...base]:base;
    setConcept(conceptRef.current);
    setPlaatsenInvoer((veld.key==='zoekPlaatsen'&&Array.isArray(base)?base:[]).join(', '));
    cancelledRef.current=false;
    actiefRef.current=veld.key;
    setActief(veld.key);
    setFout(null);
  }
  function wijzig(next:unknown){
    conceptRef.current=next;setConcept(next);setFout(null);
  }
  function annuleer(){
    if(busyRef.current||!confirmDiscard())return;
    cancelledRef.current=true;actiefRef.current=null;setActief(null);
    conceptRef.current=undefined;setConcept(undefined);basisRef.current=undefined;
    setFout(null);
  }
  async function opslaan(veld:InlineRelatieVeld,next=conceptRef.current){
    if(busyRef.current||cancelledRef.current||actiefRef.current!==veld.key)return;
    if(gelijk(next,basisRef.current)){
      actiefRef.current=null;setActief(null);setFout(null);return;
    }
    if(veld.key==='bedrijfsnaam'&&!String(next??'').trim()){
      setFout('Een relatie moet een bedrijfsnaam hebben.');return;
    }
    if(veld.kind==='number'&&next!=null&&
      (typeof next!=='number'||!Number.isFinite(next)||next<0)){
      setFout(`Ongeldige waarde bij ${veld.label}.`);return;
    }
    // Bestaande waarde opnieuw controleren: geen stil overschrijven van
    // edits uit andere sessies, ook niet wanneer maar één veld wordt gewijzigd.
    if(!gelijk(relatieRef.current[veld.key],basisRef.current)){
      setFout('Dit veld is elders gewijzigd. Annuleer en open het opnieuw om de nieuwste waarde te zien.');
      return;
    }
    busyRef.current=true;setBezig(true);setFout(null);
    const patch={[veld.key]:next} as Partial<Relatie>;
    try{
      await onSave(patch);
      actiefRef.current=null;setActief(null);
      basisRef.current=undefined;conceptRef.current=undefined;setConcept(undefined);
    }catch(e){
      setFout(e instanceof Error?e.message:'Opslaan is mislukt.');
    }finally{
      busyRef.current=false;setBezig(false);
    }
  }

  const legeVelden=velden.filter(v=>!relatieVeldIsIngevuld(relatie[v.key])).length;
  const zichtbareVelden=velden.filter(v=>v.key===actief||toonAlleVelden||relatieVeldIsIngevuld(relatie[v.key]));
  return <section className="section-card p-5 sm:p-6 space-y-4" aria-label={titel}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">{titel}</h2>
      {bezig&&<span className="text-xs text-muted-foreground" role="status">Opslaan…</span>}
    </div>
    {legeVelden>0&&<button type="button"
      aria-expanded={toonAlleVelden}
      onClick={()=>setToonAlleVelden(x=>!x)}
      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
      {toonAlleVelden?'Verberg lege velden':`Toon alle velden (${legeVelden} leeg)`}
    </button>}
    {zichtbareVelden.length===0&&
      <p className="text-sm text-muted-foreground">
        Nog geen gegevens vastgelegd. Kies 'Toon alle velden' om gegevens toe te voegen.
      </p>}
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
      {zichtbareVelden.map(veld=>{
        const editing=actief===veld.key;
        const waarde=editing?concept:relatie[veld.key];
        const id=`relatie-${String(veld.key)}`;
        const kind=veld.kind??'text';
        const complex=kind==='multi'||kind==='gemeenten';
        return <div key={veld.key}
          className={`min-w-0 space-y-1.5 ${(kind==='textarea'||kind==='gemeenten'||kind==='multi'||kind==='plaatsen')?'sm:col-span-2':''}`}>
          <label htmlFor={editing&&!complex&&kind!=='readonly'?id:undefined}
            className="field-label">{veld.label}</label>
          {editing&&kind!=='readonly'
            ?kind==='textarea'
              ?<textarea id={id} autoFocus rows={3} value={alsString(waarde)}
                onChange={e=>wijzig(e.target.value)}
                onBlur={()=>{void opslaan(veld);}}
                onKeyDown={e=>{
                  if(e.key==='Escape'){e.preventDefault();annuleer();}
                  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void opslaan(veld);}
                }}
                className="flex min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"/>
              :kind==='select'
                ?<select id={id} autoFocus value={alsString(waarde)}
                  onChange={e=>{wijzig(e.target.value);void opslaan(veld,e.target.value);}}
                  onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();annuleer();}}}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">— Niet ingevuld —</option>
                    {veld.options?.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}
                  </select>
                :kind==='gemeenten'
                  ?<GemeentePicker provincies={Array.isArray(relatie.regio)?relatie.regio:[]}
                    gekozen={Array.isArray(waarde)?waarde:[]}
                    onChange={v=>wijzig(v)}/>
                :kind==='plaatsen'
                  ?<textarea id={id} autoFocus rows={2} value={plaatsenInvoer}
                    onChange={e=>{
                      setPlaatsenInvoer(e.target.value);
                      wijzig(parseerSteden(e.target.value));
                    }}
                    onBlur={()=>{void opslaan(veld);}}
                    onKeyDown={e=>{
                      if(e.key==='Escape'){e.preventDefault();annuleer();}
                      if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void opslaan(veld);}
                    }}
                    className="flex min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"/>
                :kind==='multi'
                  ?<div className="flex flex-wrap gap-2">
                    {veld.options?.map(o=><label key={o.value}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
                      <input type="checkbox" checked={Array.isArray(waarde)&&waarde.includes(o.value)}
                        onChange={e=>{
                          const old=Array.isArray(conceptRef.current)?conceptRef.current as string[]:[];
                          wijzig(e.target.checked?[...new Set([...old,o.value])]:old.filter(v=>v!==o.value));
                        }}/>
                      {o.label}
                    </label>)}
                  </div>
                :kind==='checkbox'
                  ?<input id={id} type="checkbox" autoFocus checked={Boolean(waarde)}
                    onChange={e=>{wijzig(e.target.checked);void opslaan(veld,e.target.checked);}}/>
                  :<input id={id} autoFocus
                    type={kind==='number'?'number':kind==='email'?'email':kind==='url'?'url':kind==='date'?'date':'text'}
                    min={kind==='number'?0:undefined} step={kind==='number'?'any':undefined}
                    value={alsString(waarde)}
                    onChange={e=>wijzig(kind==='number'?(e.target.value===''?undefined:Number(e.target.value)):e.target.value)}
                    onBlur={()=>{void opslaan(veld);}}
                    onKeyDown={e=>{
                      if(e.key==='Escape'){e.preventDefault();annuleer();}
                      if(e.key==='Enter'){e.preventDefault();void opslaan(veld);}
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"/>
            :kind==='readonly'
              ?<p className="field-value min-h-5 break-words whitespace-pre-wrap">{leesbaar(veld,relatie[veld.key])}</p>
              :<EditableValueButton label={veld.label} disabled={bezig}
                multiline={kind==='textarea'||kind==='plaatsen'}
                onClick={()=>start(veld)}>
                {leesbaar(veld,relatie[veld.key])==='—'
                  ?<span className="text-muted-foreground">Niet opgegeven</span>
                  :leesbaar(veld,relatie[veld.key])}
              </EditableValueButton>}
          {editing&&veld.note&&<p className="text-xs text-muted-foreground">{veld.note}</p>}
          {editing&&fout&&<p role="alert" className="text-xs text-destructive">{fout}</p>}
          {editing&&<div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" disabled={bezig} onClick={annuleer}
              className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted/40">Annuleren</button>
            {complex&&<button type="button" disabled={bezig}
              onClick={()=>{void opslaan(veld);}}
              className="rounded bg-accent px-2.5 py-1.5 text-xs text-accent-foreground">
              {bezig?'Opslaan…':'Opslaan'}
            </button>}
          </div>}
        </div>;
      })}
    </div>
  </section>;
}
