import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, RotateCcw, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ObjectVastgoed, Relatie, Zoekprofiel } from '@/data/mock-data';
import type { RelatieObjectBesluit, Rendementscriterium } from '@/hooks/useRelatieMatchingData';
import { maakObjectVoorstellenVoorRelatie } from '@/lib/matching/relatieObjectVoorstellenR2';
import { useDataStore } from '@/hooks/useDataStore';
import { maakBasisKandidaat } from '@/lib/pipeline/basisKandidaat';
import { MATCH_AFWIJSREDENEN } from '@/lib/matching/relatieObjectBesluiten';
import { beoordeelObjectRendement } from '@/lib/matching/rendementsOordeel';
import { bepaalVoorstelPrioriteit, rangVoorstelPrioriteit, VOORSTEL_LABELS } from '@/lib/matching/voorstelPrioriteit';

const REDENEN = MATCH_AFWIJSREDENEN;

type Props = {
  relatie:Relatie; objecten:readonly ObjectVastgoed[]; zoekprofielen:readonly Zoekprofiel[];
  criteria:Rendementscriterium[]; besluiten:RelatieObjectBesluit[]; loading:boolean; fout:string|null;
  onBesluit:(objectId:string,status:'interessant'|'afgewezen',reden?:string|null)=>Promise<void>;
  onWis:(objectId:string)=>Promise<void>;
};

