import { useMemo, useState } from 'react';
import { CheckSquare2, ShieldCheck } from 'lucide-react';
import ObjectPipelineActies from '@/components/pipeline/ObjectPipelineActies';
import {
  KANDIDAAT_SORTEEROPTIES,sorteerObjectKandidaten,type KandidaatSorteerwijze,
} from '@/lib/pipeline/kandidaatSortering';
import { INTERESSE_LABELS, PIPELINE_FASES, type InteresseNiveau, type PipelineFase } from '@/data/mock-data';
import { REACTIE_REDEN_LABELS, type ReactieReden } from '@/lib/relaties/aanbiedingsReacties';
import {
  fictieveKandidaten,pasFictieveBulkActieToe,type BulkProefActie,type ProefKandidaat,
} from './kandidaatBulkProefModel';

type Actie = 'toevoegen' | 'aanbieding' | 'reactie' | null;
type Filter = 'actief' | 'afgevallen' | 'alle';
type BulkType = 'afwijzen' | 'fase' | 'interesse';

const faseLabel=(fase:PipelineFase)=>
  PIPELINE_FASES.find(s=>s.key===fase)?.label??fase;
const getFilter=(fase:PipelineFase,filter:Filter)=>
  filter==='alle'||(filter==='afgevallen'?fase==='afgevallen':fase!=='afgevallen'&&fase!=='afgerond');

/**
 * Alleen fictieve kandidaatdata. De bulkacties bevatten geen datastore,
 * Supabase-client of verzendactie en simuleren geen echte contactmomenten.
 */
