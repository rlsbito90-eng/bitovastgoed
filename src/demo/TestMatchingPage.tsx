import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, ShieldAlert, Users } from 'lucide-react';
import { beoordeelKoperscriteria, type Koperscriterium } from '@/lib/matching/criteriumMotor';
import type { CriteriumSterkte, Meetbasis } from '@/lib/matching/samenstellingscriterium';

type Scenario = 'bedrijfscomplex' | 'gemengd' | 'onbekend';
interface DemoSettings {
  scenario: Scenario;
  minimum: string;
  sterkte: CriteriumSterkte;
  meetbasis: Meetbasis;
  hal: string;
  kantoor: string;
  wonen: string;
}
const STORAGE_KEY='bito-crm-isolated-matching-v1';
const SCENARIOS: Record<Scenario,{titel:string;hal:string;kantoor:string;wonen:string;bron:boolean}> = {
  bedrijfscomplex:{titel:'Bedrijfscomplex — 75% bedrijfsruimte',hal:'750',kantoor:'250',wonen:'0',bron:true},
  gemengd:{titel:'Gemengd vastgoed — 65% bedrijfsruimte',hal:'650',kantoor:'250',wonen:'100',bron:true},
  onbekend:{titel:'Gemengd object met ontbrekende ruimtegegevens',hal:'750',kantoor:'',wonen:'100',bron:false},
};
export const DEFAULT_DEMO_SETTINGS:DemoSettings = {
  scenario:'bedrijfscomplex',minimum:'70',sterkte:'hard',meetbasis:'vvo',
  hal:'750',kantoor:'250',wonen:'0',
};
function isSettings(v:unknown):v is DemoSettings{
  if(!v||typeof v!=='object')return false;
  const x=v as Partial<DemoSettings>;
  return !!x.scenario && x.scenario in SCENARIOS
    && ['hard','voorkeur'].includes(x.sterkte??'')
    && ['vvo','gbo','bvo'].includes(x.meetbasis??'')
    && ['minimum','hal','kantoor','wonen'].every(k=>
      typeof x[k as keyof DemoSettings]==='string'&&(x[k as keyof DemoSettings] as string).length<40);
}
function load():DemoSettings{
  try{
    const stored=localStorage.getItem(STORAGE_KEY);
    if(stored){
      const candidate:unknown=JSON.parse(stored);
      if(isSettings(candidate))return candidate;
    }
  }catch{
    // Geen extra vragen bij uitgeschakelde browseropslag.
  }
  return DEFAULT_DEMO_SETTINGS;
}
const validNumber=(s:string):number|null=>{
  const v=s.trim().replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(v))return null;
  const n=Number(v);
  return Number.isFinite(n) && n>=0 ? n : null;
};

