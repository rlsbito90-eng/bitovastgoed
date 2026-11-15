/**
 * Eén beoordeelbare shortlist per object, met dezelfde beslissingen als Relaties.
 * "Interessant" is een selectie, geen aanbieding en geen pipelinekandidaat.
 * Alleen de expliciete actie "Kandidaat toevoegen" start het dealtraject.
 */
import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MATCH_AFWIJSREDENEN, sorteerVoorstellenOpBesluit, type MatchBesluitStatus } from '@/lib/matching/relatieObjectBesluiten';
import {
  isAanbiedbaar, maakKandidaatConcept, maakKandidaatVoorstellen,
  type CrmMandaatInput, type CrmObjectInput, type CrmRelatieInput,
  type KandidaatVoorstel, type ProfielRoute,
} from '../../lib/matching/rolMandaatAdapter';

type Concept = Extract<ReturnType<typeof maakKandidaatConcept>, { ok: true }>['concept'];
type Besluit = {status:MatchBesluitStatus;redenCode:string|null};

export interface KandidaatVoorstellenProps {
  object: CrmObjectInput;
  relaties: readonly CrmRelatieInput[];
  zoekprofielen: readonly CrmMandaatInput[];
  reedsGekoppeld: ReadonlySet<string>;
  relatieNaam: (relatieId: string) => string;
  /** Selectie is een concept; pas het bovenliggende dialoog kan koppelen. */
  onConceptGekozen?: (concept: Concept) => void;
}
const kwalificatieLabel:Record<ProfielRoute['kwalificatie'],string>={
  passend:'Indicatief passend',te_verifieren:'Controle nodig',
  onvoldoende:'Onvoldoende onderbouwd',afwijkend:'Wijkt af',
};