export default function SandboxKandidatenPage(){
  const [kandidaten,setKandidaten]=useState(fictieveKandidaten);
  const [actie,setActie]=useState<Actie>(null);
  const [filter,setFilter]=useState<Filter>('actief');
  const [sortering,setSortering]=useState<KandidaatSorteerwijze>('aanbevolen');
  const [selectie,setSelectie]=useState<Set<string>>(new Set());
  const [bulkType,setBulkType]=useState<BulkType>('afwijzen');
  const [reden,setReden]=useState<ReactieReden|''>('');
  const [anders,setAnders]=useState('');
  const [fase,setFase]=useState<PipelineFase>('informatie_gedeeld');
  const [interesse,setInteresse]=useState<InteresseNiveau>('warm');
  const [melding,setMelding]=useState('');
  const [fout,setFout]=useState('');
  const [voorbeeldSleutel,setVoorbeeldSleutel]=useState<string|null>(null);
  const [laatsteSnapshot,setLaatsteSnapshot]=useState<ProefKandidaat[]|null>(null);

  const gefilterd=useMemo(()=>kandidaten.filter(k=>getFilter(k.pipelineFase,filter)),[kandidaten,filter]);
  const zichtbaar=useMemo(()=>sorteerObjectKandidaten(gefilterd,sortering,k=>k.naam),[gefilterd,sortering]);
  const allemaalGeselecteerd=zichtbaar.length>0&&zichtbaar.every(k=>selectie.has(k.id));
  const selecteerAlle=()=>{
    setSelectie(allemaalGeselecteerd?new Set():new Set(zichtbaar.map(k=>k.id)));
    setFout('');setMelding('');
  };
  const kiesFilter=(nieuw:Filter)=>{
    setFilter(nieuw);
    // Bij wisselen van filter nooit onzichtbare kandidaten per ongeluk in bulk bewerken.
    setSelectie(new Set());setFout('');setMelding('');
  };
  const getActie=():BulkProefActie=>bulkType==='afwijzen'
    ?{type:'afwijzen',bron:'intern',categorie:reden as ReactieReden,anders}
    :bulkType==='fase'
      ?{type:'fase',fase:fase as Exclude<PipelineFase,'afgevallen'|'afgerond'>}
      :{type:'interesse',niveau:interesse};
  // Voorkomt dat een gewijzigde selectie of invoer ongemerkt onder een oud
  // bevestigingsscherm wordt verwerkt.
  const selectieSleutel=JSON.stringify({
    ids:[...selectie].sort(),bulkType,reden,anders,fase,interesse,
    versies:kandidaten.map(k=>[k.id,k.pipelineFase,k.interesseNiveau,
      k.afwijzing?.bron,k.afwijzing?.categorie,k.afwijzing?.anders]),
  });
  const voorbeeld=selectie.size>0&&voorbeeldSleutel===selectieSleutel
    ?pasFictieveBulkActieToe(kandidaten,selectie,getActie()):null;
  const controleerWijziging=()=>{
    const result=pasFictieveBulkActieToe(kandidaten,selectie,getActie());
    if(result.fout){setFout(result.fout);setVoorbeeldSleutel(null);return;}
    setFout('');setMelding('');
    setVoorbeeldSleutel(selectieSleutel);
  };
  const bevestigWijziging=()=>{
    if(voorbeeldSleutel!==selectieSleutel){
      setFout('Je selectie is gewijzigd. Controleer de wijziging opnieuw.');return;
    }
    const result=pasFictieveBulkActieToe(kandidaten,selectie,getActie());
    if(result.fout){setFout(result.fout);setVoorbeeldSleutel(null);return;}
    if(result.aangepast===0){setFout('Deze waarden zijn al gelijk. Er is niets gewijzigd.');return;}
    setLaatsteSnapshot([...kandidaten]);
    setKandidaten(result.kandidaten);
    setSelectie(new Set());setVoorbeeldSleutel(null);setFout('');
    const werkwoord=bulkType==='afwijzen'?'afgewezen'
      :bulkType==='fase'?'naar een andere fase gezet':'bijgewerkt';
    setMelding(result.aangepast+' kandidaten '+werkwoord+
      ' in de fictieve proef.'+(result.ongewijzigd
        ?' '+result.ongewijzigd+' kandidaat/kandidaten waren al ongewijzigd.':''));
  };
  const maakOngedaan=()=>{
    if(!laatsteSnapshot)return;
    setKandidaten(laatsteSnapshot);setLaatsteSnapshot(null);
    setSelectie(new Set());setVoorbeeldSleutel(null);setFout('');
    setMelding('Laatste bulkwijziging ongedaan gemaakt in de fictieve proef.');
  };

  return <div className="space-y-5">
    <div className="space-y-2">
      <p className="uppercase tracking-wider text-accent font-semibold text-xs">Interactieve interfaceproef</p>
      <h1 className="text-2xl font-semibold">Kandidaten / dealtraject</h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Eén primaire knop, sorteren en meerdere kandidaten tegelijk bijwerken.
        Deze demonstratie bevat uitsluitend fictieve records en registreert geen echte reacties.
      </p>
    </div>
    <section className="section-card p-4 sm:p-6 space-y-4" aria-label="Voorbeeld kandidatenacties">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h2 className="section-title">Kandidaten / dealtraject</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {kandidaten.length} kandidaten in pipeline (fictief)
          </p>
        </div>
        <ObjectPipelineActies canAdd onAdd={()=>setActie('toevoegen')}
          onOffer={()=>setActie('aanbieding')} onReply={()=>setActie('reactie')}/>
      </div>
      {actie&&<div role="status" className="rounded-lg bg-muted/40 border border-border/70 p-3 space-y-1">
        <div className="font-semibold text-sm">
          {actie==='toevoegen'?'Kandidaat toevoegen':actie==='aanbieding'?'Aanbieding registreren':'Reactie registreren'}
        </div>
        <p className="text-xs text-muted-foreground">
          In de echte CRM opent hier het bestaande formulier.
          In deze geïsoleerde proef wordt niets geregistreerd of verzonden.
        </p>
        <button type="button" onClick={()=>setActie(null)}
          className="mt-2 rounded-md border border-border px-3 py-2 text-xs">Sluiten</button>
      </div>}
      <div className="grid sm:grid-cols-[1fr_1fr] gap-3 items-end">
        <label className="text-xs space-y-1 block">
          <span>Filter kandidaten</span>
          <select aria-label="Filter kandidaten" value={filter}
            onChange={e=>kiesFilter(e.target.value as Filter)}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            <option value="actief">Actieve kandidaten ({kandidaten.filter(k=>getFilter(k.pipelineFase,'actief')).length})</option>
            <option value="afgevallen">Afgevallen ({kandidaten.filter(k=>getFilter(k.pipelineFase,'afgevallen')).length})</option>
            <option value="alle">Alle kandidaten ({kandidaten.length})</option>
          </select>
        </label>
        <label className="text-xs space-y-1 block">
          <span>Sorteer op</span>
          <select aria-label="Sorteer kandidaten" value={sortering}
            onChange={e=>setSortering(e.target.value as KandidaatSorteerwijze)}
            className="block w-full border border-input bg-background rounded-md h-10 px-3 text-sm">
            {KANDIDAAT_SORTEEROPTIES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" aria-label="Selecteer alle zichtbare kandidaten"
            checked={allemaalGeselecteerd} onChange={selecteerAlle}
            disabled={zichtbaar.length===0}/>
          Alle zichtbare kandidaten selecteren
        </label>
        <span className="text-xs text-muted-foreground">
          {zichtbaar.length} zichtbaar · {selectie.size} geselecteerd
        </span>
      </div>
      <div className="space-y-2" aria-label="Fictieve kandidaatlijst">
        {zichtbaar.map(k=><label key={k.id}
          className={'flex items-start gap-3 rounded-lg border p-3 cursor-pointer '+
            (selectie.has(k.id)?'border-accent bg-accent/5':'border-border/70')}>
          <input type="checkbox" aria-label={'Selecteer '+k.naam} className="mt-1"
            checked={selectie.has(k.id)}
            onChange={e=>setSelectie(s=>{
              const n=new Set(s);
              if(e.target.checked)n.add(k.id);else n.delete(k.id);
              return n;
            })}/>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex justify-between flex-wrap items-center gap-2">
              <strong className="text-sm">{k.naam}</strong>
              <span className="text-xs font-semibold">{k.matchscore??'–'}% match</span>
            </span>
            <span className="block text-xs text-muted-foreground">
              {faseLabel(k.pipelineFase)} · {INTERESSE_LABELS[k.interesseNiveau]}
            </span>
            {k.afwijzing&&<span className="block text-xs text-muted-foreground">
              {k.afwijzing.bron==='intern'?'Intern uitgesloten':'Afwijzing van koper'}
              {' · '}{REACTIE_REDEN_LABELS[k.afwijzing.categorie]}
              {k.afwijzing.anders?' · '+k.afwijzing.anders:''}
            </span>}
            <span className="block text-xs text-muted-foreground">
              Laatste activiteit: {k.laatsteContactdatum} · Volgende actie: {k.volgendeActieDatum??'—'}
            </span>
          </span>
        </label>)}
      </div>
      {selectie.size>0&&<div className="border border-border rounded-lg p-4 space-y-3" aria-label="Bulkbewerking">
        <div className="flex gap-2 items-center">
          <CheckSquare2 className="h-4 w-4 text-accent"/>
          <h3 className="font-semibold text-sm">{selectie.size} kandidaten tegelijk wijzigen</h3>
        </div>
        <label className="block space-y-1 text-xs">
          <span>Actie voor selectie</span>
          <select aria-label="Bulkactie" value={bulkType}
            onChange={e=>{setBulkType(e.target.value as BulkType);setFout('');}}
            className="block w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
            <option value="afwijzen">Afvallen met reden</option>
            <option value="fase">Pipelinefase wijzigen</option>
            <option value="interesse">Interesseniveau wijzigen</option>
          </select>
        </label>
        {bulkType==='afwijzen'&&<>
          <p className="text-xs text-muted-foreground">
            Dit is jouw interne selectie, geen ontvangen kopersreactie.
            Een echte afwijzing van een belegger registreer je afzonderlijk via Meer → Reactie registreren.
          </p>
          <label className="block space-y-1 text-xs">
            <span>Afwijzingscategorie voor alle geselecteerden</span>
            <select aria-label="Afwijzingscategorie" value={reden}
              onChange={e=>{setReden(e.target.value as ReactieReden|'');setFout('');}}
              className="block w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
              <option value="">Kies reden</option>
              {Object.entries(REACTIE_REDEN_LABELS).map(([key,label])=>
                <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {reden==='anders'&&<label className="block space-y-1 text-xs">
            <span>Andere reden</span>
            <input aria-label="Andere afwijzingsreden" value={anders}
              onChange={e=>setAnders(e.target.value)}
              className="block w-full h-10 rounded-md bg-background border border-input px-3 text-sm"/>
          </label>}
        </>}
        {bulkType==='fase'&&<label className="block space-y-1 text-xs">
          <span>Nieuwe pipelinefase</span>
          <select aria-label="Nieuwe pipelinefase" value={fase}
            onChange={e=>setFase(e.target.value as PipelineFase)}
            className="block w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
            {PIPELINE_FASES.filter(f=>!['afgevallen','afgerond'].includes(f.key)).map(f=>
              <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>}
        {bulkType==='interesse'&&<label className="block space-y-1 text-xs">
          <span>Nieuw interesseniveau</span>
          <select aria-label="Nieuw interesseniveau" value={interesse}
            onChange={e=>setInteresse(e.target.value as InteresseNiveau)}
            className="block w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
            {Object.entries(INTERESSE_LABELS).map(([key,label])=>
              <option key={key} value={key}>{label}</option>)}
          </select>
        </label>}
        {fout&&<p role="alert" className="text-xs text-destructive">{fout}</p>}
        {voorbeeld&&<div className="border border-border rounded-lg bg-muted/30 p-3 space-y-2"
          aria-label="Controle bulkwijziging">
          <h4 className="text-sm font-semibold">Controleer vóór je toepast</h4>
          <p className="text-xs">
            {voorbeeld.aangepast} werkelijke wijzigingen · {voorbeeld.ongewijzigd} al gelijk.
          </p>
          <p className="text-xs text-muted-foreground">
            Geselecteerd: {kandidaten.filter(k=>selectie.has(k.id)).map(k=>k.naam).join(', ')}.
          </p>
          <p className="text-xs text-muted-foreground">
            {bulkType==='afwijzen'
              ?'Interne uitsluiting · '+(REACTIE_REDEN_LABELS[reden as ReactieReden]??'Geen reden')
              :bulkType==='fase'?'Pipelinefase → '+faseLabel(fase)
              :'Interesseniveau → '+INTERESSE_LABELS[interesse]}.
            Er wordt geen bericht verzonden en geen kopersreactie aangemaakt.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={bevestigWijziging} disabled={voorbeeld.aangepast===0}
              className="rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50">
              Bevestig wijziging voor {voorbeeld.aangepast} kandidaten
            </button>
            <button type="button" onClick={()=>setVoorbeeldSleutel(null)}
              className="rounded-md border border-border px-3 py-2 text-sm">Terug</button>
          </div>
        </div>}
        <div className="flex gap-2 flex-wrap">
          {!voorbeeld&&<button type="button" onClick={controleerWijziging}
            className="rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm font-medium">
            Wijziging controleren
          </button>}
          <button type="button" onClick={()=>{setSelectie(new Set());setFout('');setVoorbeeldSleutel(null);}}
            className="rounded-md border border-border px-3 py-2 text-sm">Selectie wissen</button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gebruik één gedeelde reden alleen als die voor alle geselecteerden klopt.
          Ongeldige selecties worden geheel tegengehouden: geen gedeeltelijke wijzigingen.
          Alleen deze fictieve proef wordt gewijzigd.
        </p>
      </div>}
      {melding&&<div role="status" className="text-sm font-medium flex items-center flex-wrap gap-3">
        <span>{melding}</span>
        {laatsteSnapshot&&<button type="button" onClick={maakOngedaan}
          className="underline text-accent font-medium">Ongedaan maken</button>}
      </div>}
    </section>
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4 shrink-0"/>
      Deze proef gebruikt geen Supabase-client, echte relaties of productiegegevens.
      De definitieve CRM heeft voor bulkafwijzingen nog een aparte, veilige opslagroute nodig.
    </div>
  </div>;
}
