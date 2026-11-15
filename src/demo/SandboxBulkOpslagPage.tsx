import {useMemo,useRef,useState} from 'react';
import {CheckCircle2,Database,ShieldCheck} from 'lucide-react';
import {bouwKandidaatBulkVerzoek,type KandidaatBulkActie,type KandidaatBulkVerzoek} from '@/lib/pipeline/kandidaatBulkContract';
import {voerBulkUit} from '@/lib/pipeline/kandidaatBulkUitvoering';
import {INTERESSE_LABELS,PIPELINE_FASES,type InteresseNiveau,type PipelineFase} from '@/data/mock-data';
import {REACTIE_REDEN_LABELS,type ReactieReden} from '@/lib/relaties/aanbiedingsReacties';
import {DEMO_BULK_OBJECT_ID,maakFictieveBulkPoort} from './sandboxKandidaatBulkPoort';

type Proefscenario='normaal'|'conflict'|'netwerk';
type BulkType='interesse'|'fase'|'afwijzen';

export default function SandboxBulkOpslagPage(){
  // De testpoort wordt uitsluitend in geheugen aangemaakt. Geen Supabase SDK.
  const demo=useMemo(()=>maakFictieveBulkPoort(),[]);
  const [kandidaten,setKandidaten]=useState(demo.huidigeLijst);
  const [selectie,setSelectie]=useState<Set<string>>(new Set());
  const [bulkType,setBulkType]=useState<BulkType>('interesse');
  const [interesse,setInteresse]=useState<InteresseNiveau>('zeer_warm');
  const [fase,setFase]=useState<PipelineFase>('informatie_gedeeld');
  const [reden,setReden]=useState<ReactieReden|''>('locatie');
  const [toelichting,setToelichting]=useState('');
  const [scenario,setScenario]=useState<Proefscenario>('normaal');
  const [voorstel,setVoorstel]=useState<KandidaatBulkVerzoek|null>(null);
  const [onzekerVerzoek,setOnzekerVerzoek]=useState<KandidaatBulkVerzoek|null>(null);
  const [melding,setMelding]=useState('');
  const [fout,setFout]=useState('');
  const [bezig,setBezig]=useState(false);
  const bezigRef=useRef(false);
  const volgendeId=useRef(0);

  const gekozen=kandidaten.filter(k=>selectie.has(k.id));
  const audit=demo.audit();
  const actie=():KandidaatBulkActie=>bulkType==='interesse'
    ?{type:'interesse',niveau:interesse}
    :bulkType==='fase'?{type:'fase',fase:fase as Exclude<PipelineFase,'afgevallen'|'afgerond'>}
    :{type:'afwijzen',bron:'intern',categorie:reden as ReactieReden,anders:toelichting};
  const verlaatVoorstel=()=>{setVoorstel(null);setFout('');};
  const bereidVoor=()=>{
    if(onzekerVerzoek)return;
    try{
      const requestId='b4000000-0000-4000-8000-'+String(++volgendeId.current).padStart(12,'0');
      const verzoek=bouwKandidaatBulkVerzoek(DEMO_BULK_OBJECT_ID,requestId,gekozen,actie());
      setVoorstel(verzoek);setMelding('');setFout('');
    }catch(e){setFout(e instanceof Error?e.message:'Ongeldige selectie');setVoorstel(null);}
  };
  const voerUit=async (herhaal=false)=>{
    const verzoek=herhaal?onzekerVerzoek:voorstel;
    if(!verzoek||bezigRef.current)return;
    bezigRef.current=true;setBezig(true);setFout('');setMelding('');
    if(!herhaal && scenario==='conflict')demo.simuleerWijzigingVanuitAnderTabblad(verzoek.p_items[0].id);
    if(!herhaal && scenario==='netwerk')demo.verbreekVolgendeVerbindingNaOpslaan();
    try{
      const resultaat=await voerBulkUit(verzoek,demo.poort);
      if(resultaat.status==='opgeslagen'){
        setKandidaten(resultaat.kandidaten);
        setSelectie(new Set());setVoorstel(null);setOnzekerVerzoek(null);
        setMelding('Bevestigd opgeslagen: '+resultaat.resultaat.aangepast+
          ' gewijzigd, '+resultaat.resultaat.ongewijzigd+
          ' ongewijzigd. Lijst opnieuw geladen.');
      }else if(resultaat.status==='opgeslagen_niet_ververst'){
        setVoorstel(null);setOnzekerVerzoek(null);
        setMelding(resultaat.melding);
      }else if(resultaat.status==='onzeker'){
        setVoorstel(null);setOnzekerVerzoek(resultaat.verzoek);
        setFout(resultaat.melding+' Verzoek-ID blijft identiek.');
      }else{
        setVoorstel(null);setOnzekerVerzoek(null);
        setFout(resultaat.melding);
      }
    }finally{bezigRef.current=false;setBezig(false);}
  };
  const ververs=async()=>{
    setKandidaten(await demo.poort.ververs(DEMO_BULK_OBJECT_ID));
    setSelectie(new Set());setVoorstel(null);setFout('');
    setMelding('Fictieve gegevens vernieuwd. Kies opnieuw welke kandidaten je wilt wijzigen.');
  };

  return <div className="space-y-5">
    <div className="space-y-2">
      <p className="uppercase tracking-wider text-accent font-semibold text-xs">Afzonderlijke opslagproef</p>
      <h1 className="text-2xl font-semibold">Transactionele kandidatenbulk</h1>
      <p className="text-sm text-muted-foreground">
        Simuleer het volledige pad: kandidaten selecteren, voorstel controleren, opslaan,
        serverantwoord controleren en de actuele lijst opnieuw ophalen.
        Alle gegevens en fouten worden uitsluitend in deze browserproef nagebootst.
      </p>
    </div>
    <section className="section-card p-4 sm:p-6 space-y-4">
      <div className="flex gap-2 items-center">
        <Database className="h-5 w-5 text-accent"/>
        <h2 className="section-title">Fictief object – kandidaatselectie</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {kandidaten.length} fictieve kandidaten · {gekozen.length} geselecteerd.
        Afgevallen partijen zijn zichtbaar, maar niet selecteerbaar.
      </p>
      <div className="grid gap-2 sm:grid-cols-2" aria-label="Opslagproef kandidatenlijst">
        {kandidaten.map(k=><label key={k.id} className="flex items-start gap-3 border border-border/70 rounded-lg p-3">
          <input type="checkbox" className="mt-1" checked={selectie.has(k.id)}
            aria-label={'Selecteer opslagproef '+k.naam}
            disabled={bezig||!!onzekerVerzoek||k.pipelineFase==='afgevallen'||k.pipelineFase==='afgerond'}
            onChange={e=>{
              setSelectie(prev=>{const next=new Set(prev);
                if(e.target.checked)next.add(k.id);else next.delete(k.id);return next;});
              verlaatVoorstel();
            }}/>
          <span className="min-w-0">
            <strong className="block text-sm">{k.naam}</strong>
            <span className="block text-xs text-muted-foreground">
              {PIPELINE_FASES.find(f=>f.key===k.pipelineFase)?.label} · {INTERESSE_LABELS[k.interesseNiveau]}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              versie {k.updatedAt.slice(11,26)}
            </span>
          </span>
        </label>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs space-y-1">
          <span>Bulkwijziging</span>
          <select aria-label="Soort opslagproef" value={bulkType}
            disabled={!!onzekerVerzoek} onChange={e=>{setBulkType(e.target.value as BulkType);verlaatVoorstel();}}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            <option value="interesse">Interesseniveau wijzigen</option>
            <option value="fase">Pipelinefase wijzigen</option>
            <option value="afwijzen">Intern afvallen met reden</option>
          </select>
        </label>
        {bulkType==='interesse'&&<label className="block text-xs space-y-1">
          <span>Nieuw interesseniveau</span>
          <select aria-label="Nieuw opslagniveau" value={interesse}
            disabled={!!onzekerVerzoek} onChange={e=>{setInteresse(e.target.value as InteresseNiveau);verlaatVoorstel();}}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            {Object.entries(INTERESSE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </label>}
        {bulkType==='fase'&&<label className="block text-xs space-y-1">
          <span>Nieuwe fase</span>
          <select aria-label="Nieuwe opslagfase" value={fase}
            disabled={!!onzekerVerzoek} onChange={e=>{setFase(e.target.value as PipelineFase);verlaatVoorstel();}}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            {PIPELINE_FASES.filter(f=>!['afgevallen','afgerond'].includes(f.key))
              .map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>}
        {bulkType==='afwijzen'&&<label className="block text-xs space-y-1">
          <span>Interne afwijzingscategorie</span>
          <select aria-label="Interne opslagreden" value={reden}
            disabled={!!onzekerVerzoek} onChange={e=>{setReden(e.target.value as ReactieReden);verlaatVoorstel();}}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            {Object.entries(REACTIE_REDEN_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </label>}
        {bulkType==='afwijzen'&&reden==='anders'&&<label className="block text-xs space-y-1 sm:col-span-2">
          <span>Toelichting</span>
          <input aria-label="Toelichting opslagreden" value={toelichting}
            onChange={e=>{setToelichting(e.target.value);verlaatVoorstel();}}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm"/>
        </label>}
        <label className="block text-xs space-y-1">
          <span>Testsituatie</span>
          <select aria-label="Opslagscenario" value={scenario} disabled={!!onzekerVerzoek}
            onChange={e=>setScenario(e.target.value as Proefscenario)}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            <option value="normaal">Normaal opslaan</option>
            <option value="conflict">Ander tabblad wijzigt kandidaat</option>
            <option value="netwerk">Verbinding valt weg ná opslag</option>
          </select>
        </label>
      </div>
      {fout&&<p role="alert" className="text-sm text-destructive">{fout}</p>}
      {melding&&<p role="status" className="text-sm font-medium">{melding}</p>}
      {onzekerVerzoek&&<div className="border border-border rounded-md p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Status onbekend: hetzelfde verzoek-ID opnieuw aanbieden.
          Een nieuw verzoek maken is geblokkeerd totdat dit is opgelost.</p>
        <button type="button" disabled={bezig} onClick={()=>void voerUit(true)}
          className="bg-accent text-accent-foreground rounded-md px-3 py-2 text-sm">
          Opnieuw proberen met hetzelfde verzoek-ID
        </button>
      </div>}
      {voorstel&&!onzekerVerzoek&&<div className="border border-border rounded-lg p-3 space-y-2"
        aria-label="Opslagvoorstel">
        <strong className="text-sm">Controle voor definitieve proef</strong>
        <p className="text-xs text-muted-foreground">
          {gekozen.map(k=>k.naam).join(', ')} · {bulkType==='interesse'
            ?'interesse naar '+INTERESSE_LABELS[interesse]
            :bulkType==='fase'?'fase naar '+(PIPELINE_FASES.find(f=>f.key===fase)?.label??fase)
            :'intern uitgesloten wegens '+REACTIE_REDEN_LABELS[reden as ReactieReden]}
        </p>
        <button type="button" disabled={bezig} onClick={()=>void voerUit()}
          className="rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm">
          Bevestig opslagproef voor {gekozen.length} kandidaten
        </button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={gekozen.length===0||bezig||!!onzekerVerzoek}
          onClick={bereidVoor} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50">
          Voorstel controleren
        </button>
        <button type="button" disabled={bezig||!!onzekerVerzoek}
          onClick={()=>void ververs()} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50">
          Ververs fictieve lijst
        </button>
      </div>
    </section>
    <section className="section-card p-4 space-y-3">
      <h2 className="section-title flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/>
        Auditregistraties in de proef ({audit.length})
      </h2>
      {audit.length===0?<p className="text-xs text-muted-foreground">Nog geen wijzigingen opgeslagen.</p>:
        <div className="space-y-2">
          {audit.map((r,i)=><p className="text-xs border-b border-border/60 pb-2" key={i}>
            <strong>{r.kandidaatNaam}</strong> · {r.actie} · {r.van} → {r.naar}
            {r.bron&&' · '+r.bron+' / '+r.categorie}
          </p>)}
        </div>}
    </section>
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4 shrink-0"/>
      Dit is géén echte database. De verwerking gebeurt alleen in browsergeheugen;
      er is geen netwerkverzoek, geen Supabase-client en geen wijziging aan productie.
      Bij echte opslag moet een herstelactie apart worden geaudit, niet alleen lokaal ongedaan gemaakt.
    </p>
  </div>;
}
