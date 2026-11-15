import type { CriteriumSterkte, Meetbasis } from '@/lib/matching/samenstellingscriterium';

export type VoorbeeldScenario = 'bedrijfscomplex' | 'gemengd' | 'geuzenweg' | 'onbekend';
export type GebruiksfunctieCode =
  'bedrijfsruimte' | 'kantoor' | 'wonen' | 'winkel' | 'horeca' | 'maatschappelijk' | 'overig';

export const GEBRUIKSFUNCTIES: readonly { value: GebruiksfunctieCode; label: string }[] = [
  {value:'bedrijfsruimte',label:'Bedrijfsruimte'},
  {value:'kantoor',label:'Kantoorruimte'},
  {value:'wonen',label:'Woonruimte'},
  {value:'winkel',label:'Winkelruimte'},
  {value:'horeca',label:'Horeca'},
  {value:'maatschappelijk',label:'Maatschappelijk'},
  {value:'overig',label:'Overig'},
];

export interface DemoOnderdeel {
  id: string;
  naam: string;
  gebruiksfunctieCode: GebruiksfunctieCode;
  oppervlakte: string;
  meetbasis: Meetbasis;
  adres?: string;
}

export interface DemoBelegger {
  id: 'bedrijf' | 'residentieel';
  naam: string;
  gebruiksfunctieCode: GebruiksfunctieCode;
  percentage: string;
  sterkte: CriteriumSterkte;
  meetbasis: Meetbasis;
}

export interface DemoObjectBron {
  naam: string;
  toelichting: string;
  totaalM2: number | null;
  meetbasis: Meetbasis;
  afbakening: 'afgebakend' | 'onbekend';
}

export const VOORBEELDEN: Record<VoorbeeldScenario, DemoObjectBron> = {
  bedrijfscomplex: {
    naam:'Bedrijfscomplex — 75% bedrijfsruimte',
    toelichting:'Fictieve opstelling van 1.000 m² VVO, zonder overlap',
    totaalM2:1000, meetbasis:'vvo', afbakening:'afgebakend',
  },
  gemengd: {
    naam:'Gemengd pand — 65% bedrijfsruimte',
    toelichting:'Fictieve opstelling van 1.000 m² VVO, zonder overlap',
    totaalM2:1000, meetbasis:'vvo', afbakening:'afgebakend',
  },
  geuzenweg: {
    naam:'Geuzenweg — twee fictieve woonunits',
    toelichting:'Fictieve opstelling van 139 m² GBO, zonder overlap',
    totaalM2:139, meetbasis:'gbo', afbakening:'afgebakend',
  },
  onbekend: {
    naam:'Onvolledig object — controle nodig',
    toelichting:'De oppervlaktebron en de volledige afbakening ontbreken',
    totaalM2:null, meetbasis:'vvo', afbakening:'onbekend',
  },
};

export const SCENARIOS: readonly VoorbeeldScenario[] =
  ['bedrijfscomplex','gemengd','geuzenweg','onbekend'];

export function standaardOnderdelen(scenario: VoorbeeldScenario): DemoOnderdeel[] {
  switch(scenario){
    case 'bedrijfscomplex': return [
      {id:'hal',naam:'Bedrijfshal',gebruiksfunctieCode:'bedrijfsruimte',oppervlakte:'750',meetbasis:'vvo'},
      {id:'kantoor',naam:'Kantoorruimte',gebruiksfunctieCode:'kantoor',oppervlakte:'250',meetbasis:'vvo'},
    ];
    case 'gemengd': return [
      {id:'hal',naam:'Bedrijfshal',gebruiksfunctieCode:'bedrijfsruimte',oppervlakte:'650',meetbasis:'vvo'},
      {id:'kantoor',naam:'Kantoorruimte',gebruiksfunctieCode:'kantoor',oppervlakte:'250',meetbasis:'vvo'},
      {id:'woning',naam:'Bedrijfswoning',gebruiksfunctieCode:'wonen',oppervlakte:'100',meetbasis:'vvo'},
    ];
    case 'geuzenweg': return [
      {id:'app-a',naam:'Appartement A',gebruiksfunctieCode:'wonen',oppervlakte:'75',meetbasis:'gbo',adres:'Geuzenweg 22A'},
      {id:'app-b',naam:'Appartement B',gebruiksfunctieCode:'wonen',oppervlakte:'64',meetbasis:'gbo',adres:'Geuzenweg 22B'},
    ];
    case 'onbekend': return [
      {id:'hal',naam:'Bedrijfshal',gebruiksfunctieCode:'bedrijfsruimte',oppervlakte:'750',meetbasis:'vvo'},
      {id:'kantoor',naam:'Kantoorruimte',gebruiksfunctieCode:'kantoor',oppervlakte:'',meetbasis:'vvo'},
    ];
  }
}

