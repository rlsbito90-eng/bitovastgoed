import { beoordeelKoperscriteria, type CriteriumOverzicht, type Koperscriterium } from '@/lib/matching/criteriumMotor';
import type { SamenstellingsInvoer } from '@/lib/matching/samenstellingscriterium';
import {
  GEBRUIKSFUNCTIES, VOORBEELDEN,
  type DemoBelegger, type DemoOnderdeel, type DemoStaat, type VoorbeeldScenario,
} from './sandboxModel';

export interface BronControle {
  status: 'bruikbaar' | 'controle_nodig';
  toelichting: string;
  somM2: number | null;
  gegevens: SamenstellingsInvoer | null;
}

export interface SandboxBeoordeling {
  belegger: DemoBelegger;
  beoordeling: CriteriumOverzicht;
  bron: BronControle;
  statusLabel: string;
  aandeel: number | null;
}

const getal=(waarde:string):number|null=>{
  const clean=waarde.trim().replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(clean))return null;
  const n=Number(clean);
  return Number.isFinite(n)&&n>0?n:null;
};

/** No manual completeness toggles: the fictional source and object rows drive the check. */
export function controleerDemoBron(
  scenario: VoorbeeldScenario, onderdelen:readonly DemoOnderdeel[],
):BronControle{
  const bron=VOORBEELDEN[scenario];
  const error=(toelichting:string,somM2:number|null=null):BronControle=>({
    status:'controle_nodig',toelichting,somM2,gegevens:null,
  });
  if(!onderdelen.length)return error('Geen objectonderdelen beschikbaar.');
  if(onderdelen.length>30)return error('Te veel objectonderdelen in deze proef.');
  const ids=new Set<string>();
  const rows:SamenstellingsInvoer['onderdelen'][number][]=[];
  for(const onderdeel of onderdelen){
    if(!onderdeel.id||ids.has(onderdeel.id))
      return error('Dubbele objectonderdelen gevonden.');
    ids.add(onderdeel.id);
    if(!GEBRUIKSFUNCTIES.some(x=>x.value===onderdeel.gebruiksfunctieCode)
      || !onderdeel.naam.trim())
      return error('Gebruiksfunctie of omschrijving ontbreekt.');
    const m2=getal(onderdeel.oppervlakte);
    if(m2===null)return error('Minstens één oppervlakte ontbreekt of is ongeldig.');
    if(!['vvo','gbo','bvo'].includes(onderdeel.meetbasis))
      return error('Meetbasis van een onderdeel is onbekend.');
    rows.push({id:onderdeel.id,gebruiksfunctieCode:onderdeel.gebruiksfunctieCode,
      oppervlakteM2:m2,meetbasis:onderdeel.meetbasis});
  }
  const somM2=rows.reduce((sum,row)=>sum+row.oppervlakteM2,0);
  if(rows.some(row=>row.meetbasis!==bron.meetbasis))
    return error('Niet alle onderdelen hebben de meetbasis '+bron.meetbasis.toUpperCase()+'.',somM2);
  if(bron.afbakening!=='afgebakend'||bron.totaalM2===null)
    return error('Er is geen onafhankelijk afgebakend objecttotaal beschikbaar.',somM2);
  if(Math.abs(somM2-bron.totaalM2)>0.01)
    return error('De som van de onderdelen ('+somM2.toLocaleString('nl-NL')+
      ' m²) wijkt af van het fictieve objecttotaal ('+
      bron.totaalM2.toLocaleString('nl-NL')+' m²).',somM2);
  return {
    status:'bruikbaar',
    toelichting:'De fictieve onderdeelsom sluit aan op de voorbeeldbron en de meetbasis.',
    somM2,
    gegevens:{onderdelen:rows,volledigheidBevestigd:true,zonderOverlapBevestigd:true},
  };
}

export function beoordeelSandboxBelegger(
  staat:Pick<DemoStaat,'scenario'|'onderdelen'>,
  belegger:DemoBelegger,
):SandboxBeoordeling{
  const onderdelen=staat.onderdelen[staat.scenario];
  const bron=controleerDemoBron(staat.scenario,onderdelen);
  const percentage=getal(belegger.percentage);
  // 0% is also a legitimate minimum, but a blank value never means 0.
  const minimum=belegger.percentage.trim()==='0'?0:percentage??Number.NaN;
  const criteria:Koperscriterium[]=[{
    id:'functie:'+belegger.gebruiksfunctieCode,
    label:'Minimaal '+belegger.gebruiksfunctieCode,
    soort:'aandeel',gebruiksfunctieCode:belegger.gebruiksfunctieCode,
    operator:'min',percentage:minimum,sterkte:belegger.sterkte,
    meetbasis:belegger.meetbasis,
  }];
  const beoordeling=beoordeelKoperscriteria(criteria,{samenstelling:bron.gegevens});
  const aandeel=bron.gegevens&&bron.somM2
    ?bron.gegevens.onderdelen.filter(p=>p.gebruiksfunctieCode===belegger.gebruiksfunctieCode)
      .reduce((sum,p)=>sum+p.oppervlakteM2,0)/bron.somM2*100
    :null;
  const statusLabel=beoordeling.status==='hard_afgevallen'?'Afgevallen — harde eis'
    :beoordeling.status==='voorkeur_wijkt_af'?'Afwijkende voorkeur'
    :beoordeling.status==='controle_nodig'?'Controle nodig':'Voldoet';
  return {belegger,beoordeling,bron,statusLabel,aandeel};
}