export default function ObjectvoorstellenPanel({
  relatie,objecten,zoekprofielen,criteria,besluiten,loading,fout,onBesluit,onWis,
}:Props) {
  const {getPipelineVoorRelatie,addPipelineKandidaat} = useDataStore();
  const gekoppeldeKandidaten = getPipelineVoorRelatie(relatie.id);
  const inPipeline = new Set(gekoppeldeKandidaten.map(k=>k.objectId));
  const [toonControle,setToonControle]=useState(false);
  const [toonOverig,setToonOverig]=useState(false);
  const [toonAfgewezen,setToonAfgewezen]=useState(false);
  const [kansrijkLimiet,setKansrijkLimiet]=useState(8);
  const [redenKiezen,setRedenKiezen]=useState<string|null>(null);
  const [redenen,setRedenen]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);

  const matches=useMemo(()=>maakObjectVoorstellenVoorRelatie(relatie,objecten,zoekprofielen),
    [relatie,objecten,zoekprofielen]);
  const byObject=useMemo(()=>new Map(besluiten.map(b=>[b.objectId,b])),[besluiten]);
  const beoordeeld=useMemo(()=>matches.map(x=>{
    // Wanneer een apart zoekprofiel beter aansluit dan de algemene criteria,
    // gebruiken we die inhoudelijke zoekroute voor de presentatie.
    const routes=x.voorstel.alleRoutes.map(route=>{
      const rendement=beoordeelObjectRendement(x.object,criteria,route.zoekprofielId);
      const prioriteit=bepaalVoorstelPrioriteit(route,rendement,x.object);
      const bewijs=route.bewijs;
      const sterkte=Number(!!bewijs?.vastgoedtype)+Number(!!bewijs?.subcategorie)+
        Number(!!bewijs?.dealtype)+Number(!!bewijs?.locatie);
      return {route,rendement,prioriteit,sterkte};
    }).sort((a,b)=>rangVoorstelPrioriteit(b.prioriteit)-rangVoorstelPrioriteit(a.prioriteit) ||
      b.sterkte-a.sterkte);
    const beste=routes[0];
    return beste?{...x,...beste,besluit:byObject.get(x.object.id)}:null;
  }).filter((x):x is NonNullable<typeof x>=>x!==null),[matches,criteria,byObject]);

  const nieuw=beoordeeld.filter(x=>!x.besluit && !inPipeline.has(x.object.id));
  const kansrijk=nieuw.filter(x=>x.prioriteit==='kansrijk');
  const controle=nieuw.filter(x=>x.prioriteit==='controleren');
  const overige=nieuw.filter(x=>x.prioriteit==='niet_aanbevolen');

  // Eerdere handmatige keuzes blijven altijd zichtbaar, ook als matching
  // later wijzigt of een object niet meer proactief wordt aangeboden.
  const objectById=useMemo(()=>new Map(objecten.map(o=>[o.id,o])),[objecten]);
  const interessant=besluiten.filter(b=>b.status==='interessant' && !inPipeline.has(b.objectId))
    .map(b=>({besluit:b,object:objectById.get(b.objectId)}))
    .filter((x):x is {besluit:RelatieObjectBesluit;object:ObjectVastgoed}=>!!x.object);
  const afgewezen=besluiten.filter(b=>b.status==='afgewezen')
    .map(b=>({besluit:b,object:objectById.get(b.objectId)}))
    .filter((x):x is {besluit:RelatieObjectBesluit;object:ObjectVastgoed}=>!!x.object);

  async function beoordeel(id:string,status:'interessant'|'afgewezen') {
    setBusy(id);
    try {
      await onBesluit(id,status,status==='afgewezen'?(redenen[id]??'overig'):null);
      setRedenKiezen(null);
      toast.success(status==='interessant'?'Op je shortlist geplaatst':'Voorstel afgewezen');
    } catch(e) {
      toast.error(e instanceof Error?e.message:'Beoordeling niet opgeslagen');
    } finally {setBusy(null);}
  }
  async function voegAlsKandidaatToe(objectId:string) {
    if (inPipeline.has(objectId)) {
      toast.error('Deze partij is al kandidaat bij dit object.');
      return;
    }
    const object = objectById.get(objectId);
    if (!object || object.status!=='beschikbaar' || object.isArchived || object.softDeletedAt) {
      toast.error('Dit object is niet beschikbaar voor een nieuwe kandidaat.');
      return;
    }
    const match=beoordeeld.find(v=>v.object.id===objectId);
    setBusy(objectId);
    try {
      await addPipelineKandidaat(maakBasisKandidaat({
        objectId,relatieId:relatie.id,zoekprofielId:match?.route.zoekprofielId,
      }));
      toast.success('Kandidaat toegevoegd aan het dealtraject. Er is nog geen aanbieding geregistreerd.');
    } catch(e) {
      toast.error(e instanceof Error?e.message:'Kandidaat toevoegen mislukt');
    } finally {setBusy(null);}
  }
  async function reset(id:string) {
    setBusy(id);
    try {await onWis(id);toast.success('Beoordeling hersteld');}
    catch(e) {toast.error(e instanceof Error?e.message:'Terugzetten mislukt');}
    finally {setBusy(null);}
  }
  type Voorstel = typeof beoordeeld[number];
  function VoorstelRij({item}:{item:Voorstel}) {
    const id=item.object.id;
    const omschrijving=item.object.isPortefeuille && item.prioriteit==='controleren'
      ? 'Portefeuille: samenstelling en locaties per adres controleren'
      : VOORSTEL_LABELS[item.prioriteit];
    return <div className="px-5 py-3 space-y-2" key={id}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <Link to={`/objecten/${id}`} className="text-sm font-medium hover:text-accent break-words">
            {item.object.titel}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.object.plaats?.trim()||'Locatie onbekend'} · {omschrijving}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy===id} onClick={()=>void beoordeel(id,'interessant')}
          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
          <Check className="h-3.5 w-3.5"/> Interessant
        </button>
        <button type="button" disabled={busy===id} onClick={()=>setRedenKiezen(current=>current===id?null:id)}
          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
          <X className="h-3.5 w-3.5"/> Niet passend
        </button>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Onderbouwing</summary>
          <div className="mt-2 space-y-1">
            {item.route.toelichting.matcht.map((t,i)=><p key={i}>✓ {t}</p>)}
            {item.route.toelichting.controleer.map((t,i)=><p key={i}>Te controleren: {t}</p>)}
            {item.route.toelichting.afwijkend.map((t,i)=><p key={i}>{t}</p>)}
            {item.rendement.status!=='niet_van_toepassing'&&<p>Rendement: {item.rendement.uitleg}</p>}
          </div>
        </details>
      </div>
      {redenKiezen===id&&<div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/30 p-2">
        <label htmlFor={`reden-${id}`} className="text-xs text-muted-foreground">Reden</label>
        <select id={`reden-${id}`} value={redenen[id]??'overig'}
          onChange={e=>setRedenen(v=>({...v,[id]:e.target.value}))}
          className="rounded border border-input bg-background px-2 py-1.5 text-xs min-w-0 flex-1">
          {Object.entries(REDENEN).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" disabled={busy===id} onClick={()=>void beoordeel(id,'afgewezen')}
          className="rounded bg-accent px-2.5 py-1.5 text-xs text-accent-foreground disabled:opacity-50">
          Bewaren
        </button>
        <button type="button" onClick={()=>setRedenKiezen(null)}
          className="text-xs text-muted-foreground">Annuleren</button>
      </div>}
    </div>;
  }
  function Inklapgroep({open,setOpen,titel,rows}:{open:boolean;setOpen:(next:boolean)=>void;
    titel:string;rows:Voorstel[]}) {
    return <div className="border-t border-border/70">
      <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}
        className="w-full flex justify-between items-center gap-3 px-5 py-3 text-left text-xs text-muted-foreground hover:bg-muted/40">
        <span>{titel} ({rows.length})</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open&&<div className="divide-y divide-border/70">
        {rows.slice(0,30).map(x=><VoorstelRij key={x.object.id} item={x}/>)}
        {rows.length>30&&<p className="px-5 py-3 text-xs text-muted-foreground">
          Er zijn meer resultaten. Verfijn eerst de aankoopcriteria om gericht te beoordelen.
        </p>}
      </div>}
    </div>;
  }

  if(fout) return <section className="section-card px-5 py-4">
    <h2 className="section-title mb-2">Objectvoorstellen</h2>
    <p className="text-sm text-destructive">Eerdere beoordelingen konden niet worden opgehaald. Voorstellen blijven verborgen, zodat afgewezen objecten niet opnieuw verschijnen.</p>
  </section>;

  return <section className="section-card">
    <header className="section-header">
      <h2 className="section-title">Objectvoorstellen</h2>
      <span className="text-xs text-muted-foreground">
        {interessant.length} interessant · {kansrijk.length} nieuw kansrijk
      </span>
    </header>
    {loading&&<p className="px-5 py-3 text-xs text-muted-foreground">Beoordelingen laden…</p>}
    {!loading&&<div className="divide-y divide-border/70">
      {interessant.map(({object})=><div key={`interessant-${object.id}`}
        className="px-5 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/objecten/${object.id}`} className="text-sm font-medium hover:text-accent break-words">
            {object.titel}
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Door jou interessant bevonden</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {object.status==='beschikbaar' && !object.isArchived && !object.softDeletedAt && (
            <button type="button" disabled={busy===object.id}
              onClick={()=>void voegAlsKandidaatToe(object.id)}
              className="rounded border border-border px-2.5 py-1.5 inline-flex gap-1 items-center text-xs hover:bg-muted disabled:opacity-50">
              <UserPlus className="h-3.5 w-3.5"/> Kandidaat toevoegen
            </button>
          )}
          <button type="button" disabled={busy===object.id} onClick={()=>void reset(object.id)}
            aria-label="Beoordeling terugzetten" title="Beoordeling terugzetten"
            className="rounded border border-border p-2 text-muted-foreground disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>)}
      {kansrijk.slice(0,kansrijkLimiet).map(x=><VoorstelRij key={x.object.id} item={x}/>)}
      {interessant.length===0&&kansrijk.length===0&&
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Geen nieuwe kansrijke voorstellen op basis van de beschikbare zoekcriteria.
        </p>}
    </div>}
    {!loading&&kansrijk.length>kansrijkLimiet&&
      <button type="button" data-testid="meer-kansrijke-voorstellen"
        onClick={()=>setKansrijkLimiet(n=>n+8)}
        className="w-full px-5 py-3 text-left text-xs font-medium text-accent hover:bg-muted/40 border-t border-border/70">
        Toon volgende {Math.min(8,kansrijk.length-kansrijkLimiet)} kansrijke voorstellen
        <span className="ml-2 text-muted-foreground font-normal">
          ({Math.min(kansrijkLimiet,kansrijk.length)} van {kansrijk.length} zichtbaar)
        </span>
      </button>}
    {!loading&&controle.length>0&&<Inklapgroep open={toonControle} setOpen={setToonControle}
      titel="Nog inhoudelijk beoordelen" rows={controle}/>}
    {!loading&&overige.length>0&&<Inklapgroep open={toonOverig} setOpen={setToonOverig}
      titel="Overige, zwak onderbouwde indicaties" rows={overige}/>}
    {!loading&&afgewezen.length>0&&<div className="border-t border-border/70">
      <button type="button" aria-expanded={toonAfgewezen} onClick={()=>setToonAfgewezen(v=>!v)}
        className="w-full px-5 py-3 text-left text-xs text-muted-foreground hover:bg-muted/40">
        Eerder afgewezen ({afgewezen.length}) {toonAfgewezen?'verbergen':'tonen'}
      </button>
      {toonAfgewezen&&<div className="divide-y divide-border/70">
        {afgewezen.map(({object,besluit})=><div key={`afgewezen-${object.id}`}
          className="px-5 py-3 flex justify-between items-center gap-3">
          <div className="min-w-0">
            <Link to={`/objecten/${object.id}`} className="text-sm hover:text-accent break-words">
              {object.titel}
            </Link>
            <p className="text-xs text-muted-foreground mt-1">{REDENEN[besluit.redenCode??'']??'Niet passend'}</p>
          </div>
          <button type="button" disabled={busy===object.id} onClick={()=>void reset(object.id)}
            className="rounded border border-border px-2 py-1.5 text-xs disabled:opacity-50">
            Herstellen
          </button>
        </div>)}
      </div>}
    </div>}
  </section>;
}