/** Alle registratie, validatie en opslag gebeurt volledig lokaal. */
export default function TestMatchingPage(){
  const [settings,setSettings]=useState<DemoSettings>(load);
  useEffect(()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{ /* optioneel */ }
  },[settings]);
  const patch=<K extends keyof DemoSettings>(key:K,value:DemoSettings[K])=>
    setSettings(x=>({...x,[key]:value}));
  const changeScenario=(scenario:Scenario)=>{
    const s=SCENARIOS[scenario];
    setSettings(x=>({...x,scenario,hal:s.hal,kantoor:s.kantoor,wonen:s.wonen}));
  };
  const beoordeling=useMemo(()=>{
    const minimum=validNumber(settings.minimum);
    const hal=validNumber(settings.hal);
    const kantoor=validNumber(settings.kantoor);
    const wonen=validNumber(settings.wonen);
    const regels:Koperscriterium[]=[
      {id:'gebruik:bedrijfsruimte',label:'Minimaal bedrijfsruimte',
        soort:'aandeel',gebruiksfunctieCode:'bedrijfsruimte',
        operator:'min',percentage:minimum??Number.NaN,
        meetbasis:settings.meetbasis,sterkte:settings.sterkte},
    ];
    const allKnown=hal!==null&&kantoor!==null&&wonen!==null&&(hal+kantoor+wonen)>0;
    const bron=SCENARIOS[settings.scenario].bron;
    return beoordeelKoperscriteria(regels,{
      samenstelling:allKnown&&bron?{
        onderdelen:[
          ...(hal!>0?[{id:'hal',gebruiksfunctieCode:'bedrijfsruimte',
            oppervlakteM2:hal!,meetbasis:settings.meetbasis}]:[]),
          ...(kantoor!>0?[{id:'kantoor',gebruiksfunctieCode:'kantoor',
            oppervlakteM2:kantoor!,meetbasis:settings.meetbasis}]:[]),
          ...(wonen!>0?[{id:'woning',gebruiksfunctieCode:'wonen',
            oppervlakteM2:wonen!,meetbasis:settings.meetbasis}]:[]),
        ],
        volledigheidBevestigd:true,
        zonderOverlapBevestigd:true,
      }:null,
    });
  },[settings]);
  const resultaat=beoordeling.beoordelingen[0];
  const statusLabel=beoordeling.status==='hard_afgevallen'?'Afgevallen — harde eis'
    :beoordeling.status==='voorkeur_wijkt_af'?'Afwijkende voorkeur'
      :beoordeling.status==='controle_nodig'?'Controle nodig':'Voldoet';
  const reset=()=>{
    try{localStorage.removeItem(STORAGE_KEY);}catch{ /* optioneel */ }
    setSettings({...DEFAULT_DEMO_SETTINGS});
  };
  return <div className="space-y-5">
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-accent font-semibold">
        <Users className="h-4 w-4"/> Fictieve relatie · Matching
      </p>
      <h1 className="text-2xl font-semibold">Koperscriteria beoordelen</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Test één fictieve belegger met een voorkeur of harde eis voor bedrijfsruimte.
        De beoordeling hergebruikt de ingestelde objectonderdelen automatisch, zonder
        controlevinkjes of nieuwe CRM-records.
      </p>
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="section-card p-4 sm:p-5 space-y-4">
        <div className="flex justify-between items-center gap-2">
          <h2 className="font-semibold">Fictieve belegger</h2>
          <button type="button" onClick={reset}
            className="rounded-lg border px-3 py-2 inline-flex gap-1.5 items-center text-xs">
            <RotateCcw className="h-3.5 w-3.5"/> Herstellen
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Zoekprofiel: bedrijfsruimte met beperkte overige functies</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs space-y-1 block">Minimaal bedrijfsruimte (%)
            <input aria-label="Minimaal bedrijfsruimtepercentage" inputMode="decimal"
              className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={settings.minimum} onChange={e=>patch('minimum',e.target.value)}/>
          </label>
          <label className="text-xs space-y-1 block">Sterkte
            <select aria-label="Sterkte" className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              value={settings.sterkte} onChange={e=>patch('sterkte',e.target.value as CriteriumSterkte)}>
              <option value="hard">Harde eis</option>
              <option value="voorkeur">Voorkeur</option>
            </select>
          </label>
        </div>
        <label className="text-xs space-y-1 block">Meetbasis
          <select aria-label="Meetbasis" className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
            value={settings.meetbasis} onChange={e=>patch('meetbasis',e.target.value as Meetbasis)}>
            <option value="vvo">VVO</option>
            <option value="gbo">GBO</option>
            <option value="bvo">BVO</option>
          </select>
        </label>
      </section>
      <section className="section-card p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold">Fictief object</h2>
        <label className="text-xs space-y-1 block">Voorbeeldobject
          <select aria-label="Voorbeeldobject" className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
            value={settings.scenario} onChange={e=>changeScenario(e.target.value as Scenario)}>
            {Object.entries(SCENARIOS).map(([key,s])=><option key={key} value={key}>{s.titel}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            ['hal','Bedrijfsruimte'],['kantoor','Kantoor'],['wonen','Wonen'],
          ] as const).map(([key,label])=>
            <label key={key} className="text-xs space-y-1 block">{label} (m²)
              <input aria-label={label+' m²'} inputMode="decimal"
                className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
                value={settings[key]} onChange={e=>patch(key,e.target.value)}/>
            </label>)}
        </div>
        <p className="text-xs text-muted-foreground">
          Deze fictieve indeling is een vooraf afgebakende demonstratie, geen BAG-, NEN- of meetrapportverificatie.
        </p>
      </section>
    </div>
    <section className="section-card p-4 sm:p-5 space-y-3" aria-label="Matchresultaat">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h2 className="font-semibold">Beoordeling</h2>
        <span role="status" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
          {statusLabel}
        </span>
      </div>
      <p className="text-sm">{resultaat.toelichting}</p>
      <p className="text-xs text-muted-foreground inline-flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0"/>
        Bij ontbrekende brongegevens verschijnt 'Controle nodig'. Een harde afwijzing kan
        niet worden opgeheven door een positief matchpercentage op andere criteria.
        Dit is uitsluitend een proef: geen echte relatie, score, bieding of database wordt aangepast.
      </p>
      <p className="text-xs text-muted-foreground">
        Instellingen worden alleen op dit apparaat in de browser bewaard. 'Herstellen' zet de proef terug.
      </p>
    </section>
  </div>;
}
