import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, RotateCcw, Trash2, FlaskConical, ShieldAlert } from 'lucide-react';
import { berekenSamenstellingZonderVinkjes, DEMO_GEBRUIKSFUNCTIES, type OnderdeelConcept, type AutomatischeSamenstellingsBron } from '@/lib/matching/samenstellingsProefModel';
import type { CriteriumSterkte, Meetbasis } from '@/lib/matching/samenstellingscriterium';

type Scenario = 'voldoet' | 'afgevallen' | 'geuzenweg' | 'onbekend';
const VOORBEELDBRONNEN: Record<Scenario, AutomatischeSamenstellingsBron> = {
  voldoet: { totaalM2: 1000, meetbasis: 'vvo', afbakening: 'afgebakend',
    omschrijving: 'Fictieve ruimteverdeling bedrijfscomplex — 1.000 m² VVO' },
  afgevallen: { totaalM2: 1000, meetbasis: 'vvo', afbakening: 'afgebakend',
    omschrijving: 'Fictieve ruimteverdeling gemengd pand — 1.000 m² VVO' },
  geuzenweg: { totaalM2: 139, meetbasis: 'gbo', afbakening: 'afgebakend',
    omschrijving: 'Fictieve verdeling twee woonunits — 139 m² GBO' },
  onbekend: { totaalM2: null, meetbasis: 'vvo', afbakening: 'onbekend',
    omschrijving: 'Geen compleet oppervlakteoverzicht beschikbaar' },
};
const createParts = (scenario: Scenario): OnderdeelConcept[] => {
  const mk = (id:string, omschrijving:string, code:string, oppervlakte:string, meetbasis:Meetbasis, adres=''):OnderdeelConcept => ({
    id, omschrijving, gebruiksfunctieCode:code, oppervlakte, meetbasis, adres,
  });
  if (scenario==='geuzenweg') return [
    mk('app-a','Appartement A','wonen','75','gbo','Geuzenweg 22A'),
    mk('app-b','Appartement B','wonen','64','gbo','Geuzenweg 22B'),
  ];
  if (scenario==='afgevallen') return [
    mk('hal','Bedrijfshal','bedrijfsruimte','650','vvo'),
    mk('kant','Kantoor','kantoor','250','vvo'),
    mk('won','Bedrijfswoning','wonen','100','vvo'),
  ];
  if (scenario==='onbekend') return [
    mk('hal','Bedrijfshal','bedrijfsruimte','750','vvo'),
    mk('kant','Kantoor','kantoor','','vvo'),
  ];
  return [
    mk('hal','Bedrijfshal','bedrijfsruimte','750','vvo'),
    mk('kant','Kantoor','kantoor','250','vvo'),
  ];
};