export function standaardBeleggers(): DemoBelegger[] {
  return [
    {id:'bedrijf',naam:'Belegger bedrijfsruimte',gebruiksfunctieCode:'bedrijfsruimte',
      percentage:'70',sterkte:'hard',meetbasis:'vvo'},
    {id:'residentieel',naam:'Residentiële belegger',gebruiksfunctieCode:'wonen',
      percentage:'80',sterkte:'hard',meetbasis:'gbo'},
  ];
}

export interface DemoStaat {
  versie: 2;
  scenario: VoorbeeldScenario;
  onderdelen: Record<VoorbeeldScenario, DemoOnderdeel[]>;
  beleggers: DemoBelegger[];
  geselecteerdeBeleggerId: DemoBelegger['id'];
}

export function nieuweDemoStaat(): DemoStaat {
  return {
    versie:2, scenario:'bedrijfscomplex',
    onderdelen:{
      bedrijfscomplex:standaardOnderdelen('bedrijfscomplex'),
      gemengd:standaardOnderdelen('gemengd'),
      geuzenweg:standaardOnderdelen('geuzenweg'),
      onbekend:standaardOnderdelen('onbekend'),
    },
    beleggers:standaardBeleggers(),
    geselecteerdeBeleggerId:'bedrijf',
  };
}

/** Persisted data comes from a browser, not from a trusted backend. */
export function isDemoStaat(value: unknown): value is DemoStaat {
  if (!value || typeof value!=='object') return false;
  const v=value as Partial<DemoStaat>;
  if (v.versie!==2 || !SCENARIOS.includes(v.scenario as VoorbeeldScenario)
    || !v.onderdelen || typeof v.onderdelen!=='object'
    || !Array.isArray(v.beleggers) || v.beleggers.length!==2
    || !['bedrijf','residentieel'].includes(v.geselecteerdeBeleggerId??'')) return false;
  const codeIsValid=(code:unknown)=>GEBRUIKSFUNCTIES.some(x=>x.value===code);
  const meetbasisIsValid=(m:unknown)=>['vvo','gbo','bvo'].includes(String(m));
  const reasonable=(s:unknown,length:number)=>typeof s==='string'&&s.length<=length;
  for(const scenario of SCENARIOS){
    const onderdelen=v.onderdelen[scenario];
    if(!Array.isArray(onderdelen)||onderdelen.length>30) return false;
    for(const o of onderdelen){
      if (!o || !reasonable(o.id,60)||!reasonable(o.naam,150)
        || !reasonable(o.oppervlakte,40)||!codeIsValid(o.gebruiksfunctieCode)
        || !meetbasisIsValid(o.meetbasis)
        || (o.adres!==undefined&&!reasonable(o.adres,200))) return false;
    }
  }
  const ids=v.beleggers.map(x=>x?.id);
  if (new Set(ids).size!==2 || !ids.includes('bedrijf') || !ids.includes('residentieel'))return false;
  return v.beleggers.every(b=>b&&reasonable(b.naam,100)&&reasonable(b.percentage,40)
    && codeIsValid(b.gebruiksfunctieCode)&&meetbasisIsValid(b.meetbasis)
    && ['hard','voorkeur'].includes(b.sterkte));
}

export const STORAGE_KEY = 'bito-crm-gescheiden-proef-v2';

/** Eénmalige migratie van de oude alleenstaande matchingproef (geen echte CRM-data). */
export function migreerOudeDemo(oude: unknown): DemoStaat | null {
  if(!oude || typeof oude!=='object')return null;
  const v=oude as Record<string,unknown>;
  if(!['bedrijfscomplex','gemengd','onbekend'].includes(String(v.scenario))
    || !['hard','voorkeur'].includes(String(v.sterkte))
    || !['vvo','gbo','bvo'].includes(String(v.meetbasis))
    || !['minimum','hal','kantoor','wonen'].every(k=>typeof v[k]==='string'
      && (v[k] as string).length<40))return null;
  const state=nieuweDemoStaat();
  state.scenario=v.scenario as VoorbeeldScenario;
  const current=state.onderdelen[state.scenario];
  for(const p of current){
    if(p.gebruiksfunctieCode==='bedrijfsruimte')p.oppervlakte=v.hal as string;
    if(p.gebruiksfunctieCode==='kantoor')p.oppervlakte=v.kantoor as string;
    if(p.gebruiksfunctieCode==='wonen')p.oppervlakte=v.wonen as string;
  }
  state.beleggers[0].percentage=v.minimum as string;
  state.beleggers[0].sterkte=v.sterkte as CriteriumSterkte;
  state.beleggers[0].meetbasis=v.meetbasis as Meetbasis;
  return state;
}
