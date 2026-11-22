/**
 * Eén beoordeelbare shortlist per object, met dezelfde beslissingen als Relaties.
 * "Interessant" is een selectie, geen aanbieding en geen pipelinekandidaat.
 * Alleen de expliciete actie "Kandidaat toevoegen" start het dealtraject.
 */
import { useMemo, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import { MatchOnderbouwing } from '@/components/matching/MatchOnderbouwing';
import type { ObjectBesluiten } from '@/hooks/useObjectMatchBesluiten';
import { bepaalInhoudelijkeVoorstelPrioriteit, rangVoorstelPrioriteit, VOORSTEL_LABELS } from '@/lib/matching/voorstelPrioriteit';
import { MATCH_AFWIJSREDENEN, sorteerVoorstellenOpBesluit, type MatchBesluitStatus } from '@/lib/matching/relatieObjectBesluiten';
import {
  isAanbiedbaar, maakKandidaatConcept, maakKandidaatVoorstellen,
  type CrmMandaatInput, type CrmObjectInput, type CrmRelatieInput,
  type KandidaatVoorstel, type ProfielRoute,
} from '../../lib/matching/rolMandaatAdapter';

type Concept = Extract<ReturnType<typeof maakKandidaatConcept>, { ok: true }>['concept'];

export interface KandidaatVoorstellenProps {
  object: CrmObjectInput;
  relaties: readonly CrmRelatieInput[];
  zoekprofielen: readonly CrmMandaatInput[];
  reedsGekoppeld: ReadonlySet<string>;
  relatieNaam: (relatieId: string) => string;
  /** Selectie is een concept; pas het bovenliggende dialoog kan koppelen. */
  onConceptGekozen?: (concept: Concept) => void;
  geselecteerdeRelatieId?: string | null;
  besluiten:ObjectBesluiten;
  besluitenGeladen:boolean;
  beoordelingenFout:string|null;
  onBeoordeel:(relatieId:string,status:MatchBesluitStatus,redenCode?:string|null)=>Promise<void>;
  onHerstel:(relatieId:string)=>Promise<void>;
}
export function KandidaatVoorstellenR2(props: KandidaatVoorstellenProps) {
  const [filter,setFilter]=useState<'relevant'|'kansrijk'|'controleren'|'overig'>('relevant');
  const [zoek,setZoek]=useState('');
  const [limiet,setLimiet]=useState(8);
  const [toonAfgewezen,setToonAfgewezen]=useState(false);
  const [redenVoor,setRedenVoor]=useState<string|null>(null);
  const [redenen,setRedenen]=useState<Record<string,string>>({});
  const [fout,setFout]=useState<string|null>(null);
  const [bezig,setBezig]=useState<string|null>(null);

  const alleVoorgesteld=useMemo(()=>{
    const berekend=maakKandidaatVoorstellen(props.object,props.relaties,props.zoekprofielen,
      {reedsGekoppeld:props.reedsGekoppeld,toonAfwijkende:true});
    const handmatigeBesluiten=Object.entries(props.besluiten).map(([relatieId,b])=>({
      relatieId,status:b.status,
    }));
    return sorteerVoorstellenOpBesluit(berekend,handmatigeBesluiten,props.reedsGekoppeld)
      .map(p=>{
        // De onderbouwde zoekroute heeft voorrang boven alleen een ruwe kwalificatie.
        const routes=[...p.alleRoutes].sort((a,b)=>
          rangVoorstelPrioriteit(bepaalInhoudelijkeVoorstelPrioriteit(b,props.object))-
          rangVoorstelPrioriteit(bepaalInhoudelijkeVoorstelPrioriteit(a,props.object)));
        return {...p,besteRoute:routes[0]??p.besteRoute};
      }).sort((a,b)=>{
        const voorkeur=Number(props.besluiten[b.relatieId]?.status==='interessant')-
          Number(props.besluiten[a.relatieId]?.status==='interessant');
        if(voorkeur)return voorkeur;
        return rangVoorstelPrioriteit(bepaalInhoudelijkeVoorstelPrioriteit(b.besteRoute,props.object))-
          rangVoorstelPrioriteit(bepaalInhoudelijkeVoorstelPrioriteit(a.besteRoute,props.object));
      });
  },[props.object,props.relaties,props.zoekprofielen,props.reedsGekoppeld,props.besluiten]);
  const beoordeeld=alleVoorgesteld.map(p=>({
    ...p, prioriteit:bepaalInhoudelijkeVoorstelPrioriteit(p.besteRoute,props.object),
  }));
  const aantalKansrijk=beoordeeld.filter(p=>p.prioriteit==='kansrijk').length;
  const aantalControleren=beoordeeld.filter(p=>p.prioriteit==='controleren').length;
  const aantalOverig=beoordeeld.filter(p=>p.prioriteit==='niet_aanbevolen' &&
    props.besluiten[p.relatieId]?.status!=='interessant').length;
  const relevantAantal=beoordeeld.length-aantalOverig;
  const zoekterm=zoek.trim().toLocaleLowerCase('nl-NL');
  const gefilterd=beoordeeld.filter(p=>{
    const interessant=props.besluiten[p.relatieId]?.status==='interessant';
    const inFilter=filter==='relevant'?(p.prioriteit!=='niet_aanbevolen'||interessant)
      :filter==='kansrijk'?p.prioriteit==='kansrijk'
      :filter==='controleren'?p.prioriteit==='controleren'
      :p.prioriteit==='niet_aanbevolen';
    return inFilter && (!zoekterm ||
      props.relatieNaam(p.relatieId).toLocaleLowerCase('nl-NL').includes(zoekterm) ||
      p.alleRoutes.some(r=>r.naam.toLocaleLowerCase('nl-NL').includes(zoekterm)));
  });
  const voorgesteld=gefilterd.slice(0,limiet);
  function kiesFilter(nieuw:typeof filter) {
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
    const handoff=maakKandidaatConcept(props.object,p,route.key);
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

  if(!isAanbiedbaar(props.object))return (
    <p className="text-sm text-muted-foreground">Dit object is niet beschikbaar voor nieuwe kandidaatsuggesties. De bestaande kandidaathistorie blijft behouden.</p>
  );
  if(!props.besluitenGeladen)return (
    <p className={props.beoordelingenFout?'text-sm text-destructive':'text-sm text-muted-foreground'} role={props.beoordelingenFout?'alert':'status'}>
      {props.beoordelingenFout??'Eerdere beoordelingen laden…'}
    </p>
  );

  return <section className="min-w-0 space-y-4" aria-label="Kandidaatvoorstellen">
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
        <input value={zoek} onChange={e=>{setZoek(e.target.value);setLimiet(8);}}
          placeholder="Zoek koper of zoekprofiel"
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" />
      </label>
    </div>
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
        data-testid="match-kandidaat-kaart"
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
        </div>
        <MatchOnderbouwing route={route} />
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <button type="button"
            aria-pressed={geselecteerd}
            disabled={!props.onConceptGekozen||!!bezig||isAfwijkend}
            onClick={()=>kiesKandidaat(p,route)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${geselecteerd
              ?'border-accent bg-accent/15 text-foreground'
              :'border-accent/70 bg-accent/10 text-foreground hover:bg-accent/20'}`}>
            {geselecteerd?<Check className="h-4 w-4" aria-hidden />:<UserPlus className="h-4 w-4" aria-hidden />}
            {geselecteerd?'Geselecteerd':'Selecteer kandidaat'}
          </button>
          {besluit?.status!=='interessant'&&<button type="button" disabled={!!bezig}
            onClick={()=>void beoordeel(p.relatieId,'interessant')}
            className="min-h-9 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-40">
            Interessant
          </button>}
          <button type="button" disabled={!!bezig}
            onClick={()=>setRedenVoor(x=>x===p.relatieId?null:p.relatieId)}
            className="min-h-9 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
            Niet passend
          </button>
        </div>
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
              <span className="min-w-0 break-words">{other.naam} · {VOORSTEL_LABELS[bepaalInhoudelijkeVoorstelPrioriteit(other,props.object)]}</span>
              <button type="button" disabled={!props.onConceptGekozen||other.kwalificatie==='afwijkend'}
                onClick={()=>kiesKandidaat(p,other)}
                className="min-h-8 rounded border border-border bg-background px-2.5 py-1.5 text-xs disabled:opacity-40">
                Selecteer route
              </button>
            </div>)}
          </div>
        </details>}
      </article>;
    })}
    {gefilterd.length>limiet&&<button type="button"
      onClick={()=>setLimiet(n=>n+8)}
      className="w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
      Toon volgende {Math.min(8,gefilterd.length-limiet)} van {gefilterd.length} voorstellen
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