export function KandidaatVoorstellenR2(props: KandidaatVoorstellenProps) {
  const [toonAfwijkend,setToonAfwijkend]=useState(false);
  const [toonAfgewezen,setToonAfgewezen]=useState(false);
  const [redenVoor,setRedenVoor]=useState<string|null>(null);
  const [redenen,setRedenen]=useState<Record<string,string>>({});
  const [fout,setFout]=useState<string|null>(null);
  const [besluiten,setBesluiten]=useState<Record<string,Besluit>>({});
  const [besluitenGeladen,setBesluitenGeladen]=useState(false);
  const [bezig,setBezig]=useState<string|null>(null);

  useEffect(()=>{
    let actief=true;
    setBesluitenGeladen(false);
    setFout(null);
    void supabase.from('relatie_object_matchbesluiten' as any)
      .select('relatie_id,status,reden_code').eq('object_id',props.object.id)
      .then(({data,error})=>{
        if(!actief)return;
        if(error){
          setFout('Beoordelingen konden niet worden geladen; kandidaatvoorstellen blijven afgeschermd.');
          return;
        }
        const gevonden:Record<string,Besluit>={};
        for(const row of (data??[]) as any[]) {
          gevonden[row.relatie_id]={status:row.status,redenCode:row.reden_code??null};
        }
        setBesluiten(gevonden);
        setBesluitenGeladen(true);
      });
    return ()=>{actief=false;};
  },[props.object.id]);

  const voorgesteld=useMemo(()=>{
    const berekend=maakKandidaatVoorstellen(props.object,props.relaties,props.zoekprofielen,
      {reedsGekoppeld:props.reedsGekoppeld,toonAfwijkende:toonAfwijkend});
    const handmatigeBesluiten=Object.entries(besluiten).map(([relatieId,b])=>({
      relatieId,status:b.status,
    }));
    return sorteerVoorstellenOpBesluit(berekend,handmatigeBesluiten,props.reedsGekoppeld);
  },[props.object,props.relaties,props.zoekprofielen,props.reedsGekoppeld,toonAfwijkend,besluiten]);

  const afgewezen=Object.entries(besluiten)
    .filter(([relatieId,b])=>b.status==='afgewezen'&&!props.reedsGekoppeld.has(relatieId));

  function kiesKandidaat(p:KandidaatVoorstel,route:ProfielRoute) {
    if(!props.onConceptGekozen)return;
    if(besluiten[p.relatieId]?.status==='afgewezen'){
      setFout('Deze partij is al afgewezen. Herstel eerst de beoordeling.');
      return;
    }
    const handoff=maakKandidaatConcept(props.object,p,route.key);
    if(!handoff.ok){setFout(handoff.reden);return;}
    setFout(null);
    props.onConceptGekozen(handoff.concept);
  }

  async function beoordeel(relatieId:string,status:MatchBesluitStatus) {
    setBezig(relatieId);
    const redenCode=status==='afgewezen'?(redenen[relatieId]??'overig'):null;
    const {error}=await supabase.from('relatie_object_matchbesluiten' as any)
      .upsert({object_id:props.object.id,relatie_id:relatieId,status,
        reden_code:redenCode,updated_at:new Date().toISOString()},
        {onConflict:'relatie_id,object_id'});
    if(error){setFout('Beoordeling kon niet worden opgeslagen.');}
    else{
      setBesluiten(prev=>({...prev,[relatieId]:{status,redenCode}}));
      setRedenVoor(null);
      setFout(null);
    }
    setBezig(null);
  }
  async function herstel(relatieId:string) {
    setBezig(relatieId);
    const {error}=await supabase.from('relatie_object_matchbesluiten' as any)
      .delete().eq('object_id',props.object.id).eq('relatie_id',relatieId);
    if(error){setFout('Beoordeling kon niet worden hersteld.');}
    else{
      setBesluiten(prev=>{
        const next={...prev};
        delete next[relatieId];
        return next;
      });
      setFout(null);
    }
    setBezig(null);
  }

  if(!isAanbiedbaar(props.object))return (
    <p className="text-sm text-muted-foreground">Dit object is niet beschikbaar voor nieuwe kandidaatsuggesties. De bestaande kandidaathistorie blijft behouden.</p>
  );
  if(!besluitenGeladen)return (
    <p className={fout?'text-sm text-destructive':'text-sm text-muted-foreground'} role={fout?'alert':'status'}>
      {fout??'Eerdere beoordelingen laden…'}
    </p>
  );

  return <section className="space-y-3" aria-label="Kandidaatvoorstellen">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <p className="text-sm text-muted-foreground">{voorgesteld.length} kandidaatvoorstellen</p>
      <label className="text-xs text-muted-foreground flex items-center gap-2">
        <input type="checkbox" checked={toonAfwijkend}
          onChange={e=>setToonAfwijkend(e.target.checked)}/> Toon afwijkingen
      </label>
    </div>
    {fout&&<p className="text-xs text-destructive" role="alert">{fout}</p>}
    {voorgesteld.length===0&&<p className="text-sm text-muted-foreground">
      Geen nieuwe voorstellen. Gebruik ‘Alle relaties’ om handmatig een partij te kiezen.
    </p>}
    {voorgesteld.map(p=>{
      const besluit=besluiten[p.relatieId];
      const voorkeursroute=p.besteRoute;
      return <article key={p.relatieId} className="rounded-lg border border-border bg-card px-3 py-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-sm break-words">{props.relatieNaam(p.relatieId)}</h3>
            <p className="text-xs text-muted-foreground">
              {besluit?.status==='interessant'?'Door jou interessant bevonden':kwalificatieLabel[voorkeursroute.kwalificatie]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" disabled={!props.onConceptGekozen || !!bezig || voorkeursroute.kwalificatie==='afwijkend'}
            onClick={()=>kiesKandidaat(p,voorkeursroute)}
            className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium disabled:opacity-40">
            Kandidaat toevoegen
          </button>
          {besluit?.status!=='interessant'&&<button type="button" disabled={!!bezig}
            onClick={()=>void beoordeel(p.relatieId,'interessant')}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs disabled:opacity-40">Interessant</button>}
          <button type="button" disabled={!!bezig} onClick={()=>setRedenVoor(x=>x===p.relatieId?null:p.relatieId)}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
            Niet passend
          </button>
        </div>
        {redenVoor===p.relatieId&&<div className="rounded border border-border bg-muted/20 p-2 flex flex-wrap items-center gap-2">
          <select aria-label="Afwijsreden" value={redenen[p.relatieId]??'overig'}
            onChange={e=>setRedenen(prev=>({...prev,[p.relatieId]:e.target.value}))}
            className="rounded border border-input bg-background px-2 py-1.5 text-xs flex-1 min-w-0">
            {Object.entries(MATCH_AFWIJSREDENEN).map(([code,naam])=>
              <option key={code} value={code}>{naam}</option>)}
          </select>
          <button type="button" disabled={!!bezig}
            onClick={()=>void beoordeel(p.relatieId,'afgewezen')}
            className="rounded bg-accent px-2 py-1.5 text-xs text-accent-foreground disabled:opacity-40">
            Opslaan
          </button>
          <button type="button" onClick={()=>setRedenVoor(null)}
            className="text-xs text-muted-foreground">Annuleren</button>
        </div>}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Waarom voorgesteld?</summary>
          <div className="mt-2 space-y-1">
            {voorkeursroute.toelichting.matcht.map((t,i)=><p key={i}>✓ {t}</p>)}
            {voorkeursroute.toelichting.controleer.map((t,i)=><p key={i}>Te controleren: {t}</p>)}
            {voorkeursroute.toelichting.afwijkend.map((t,i)=><p key={i}>{t}</p>)}
          </div>
          {p.alleRoutes.length>1&&<div className="mt-3 space-y-2">
            <p>Andere zoekroutes</p>
            {p.alleRoutes.filter(route=>route.key!==voorkeursroute.key).map(route=>
              <div key={route.key} className="flex flex-wrap items-center gap-2">
                <span>{route.naam} · {kwalificatieLabel[route.kwalificatie]}</span>
                <button type="button" disabled={!props.onConceptGekozen || route.kwalificatie==='afwijkend'}
                  onClick={()=>kiesKandidaat(p,route)}
                  className="rounded border border-border px-2 py-1 disabled:opacity-40">
                  Kies deze route
                </button>
              </div>)}
          </div>}
        </details>
      </article>;
    })}
    {afgewezen.length>0&&<div className="border-t border-border/70 pt-3">
      <button type="button" onClick={()=>setToonAfgewezen(x=>!x)}
        className="text-xs text-muted-foreground">
        Eerder afgewezen ({afgewezen.length}) {toonAfgewezen?'verbergen':'tonen'}
      </button>
      {toonAfgewezen&&<div className="mt-2 space-y-2">
        {afgewezen.map(([relatieId,besluit])=>
          <div key={relatieId} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm break-words">{props.relatieNaam(relatieId)}</p>
              <p className="text-xs text-muted-foreground">
                {MATCH_AFWIJSREDENEN[besluit.redenCode??'']??'Niet passend'}
              </p>
            </div>
            <button type="button" disabled={!!bezig} onClick={()=>void herstel(relatieId)}
              className="rounded border border-border px-2.5 py-1.5 text-xs disabled:opacity-40">Herstellen</button>
          </div>)}
      </div>}
    </div>}
  </section>;
}
