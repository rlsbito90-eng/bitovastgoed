import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';
import {
  isDemoStaat, migreerOudeDemo, nieuweDemoStaat, standaardOnderdelen,
  STORAGE_KEY, type DemoBelegger, type DemoOnderdeel, type DemoStaat,
  type VoorbeeldScenario,
} from './sandboxModel';

type BewerkbaarOnderdeel = 'naam' | 'gebruiksfunctieCode' | 'oppervlakte' | 'meetbasis';
type BewerkbareBelegger = 'gebruiksfunctieCode' | 'percentage' | 'sterkte' | 'meetbasis';

export interface SandboxContextValue {
  staat: DemoStaat;
  kiesObject: (scenario: VoorbeeldScenario)=>void;
  kiesBelegger: (id: DemoBelegger['id'])=>void;
  wijzigOnderdeel: (id:string, veld:BewerkbaarOnderdeel, waarde:string)=>void;
  voegOnderdeelToe: ()=>void;
  verwijderOnderdeel: (id:string)=>void;
  wijzigBelegger: (id:DemoBelegger['id'],veld:BewerkbareBelegger,waarde:string)=>void;
  herstelObject: ()=>void;
  herstelAlles: ()=>void;
}

const Context=createContext<SandboxContextValue|null>(null);
const LEGACY_KEY='bito-crm-isolated-matching-v1';

function leesBrowserStaat(): DemoStaat {
  try{
    const raw=window.localStorage.getItem(STORAGE_KEY);
    if(raw&&raw.length<=65000){
      const value:unknown=JSON.parse(raw);
      if(isDemoStaat(value))return value;
    }
    const old=window.localStorage.getItem(LEGACY_KEY);
    if(old&&old.length<=3000){
      const migrated=migreerOudeDemo(JSON.parse(old));
      if(migrated)return migrated;
    }
  }catch{
    // Ook zonder toegang tot lokale opslag blijft de test bruikbaar.
  }
  return nieuweDemoStaat();
}

export function SandboxStoreProvider({children}:{children:ReactNode}){
  const [staat,setStaat]=useState<DemoStaat>(leesBrowserStaat);
  useEffect(()=>{
    try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(staat));}
    catch{ /* Browseropslag is optioneel. */ }
  },[staat]);

  const kiesObject=(scenario:VoorbeeldScenario)=>
    setStaat(s=>({...s,scenario}));
  const kiesBelegger=(id:DemoBelegger['id'])=>
    setStaat(s=>({...s,geselecteerdeBeleggerId:id}));
  const wijzigOnderdeel=(id:string,veld:BewerkbaarOnderdeel,waarde:string)=>
    setStaat(s=>({...s,onderdelen:{...s.onderdelen,[s.scenario]:
      s.onderdelen[s.scenario].map(p=>p.id===id?{...p,[veld]:waarde}:p),
    }}));
  const voegOnderdeelToe=()=>setStaat(s=>{
    const onderdelen=s.onderdelen[s.scenario];
    let n=1;
    while(onderdelen.some(o=>o.id==='nieuw-'+n))n+=1;
    const nieuw:DemoOnderdeel={id:'nieuw-'+n,naam:'Nieuw onderdeel',
      gebruiksfunctieCode:'overig',oppervlakte:'',
      meetbasis:onderdelen[0]?.meetbasis??'vvo'};
    return {...s,onderdelen:{...s.onderdelen,[s.scenario]:[...onderdelen,nieuw]}};
  });
  const verwijderOnderdeel=(id:string)=>
    setStaat(s=>({...s,onderdelen:{...s.onderdelen,[s.scenario]:
      s.onderdelen[s.scenario].filter(p=>p.id!==id),
    }}));
  const wijzigBelegger=(id:DemoBelegger['id'],veld:BewerkbareBelegger,waarde:string)=>
    setStaat(s=>({...s,beleggers:s.beleggers.map(b=>b.id===id?{...b,[veld]:waarde}:b)}));
  const herstelObject=()=>setStaat(s=>({...s,onderdelen:{...s.onderdelen,
    [s.scenario]:standaardOnderdelen(s.scenario),
  }}));
  const herstelAlles=()=>setStaat(nieuweDemoStaat());
  const ctx:SandboxContextValue={staat,kiesObject,kiesBelegger,wijzigOnderdeel,
    voegOnderdeelToe,verwijderOnderdeel,wijzigBelegger,herstelObject,herstelAlles};
  return <Context.Provider value={ctx}>{children}</Context.Provider>;
}

export function useSandboxStore():SandboxContextValue{
  const ctx=useContext(Context);
  if(!ctx)throw new Error('SandboxStoreProvider ontbreekt');
  return ctx;
}