export default function SamenstellingProefPage() {
  const [scenario,setScenario]=useState<Scenario>('voldoet');
  const [parts,setParts]=useState<OnderdeelConcept[]>(()=>createParts('voldoet'));
  const [nextId,setNextId]=useState(1);
  const [minimum,setMinimum]=useState('70');
  const [sterkte,setSterkte]=useState<CriteriumSterkte>('hard');
  const [meetbasisEis,setMeetbasisEis]=useState<Meetbasis>('vvo');
  const bron = VOORBEELDBRONNEN[scenario];
  const minimaal=minimum.trim()===''?Number.NaN:Number(minimum.replace(',','.'));
  const minimumGeldig=Number.isFinite(minimaal)&&minimaal>=0&&minimaal<=100;
  const automatischeControle = useMemo(
    ()=>berekenSamenstellingZonderVinkjes(parts,minimaal,sterkte,meetbasisEis,bron),
    [parts,minimaal,sterkte,meetbasisEis,bron],
  );
  const result=automatischeControle.resultaat;
  const reset=(name:Scenario)=>{
    setScenario(name);setParts(createParts(name));setNextId(1);
    setMinimum('70');setSterkte('hard');setMeetbasisEis('vvo');
  };
  const update=(id:string,key:keyof OnderdeelConcept,value:string)=>
    setParts(old=>old.map(p=>p.id===id?{...p,[key]:value}:p));
  const add=()=>{setParts(old=>[...old,{
    id:'demo-nieuw-'+nextId,omschrijving:'Nieuw onderdeel',gebruiksfunctieCode:'bedrijfsruimte',
    oppervlakte:'',meetbasis:'vvo',adres:'',
  }]);setNextId(n=>n+1);};
  const format=(v:number|null,suffix='')=>v===null?'Onbekend':v.toLocaleString('nl-NL',{maximumFractionDigits:2})+suffix;
  const status=result.uitkomst.status;
  return <div className="page-shell-wide space-y-5">
    <Link to="/objecten" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4"/> Terug naar Objecten
    </Link>
    <div className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
        <FlaskConical className="h-4 w-4"/> Interactieve proef
      </p>
      <h1 className="text-2xl font-semibold">Objectonderdelen & koperscriteria</h1>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Eén vastgoedobject met meerdere gebruiksfuncties. Wijzig oppervlaktes en voorwaarden om te zien
        of een belegger past. Dit werkt uitsluitend met voorbeeldgegevens en slaat niets op in de CRM.
        De bestaande matchpercentages worden niet veranderd.
      </p>
      <Link to="/objecten/adresproef" className="text-xs font-medium text-accent hover:underline">
        Open de aparte proef voor meerdere adressen
      </Link>
    </div>
    <section className="section-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1 space-y-1 text-sm font-medium">
          <span>Praktijkvoorbeeld</span>
          <select aria-label="Praktijkvoorbeeld" value={scenario} onChange={e=>reset(e.target.value as Scenario)}
            className="block w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="voldoet">Bedrijfscomplex: 75% bedrijfsruimte</option>
            <option value="afgevallen">Gemengd pand: 65% bedrijfsruimte</option>
            <option value="geuzenweg">Geuzenweg: twee woonunits</option>
            <option value="onbekend">Onvolledige ruimtegegevens</option>
          </select>
        </label>
        <button type="button" onClick={()=>reset(scenario)}
          className="rounded-md border border-border px-3 h-10 inline-flex gap-1.5 items-center text-sm">
          <RotateCcw className="h-4 w-4"/> Herstellen
        </button>
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Objectonderdelen</h2>
        {parts.map((part,i)=><div className="rounded-lg border border-border/70 p-3 space-y-2" key={part.id}>
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-medium">Onderdeel {i+1}</span>
            <button type="button" onClick={()=>setParts(old=>old.filter(p=>p.id!==part.id))}
              aria-label={'Verwijder onderdeel '+(i+1)} className="p-2 rounded-md hover:bg-muted">
              <Trash2 className="h-4 w-4 text-muted-foreground"/>
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <label className="space-y-1 text-xs"><span>Omschrijving</span>
              <input aria-label={'Onderdeel '+(i+1)+' omschrijving'} value={part.omschrijving}
                onChange={e=>update(part.id,'omschrijving',e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 w-full text-sm"/>
            </label>
            <label className="space-y-1 text-xs"><span>Gebruiksfunctie</span>
              <select aria-label={'Onderdeel '+(i+1)+' gebruiksfunctie'} value={part.gebruiksfunctieCode}
                onChange={e=>update(part.id,'gebruiksfunctieCode',e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 w-full text-sm">
                {DEMO_GEBRUIKSFUNCTIES.map(t=><option value={t.value} key={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs"><span>Oppervlakte (m²)</span>
              <input aria-label={'Onderdeel '+(i+1)+' oppervlakte'} inputMode="decimal"
                value={part.oppervlakte} onChange={e=>update(part.id,'oppervlakte',e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 w-full text-sm"/>
            </label>
            <label className="space-y-1 text-xs"><span>Meetbasis</span>
              <select aria-label={'Onderdeel '+(i+1)+' meetbasis'} value={part.meetbasis}
                onChange={e=>update(part.id,'meetbasis',e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 w-full text-sm">
                <option value="vvo">VVO</option><option value="gbo">GBO</option><option value="bvo">BVO</option>
              </select>
            </label>
          </div>
          {part.adres&&<p className="text-xs text-muted-foreground">Adres: {part.adres}</p>}
        </div>)}
        <button type="button" onClick={add}
          className="rounded-md border border-border px-3 py-2 text-sm inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4"/> Onderdeel toevoegen
        </button>
        <div className="rounded-lg bg-muted/30 p-3 space-y-2" aria-label="Automatische gegevenscontrole">
          <h3 className="text-sm font-semibold">Automatische gegevenscontrole</h3>
          <p className="text-xs font-medium">{automatischeControle.bronStatus==='toetsbaar'
            ? 'Gegevens onderling consistent (voorbeeld)'
            : 'Aanvullende informatie ontbreekt of is tegenstrijdig'}</p>
          <p className="text-xs text-muted-foreground">{automatischeControle.controlemelding}</p>
          <p className="text-xs text-muted-foreground">Beschikbare bron: {bron.omschrijving}</p>
          <p className="text-xs text-muted-foreground">
            Geen controlevinkjes: het systeem kijkt naar de aanwezige onderdelen, hun meetbasis,
            het geregistreerde totaal en de afbakening. Ontbreekt betrouwbare broninformatie,
            dan volgt automatisch ‘Controle nodig’, zonder extra handelingen.
          </p>
          <p className="text-xs text-muted-foreground">
            Deze voorbeeldbron is fictief; dit is geen daadwerkelijke verificatie van Geuzenweg of andere panden.
          </p>
        </div>
      </div>
    </section>
    <section className="section-card p-4 sm:p-5 space-y-3">
      <h2 className="text-base font-semibold">Investeringsprofiel — aanvullende eis</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        <div className="text-sm"><p className="text-xs text-muted-foreground mb-1">Gebruiksfunctie</p><p className="font-medium">Bedrijfsruimte</p></div>
        <label className="space-y-1 text-xs"><span>Minimaal aandeel (%)</span>
          <input aria-label="Minimaal bedrijfsruimtepercentage" value={minimum} inputMode="decimal"
            onChange={e=>setMinimum(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 w-full text-sm"/>
        </label>
        <label className="space-y-1 text-xs"><span>Aard van de eis</span>
          <select aria-label="Aard van de eis" value={sterkte}
            onChange={e=>setSterkte(e.target.value as CriteriumSterkte)}
            className="h-10 rounded-md border border-input bg-background px-3 w-full text-sm">
            <option value="hard">Harde eis</option><option value="voorkeur">Voorkeur</option>
          </select>
        </label>
        <label className="space-y-1 text-xs"><span>Meetbasis van de eis</span>
          <select aria-label="Meetbasis van de eis" value={meetbasisEis}
            onChange={e=>setMeetbasisEis(e.target.value as Meetbasis)}
            className="h-10 rounded-md border border-input bg-background px-3 w-full text-sm">
            <option value="vvo">VVO</option><option value="gbo">GBO</option><option value="bvo">BVO</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        De overige gebruiksfuncties samen mogen maximaal {minimumGeldig?format(100-minimaal,'%'):'onbekend'} zijn.
        Dit is een afgeleide van de minimumeis, géén afzonderlijke kantoorlimiet.
      </p>
    </section>
    <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Uitkomst van de samenstellingstoets">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-base font-semibold">Uitkomst</h2>
        <span role="status" className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold">
          {status==='voldoet'?'Voldoet':status==='wijkt_af'&&result.uitkomst.diskwalificatie?'Afgevallen — harde eis':
          status==='wijkt_af'?'Afwijkende voorkeur':'Controle nodig'}
        </span>
      </div>
      {result.bedrijfsruimteAandeel!==null&&
        <div className="h-4 w-full rounded-md overflow-hidden flex bg-muted" aria-label="Ruimteverdeling">
          <div style={{width:String(result.bedrijfsruimteAandeel)+'%',backgroundColor:'#28765B'}}/>
          <div className="flex-1" style={{backgroundColor:'#91A8BF'}}/>
        </div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        <div><p className="text-xs text-muted-foreground">Bedrijfsruimte</p><p className="font-semibold">{format(result.bedrijfsruimteAandeel,'%')}</p></div>
        <div><p className="text-xs text-muted-foreground">Overige functies</p><p className="font-semibold">{format(result.overigeAandeel,'%')}</p></div>
        <div><p className="text-xs text-muted-foreground">Totale vergelijkbare m²</p><p className="font-semibold">{format(result.totaalM2)}</p></div>
      </div>
      {status==='controle_nodig'&&result.bedrijfsruimteAandeel!==null&&
        <p className="text-xs text-muted-foreground">Percentages zijn indicatief, niet geverifieerd.</p>}
      {result.uitkomst.verklaring!==automatischeControle.controlemelding &&
        <p className="text-xs text-muted-foreground">{result.uitkomst.verklaring}</p>}
      <p className="text-xs text-muted-foreground">{result.uitleg}</p>
      <div className="rounded-md border border-border/70 p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5"/>
        <p className="text-xs text-muted-foreground">
          De matchscore (0–100%) blijft een apart gegeven. Een hoge score kan een harde afwijzing nooit opheffen.
          Een onbekende verhouding is geen automatisch positief of negatief oordeel.
          Deze proef wijzigt geen relaties, objecten of bestaande matchresultaten.
        </p>
      </div>
    </section>
  </div>;
}
