import { describe, expect, it } from 'vitest';
import { beoordeelKoperscriteria as toets, type Koperscriterium } from './criteriumMotor';

const area: Koperscriterium = {
  id: 'verdeling:hal', label: 'Bedrijfsruimte minimaal 70%',
  soort: 'aandeel', gebruiksfunctieCode: 'bedrijfsruimte', operator: 'min',
  percentage: 70, meetbasis: 'vvo', sterkte: 'hard',
};
const parts = (hal: number, kantoor: number, wonen=0) => ({
  volledigheidBevestigd: true, zonderOverlapBevestigd: true,
  onderdelen: [
    { id: 'hal', gebruiksfunctieCode: 'bedrijfsruimte', oppervlakteM2: hal, meetbasis: 'vvo' as const },
    { id: 'kantoor', gebruiksfunctieCode: 'kantoor', oppervlakteM2: kantoor, meetbasis: 'vvo' as const },
    ...(wonen ? [{ id: 'woning', gebruiksfunctieCode: 'wonen',
      oppervlakteM2: wonen, meetbasis: 'vvo' as const }] : []),
  ],
});
describe('Centrale criteriummotor: harde eisen, voorkeuren en bewijs',()=>{
  it('70/30 exact op de grens voldoet; bedrijfsruimte plus alle overige functies',()=>{
    const x=toets([area],{samenstelling:parts(700,300)});
    expect(x.status).toBe('voldoet');
    expect(x.beoordelingen[0].diskwalificatie).toBe(false);
  });
  it('65/25/10 is harde afwijzing ondanks eventuele positieve criteria',()=>{
    const x=toets([area,{
      soort:'getal',id:'bouwjaar',label:'Bouwjaar',veld:'bouwjaar',min:1980,sterkte:'voorkeur',
    }],{samenstelling:parts(650,250,100),bouwjaar:2000});
    expect(x.status).toBe('hard_afgevallen');
    expect(x.voldoet).toBe(1);
    expect(x.wijktAf).toBe(1);
    expect(x.hardeAfwijzing).toBe(true);
  });
  it('voorkeursafwijking is geen knock-out',()=>{
    const x=toets([{...area,sterkte:'voorkeur'}],{samenstelling:parts(650,350)});
    expect(x.status).toBe('voorkeur_wijkt_af');
    expect(x.hardeAfwijzing).toBe(false);
  });
  it('onbekend of niet-afgebakend is geen harde uitsluiting',()=>{
    const geen=toets([area],{});
    const onvolledig=toets([area],{samenstelling:{...parts(650,350),volledigheidBevestigd:false}});
    expect(geen.status).toBe('controle_nodig');
    expect(onvolledig.status).toBe('controle_nodig');
    expect(onvolledig.hardeAfwijzing).toBe(false);
  });
  it('VVO/GBO gemengd geeft controle nodig, geen verzonnen ratio',()=>{
    const basis=parts(650,350);
    const x=toets([area],{samenstelling:{
      ...basis,onderdelen:[basis.onderdelen[0],{...basis.onderdelen[1],meetbasis:'gbo'}],
    }});
    expect(x.status).toBe('controle_nodig');
  });
  it('generieke getalvergelijking werkt voor minima, maxima en onbekenden',()=>{
    const regels: Koperscriterium[]=[
      {soort:'getal',id:'jaar',label:'Bouwjaar',veld:'bouwjaar',min:1980,max:2000,sterkte:'voorkeur'},
      {soort:'getal',id:'leeg',label:'Leegstand',veld:'leegstandPct',max:10,sterkte:'voorkeur'},
    ];
    expect(toets(regels,{bouwjaar:1985,leegstandPct:0}).status).toBe('voldoet');
    expect(toets(regels,{bouwjaar:1965,leegstandPct:15}).wijktAf).toBe(2);
    expect(toets(regels,{bouwjaar:null,leegstandPct:null}).controleNodig).toBe(2);
    expect(toets([regels[0]],{bouwjaar:1980}).voldoet).toBe(1);
    expect(toets([{...regels[0],min:2020,max:1980}],{bouwjaar:1990}).status).toBe('controle_nodig');
  });
  it('energielabel-rangorde en onbekend label blijven betrouwbaar',()=>{
    const regel:Koperscriterium={soort:'energielabel',id:'label',label:'Energielabel',minimaal:'A',sterkte:'voorkeur'};
    expect(toets([regel],{energielabel:'A++++'}).status).toBe('voldoet');
    expect(toets([regel],{energielabel:'G'}).status).toBe('voorkeur_wijkt_af');
    expect(toets([regel],{energielabel:'onbekend'}).status).toBe('controle_nodig');
  });
  it('keuzecriterium en portefeuille leveren geen valse zekerheid',()=>{
    const regel:Koperscriterium={soort:'keuze',id:'huur',label:'Verhuur',veld:'verhuurStatus',waarde:'verhuurd',sterkte:'voorkeur'};
    expect(toets([regel],{verhuurStatus:'verhuurd'}).status).toBe('voldoet');
    expect(toets([regel],{verhuurStatus:'leeg'}).status).toBe('voorkeur_wijkt_af');
    expect(toets([regel],{verhuurStatus:'verhuurd',isPortefeuille:true}).status).toBe('controle_nodig');
  });
  it('een dubbel criterium-ID mag een tegenstrijdige harde eis niet stilzwijgend accepteren',()=>{
    const x=toets([{...area,sterkte:'voorkeur'},area],{samenstelling:parts(700,300)});
    expect(x.status).toBe('controle_nodig');
    expect(x.controleNodig).toBe(1);
  });
  it('geen regels veroorzaakt geen extra handelingen of taken',()=>{
    const x=toets([],{});
    expect(x.beoordelingen).toEqual([]);
    expect(x.hardeAfwijzing).toBe(false);
  });
});
