/**
 * Eén beoordeelbare shortlist per object, met dezelfde beslissingen als Relaties.
 * "Interessant" is een selectie, geen aanbieding en geen pipelinekandidaat.
 * Alleen de expliciete actie "Kandidaat toevoegen" start het dealtraject.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { herstelKandidaatVolgorde, type KandidaatTerugkeer, type KandidaatFilter } from '@/lib/matching/kandidaatSelectieTerugkeer';
import { Check, Search, UserPlus, ArrowUpRight } from 'lucide-react';
import { MatchOnderbouwing } from '@/components/matching/MatchOnderbouwing';
import type { ObjectBesluiten } from '@/hooks/useObjectMatchBesluiten';
import { useMatchingRendementscriteria, type Rendementscriterium } from '@/hooks/useRelatieMatchingData';
import { bepaalMatchBewijskwaliteit, vergelijkMatchBewijs } from '@/lib/matching/matchBewijskwaliteit';
import { beoordeelObjectRendement } from '@/lib/matching/rendementsOordeel';
import type { ObjectVastgoed } from '@/data/mock-data';
import { bepaalVoorstelPrioriteit, rangVoorstelPrioriteit, VOORSTEL_LABELS } from '@/lib/matching/voorstelPrioriteit';
import { MATCH_AFWIJSREDENEN, sorteerVoorstellenOpBesluit, type MatchBesluitStatus } from '@/lib/matching/relatieObjectBesluiten';
import {
  isAanbiedbaar, maakKandidaatConcept, maakKandidaatVoorstellen,
  type CrmMandaatInput, type CrmObjectInput, type CrmRelatieInput,
  type KandidaatVoorstel, type ProfielRoute,
} from '../../lib/matching/rolMandaatAdapter';

type Concept = Extract<ReturnType<typeof maakKandidaatConcept>, { ok: true }>['concept'];

export interface KandidaatVoorstellenProps {
  object: CrmObjectInput & Pick<ObjectVastgoed,'brutoAanvangsrendement'|'nettoAanvangsrendement'|'huurinkomsten'>;
  laadRendementscriteria?: boolean;
  focusRelatieId?: string | null;
  terugkeer?: KandidaatTerugkeer | null;
  relaties: readonly CrmRelatieInput[];
  zoekprofielen: readonly CrmMandaatInput[];
  reedsGekoppeld: ReadonlySet<string>;
  relatieNaam: (relatieId: string) => string;
  /** Selectie is een concept; pas het bovenliggende dialoog kan koppelen. */
  onConceptGekozen?: (concept: Concept) => void;
  onOpenRelatie?: (relatieId: string, terugkeer: KandidaatTerugkeer) => void;
  geselecteerdeRelatieId?: string | null;
  besluiten:ObjectBesluiten;
  besluitenGeladen:boolean;
  beoordelingenFout:string|null;
  onBeoordeel:(relatieId:string,status:MatchBesluitStatus,redenCode?:string|null)=>Promise<void>;
  onHerstel:(relatieId:string)=>Promise<void>;
}
export function KandidaatVoorstellenR2(props: KandidaatVoorstellenProps) {
  const [terug,setTerug]=useState(props.terugkeer??null);
  const [filter,setFilter]=useState<KandidaatFilter>(terug?.filter??(props.focusRelatieId?'terug':'relevant'));
  const [zoek,setZoek]=useState(terug?.zoek??'');
  const [limiet,setLimiet]=useState(terug?.limiet??8);
  const lijstRef=useRef<HTMLElement|null>(null);
  const scrollHersteld=useRef(false);
  const [toonAfgewezen,setToonAfgewezen]=useState(false);
  const [redenVoor,setRedenVoor]=useState<string|null>(null);
  const [redenen,setRedenen]=useState<Record<string,string>>({});
  const [fout,setFout]=useState<string|null>(null);
  const [bezig,setBezig]=useState<string|null>(null);

  const financieel=useMatchingRendementscriteria(!!props.laadRendementscriteria);
  const perRelatie=useMemo(()=>{
    const map=new Map<string,Rendementscriterium[]>();
    for(const c of financieel.criteria){const list=map.get(c.relatieId)??[];list.push(c);map.set(c.relatieId,list);}
    return map;
  },[financieel.criteria]);
  const alleVoorgesteld=useMemo(()=>{
    const beoordeel=(relatieId:string,route:ProfielRoute)=>{
      const rendement=beoordeelObjectRendement(props.object,perRelatie.get(relatieId)??[],route.zoekprofielId);
      return {route,rendement,prioriteit:bepaalVoorstelPrioriteit(route,rendement,props.object),kwaliteit:bepaalMatchBewijskwaliteit(route,rendement)};
    };
    const berekend=maakKandidaatVoorstellen(props.object,props.relaties,props.zoekprofielen,
      {reedsGekoppeld:props.reedsGekoppeld,toonAfwijkende:true});
    const handmatigeBesluiten=Object.entries(props.besluiten).map(([relatieId,b])=>({
      relatieId,status:b.status,
    }));
    return sorteerVoorstellenOpBesluit(berekend,handmatigeBesluiten,props.reedsGekoppeld)
      .map(p=>{
        // De onderbouwde zoekroute heeft voorrang boven alleen een ruwe kwalificatie.
        const routes=p.alleRoutes.map(r=>beoordeel(p.relatieId,r)).sort((a,b)=>
          rangVoorstelPrioriteit(b.prioriteit)-rangVoorstelPrioriteit(a.prioriteit)||vergelijkMatchBewijs(a.kwaliteit,b.kwaliteit));
        const beste=routes[0]??beoordeel(p.relatieId,p.besteRoute);
        return {...p,besteRoute:beste.route,rendement:beste.rendement,prioriteit:beste.prioriteit,kwaliteit:beste.kwaliteit,financieleRoutes:routes};
      }).sort((a,b)=>{
        const voorkeur=Number(props.besluiten[b.relatieId]?.status==='interessant')-
          Number(props.besluiten[a.relatieId]?.status==='interessant');
        if(voorkeur)return voorkeur;
        return rangVoorstelPrioriteit(b.prioriteit)-rangVoorstelPrioriteit(a.prioriteit)||vergelijkMatchBewijs(a.kwaliteit,b.kwaliteit);
      });
  },[props.object,props.relaties,props.zoekprofielen,props.reedsGekoppeld,props.besluiten,perRelatie]);
  const beoordeeld=alleVoorgesteld;
  const aantalKansrijk=beoordeeld.filter(p=>p.prioriteit==='kansrijk').length;
  const aantalControleren=beoordeeld.filter(p=>p.prioriteit==='controleren').length;
  const aantalOverig=beoordeeld.filter(p=>p.prioriteit==='niet_aanbevolen' &&
    props.besluiten[p.relatieId]?.status!=='interessant').length;
  const relevantAantal=beoordeeld.length-aantalOverig;
  const shortlistAantal=beoordeeld.filter(p=>props.besluiten[p.relatieId]?.status==='interessant').length;
  const zoekterm=zoek.trim().toLocaleLowerCase('nl-NL');
  const normaalGefilterd=beoordeeld.filter(p=>{
    const interessant=props.besluiten[p.relatieId]?.status==='interessant';
    const inFilter=filter==='terug'?p.relatieId===props.focusRelatieId
      :filter==='shortlist'?interessant
      :filter==='relevant'?(p.prioriteit!=='niet_aanbevolen'||interessant)
      :filter==='kansrijk'?p.prioriteit==='kansrijk'
      :filter==='controleren'?p.prioriteit==='controleren'
      :p.prioriteit==='niet_aanbevolen'&&!interessant;
    return inFilter && (!zoekterm ||
      props.relatieNaam(p.relatieId).toLocaleLowerCase('nl-NL').includes(zoekterm) ||
      p.alleRoutes.some(r=>r.naam.toLocaleLowerCase('nl-NL').includes(zoekterm)));
  });
  const gefilterd=herstelKandidaatVolgorde(normaalGefilterd,beoordeeld,terug);
  const focusIndex=terug?gefilterd.findIndex(p=>p.relatieId===terug.relatieId):-1;
  const zichtbareLimiet=Math.max(limiet,focusIndex+1);
  const voorgesteld=gefilterd.slice(0,zichtbareLimiet);
  function kiesFilter(nieuw:typeof filter) {
    setTerug(null);
    setFilter(nieuw);
    setLimiet(8);
  }

  const afgewezen=Object.entries(props.besluiten)
    .filter(([relatieId,b])=>b.status==='afgewezen'&&!props.reedsGekoppeld.has(relatieId));

  function kiesKandidaat(p:KandidaatVoorstel,route:ProfielRoute) {
    if(!props.onConceptGekozen)return;
    if(props.besluiten[p.relatieId]?.status==='afgewezen'){
      setFout('Deze partij is al afgewezen. Herstel eerst de beoordeling.');
      return;
    }
    const handoff=maakKandidaatConcept(props.object,p,route.key,{handmatigeAfwijking:route.kwalificatie==='afwijkend'});
    if(!handoff.ok){setFout(handoff.reden);return;}
    setFout(null);
    props.onConceptGekozen(handoff.concept);
  }

  async function beoordeel(relatieId:string,status:MatchBesluitStatus) {
    setBezig(relatieId);
    try {
      await props.onBeoordeel(relatieId,status,
        status==='afgewezen'?(redenen[relatieId]??'overig'):null);
      setRedenVoor(null);
      setFout(null);
    } catch {
      setFout('Beoordeling kon niet worden opgeslagen.');
    } finally {setBezig(null);}
  }
  async function herstel(relatieId:string) {
    setBezig(relatieId);
    try {
      await props.onHerstel(relatieId);
      setFout(null);
    } catch {
      setFout('Beoordeling kon niet worden hersteld.');
    } finally {setBezig(null);}
  }

  function openProfiel(relatieId:string,button:HTMLElement){
    const region=button.closest<HTMLElement>('[data-testid="kandidaat-voorstellen-scroll"]');
    const kaart=button.closest<HTMLElement>('[data-relatie-id]');
    const openDetails:Record<string,number[]>={};
    for(const card of lijstRef.current?.querySelectorAll<HTMLElement>('[data-relatie-id]')??[]){
      const id=card.dataset.relatieId;
      if(id)openDetails[id]=Array.from(card.querySelectorAll('details')).flatMap((d,i)=>d.open?[i]:[]);
    }
    props.onOpenRelatie?.(relatieId,{
      objectId:props.object.id,relatieId,filter,zoek,limiet:zichtbareLimiet,
      volgorde:gefilterd.map(p=>p.relatieId),scrollTop:region?.scrollTop??0,
      kaartOffset:region&&kaart?kaart.getBoundingClientRect().top-region.getBoundingClientRect().top:null,
      openDetails,
    });
  }
  const klaar=props.besluitenGeladen && (!props.laadRendementscriteria || (!financieel.loading&&!financieel.fout));
  useEffect(()=>{
    if(!terug || !klaar || scrollHersteld.current || !lijstRef.current)return;
    const lijst=lijstRef.current;
    const region=lijst.closest<HTMLElement>('[data-testid="kandidaat-voorstellen-scroll"]');
    if(!region)return;
    const kaarten=Array.from(lijst.querySelectorAll<HTMLElement>('[data-relatie-id]'));
    for(const card of kaarten){
      const indices=terug.openDetails[card.dataset.relatieId??'']??[];
      card.querySelectorAll('details').forEach((d,i)=>{d.open=indices.includes(i);});
    }
    let tweede=0;
    const eerste=requestAnimationFrame(()=>{
      tweede=requestAnimationFrame(()=>{
        const kaart=kaarten.find(c=>c.dataset.relatieId===terug.relatieId);
        if(kaart && terug.kaartOffset!==null){
          region.scrollTop+=kaart.getBoundingClientRect().top-region.getBoundingClientRect().top-terug.kaartOffset;
        }else region.scrollTop=terug.scrollTop;
        scrollHersteld.current=true;
      });
    });
    return ()=>{cancelAnimationFrame(eerste);cancelAnimationFrame(tweede);};
  },[terug,klaar,zichtbareLimiet]);

  if(!isAanbiedbaar(props.object))return (
    <p className="text-sm text-muted-foreground">Dit object is niet beschikbaar voor nieuwe kandidaatsuggesties. De bestaande kandidaathistorie blijft behouden.</p>
  );
  if(!props.besluitenGeladen)return (
    <p className={props.beoordelingenFout?'text-sm text-destructive':'text-sm text-muted-foreground'} role={props.beoordelingenFout?'alert':'status'}>
      {props.beoordelingenFout??'Eerdere beoordelingen laden…'}
    </p>
  );

  if(props.laadRendementscriteria && (financieel.loading||financieel.fout))return <p className={financieel.fout?'text-sm text-destructive':'text-sm text-muted-foreground'} role={financieel.fout?'alert':'status'}>{financieel.fout??'Rendementscriteria laden…'}</p>;
  return <section ref={lijstRef} className="min-w-0 space-y-4" aria-label="Kandidaatvoorstellen">
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Kopersselectie</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gebaseerd op vastgelegde zoekcriteria. Controleer ontbrekende voorwaarden vóór benadering.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{relevantAantal} relevante indicaties</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filter kandidaten">
        {([
          {value:'relevant',label:'Relevant',count:relevantAantal},
          {value:'shortlist',label:'Shortlist',count:shortlistAantal},
          {value:'kansrijk',label:'Kansrijk',count:aantalKansrijk},
          {value:'controleren',label:'Controle nodig',count:aantalControleren},
          {value:'overig',label:'Overig',count:aantalOverig},
        ] as const).map(opt=><button type="button" key={opt.value}
          aria-pressed={filter===opt.value}
          onClick={()=>kiesFilter(opt.value)}
          className={`min-w-0 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${filter===opt.value
            ?'border-primary bg-primary text-primary-foreground'
            :'border-border bg-background text-foreground hover:bg-muted'}`}>
          {opt.label} <span className="ml-1 tabular-nums opacity-70">{opt.count}</span>
        </button>)}
      </div>
      <label className="relative block min-w-0">
        <span className="sr-only">Zoek koper of zoekprofiel</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input value={zoek} onChange={e=>{setTerug(null);setZoek(e.target.value);setLimiet(8);}}
          placeholder="Zoek koper of zoekprofiel"
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" />
      </label>
    </div>
    {terug&&<p className="text-xs text-muted-foreground">Je vorige filter en lijstpositie zijn hersteld. De matchbeoordeling is bijgewerkt; nieuwe voorstellen staan na de eerdere lijst.</p>}
    {filter==='terug'&&!terug&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"><span>Kopersprofiel opnieuw beoordeeld op basis van de actuele gegevens.</span><button type="button" className="text-accent font-medium" onClick={()=>kiesFilter('relevant')}>Alle relevante voorstellen</button></div>}
    {fout&&<p className="text-xs text-destructive" role="alert">{fout}</p>}
    {gefilterd.length===0&&<p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      Geen voorstellen in deze selectie. Pas het filter aan of gebruik ‘Alle relaties’ voor een handmatige koppeling.
    </p>}
    {voorgesteld.map(p=>{
      const besluit=props.besluiten[p.relatieId];
      const route=p.besteRoute;
      const geselecteerd=props.geselecteerdeRelatieId===p.relatieId;
      const isAfwijkend=route.kwalificatie==='afwijkend';
      return <article key={p.relatieId}
        data-testid="match-kandidaat-kaart" data-relatie-id={p.relatieId}
        className={`min-w-0 rounded-xl border bg-card p-3 sm:p-4 space-y-3 ${geselecteerd?'border-accent ring-1 ring-accent/40':'border-border'}`}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="break-words text-sm font-semibold text-foreground">{props.relatieNaam(p.relatieId)}</h4>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {route.bron==='zoekprofiel'?`Zoekprofiel: ${route.naam}`:'Algemene aankoopcriteria'}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${besluit?.status==='interessant'
            ?'border-emerald-400/50 bg-emerald-50 text-emerald-800'
            :p.prioriteit==='kansrijk'
              ?'border-emerald-400/50 bg-emerald-50 text-emerald-800'
              :p.prioriteit==='controleren'
                ?'border-amber-400/50 bg-amber-50 text-amber-900'
                :'border-border bg-muted text-muted-foreground'}`}>
            {besluit?.status==='interessant'?'Jouw shortlist':VOORSTEL_LABELS[p.prioriteit]}
          </span>
          {besluit?.status==='interessant'&&<span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{VOORSTEL_LABELS[p.prioriteit]}</span>}
        </div>
        {terug?.relatieId===p.relatieId&&!normaalGefilterd.some(x=>x.relatieId===p.relatieId)&&<p className="text-xs text-muted-foreground">Na de profielwijziging valt deze relatie buiten het actieve filter; tijdelijk zichtbaar op je vorige plek.</p>}
        <MatchOnderbouwing route={route} rendement={p.rendement} />
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <button type="button"
            aria-pressed={geselecteerd}
            disabled={!props.onConceptGekozen||!!bezig}
            onClick={()=>kiesKandidaat(p,route)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${geselecteerd
              ?'border-accent bg-accent/15 text-foreground'
              :'border-accent/70 bg-accent/10 text-foreground hover:bg-accent/20'}`}>
            {geselecteerd?<Check className="h-4 w-4" aria-hidden />:<UserPlus className="h-4 w-4" aria-hidden />}
            {geselecteerd?'Geselecteerd':isAfwijkend?'Handmatig selecteren':'Selecteer kandidaat'}
          </button>
          {besluit?.status!=='interessant'&&<button type="button" disabled={!!bezig}
            onClick={()=>void beoordeel(p.relatieId,'interessant')}
            className="min-h-9 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-40">
            Interessant
          </button>}
          {besluit?.status==='interessant'&&<button type="button" disabled={!!bezig} onClick={()=>void herstel(p.relatieId)} className="min-h-9 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted">Uit shortlist</button>}
          {props.onOpenRelatie&&<button type="button"
            onClick={e=>openProfiel(p.relatieId,e.currentTarget)}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Kopersprofiel <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </button>}
          <button type="button" disabled={!!bezig}
            onClick={()=>setRedenVoor(x=>x===p.relatieId?null:p.relatieId)}
            className="min-h-9 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
            Niet passend
          </button>
        </div>
        {isAfwijkend&&<p className="text-xs text-muted-foreground">Afwijkende criteria blijven zichtbaar; je kunt deze partij bewust handmatig selecteren of het kopersprofiel aanpassen.</p>}
        {redenVoor===p.relatieId&&<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
          <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
            <span>Reden van afwijzing</span>
            <select aria-label="Afwijsreden" value={redenen[p.relatieId]??'overig'}
              onChange={e=>setRedenen(prev=>({...prev,[p.relatieId]:e.target.value}))}
              className="min-h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground">
              {Object.entries(MATCH_AFWIJSREDENEN).map(([code,naam])=><option key={code} value={code}>{naam}</option>)}
            </select>
          </label>
          <button type="button" disabled={!!bezig} onClick={()=>void beoordeel(p.relatieId,'afgewezen')}
            className="min-h-9 self-end rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40">
            Afwijzen
          </button>
          <button type="button" onClick={()=>setRedenVoor(null)}
            className="min-h-9 self-end rounded-md px-2 py-2 text-xs text-muted-foreground">Annuleren</button>
        </div>}
        {p.alleRoutes.length>1&&<details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer rounded-md py-1 hover:text-foreground">
            Andere zoekprofielen ({p.alleRoutes.length-1})
          </summary>
          <div className="mt-2 space-y-2">
            {p.alleRoutes.filter(x=>x.key!==route.key).map(other=><div key={other.key}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <span className="min-w-0 break-words">{other.naam} · {VOORSTEL_LABELS[p.financieleRoutes.find(x=>x.route.key===other.key)?.prioriteit??'niet_aanbevolen']}</span>
              <button type="button" disabled={!props.onConceptGekozen||!!bezig}
                onClick={()=>kiesKandidaat(p,other)}
                className="min-h-8 rounded border border-border bg-background px-2.5 py-1.5 text-xs disabled:opacity-40">
                {other.kwalificatie==='afwijkend'?'Handmatig selecteren':'Selecteer route'}
              </button>
            </div>)}
          </div>
        </details>}
      </article>;
    })}
    {gefilterd.length>zichtbareLimiet&&<button type="button"
      onClick={()=>setLimiet(zichtbareLimiet+8)}
      className="w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
      Toon volgende {Math.min(8,gefilterd.length-zichtbareLimiet)} van {gefilterd.length} voorstellen
    </button>}
    {afgewezen.length>0&&<div className="border-t border-border pt-3">
      <button type="button" aria-expanded={toonAfgewezen} onClick={()=>setToonAfgewezen(x=>!x)}
        className="text-xs text-muted-foreground hover:text-foreground">
        Eerder afgewezen ({afgewezen.length}) {toonAfgewezen?'verbergen':'tonen'}
      </button>
      {toonAfgewezen&&<div className="mt-2 space-y-2">
        {afgewezen.map(([relatieId,besluit])=><div key={relatieId}
          className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{props.relatieNaam(relatieId)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {MATCH_AFWIJSREDENEN[besluit.redenCode??'']??'Niet passend'}
            </p>
          </div>
          <button type="button" disabled={!!bezig} onClick={()=>void herstel(relatieId)}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Herstellen</button>
        </div>)}
      </div>}
    </div>}
    <p className="px-1 text-xs leading-5 text-muted-foreground">
      Voorstellen zijn indicatief. De selectie registreert nog geen aanbieding; alleen de
      expliciete bevestiging onderaan voegt een kandidaat toe aan het dealtraject.
    </p>
  </section>;
}
