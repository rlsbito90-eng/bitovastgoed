import {describe,it,expect} from 'vitest';
import {maakKandidaatVoorstellen,type CrmObjectInput,type CrmRelatieInput} from './rolMandaatAdapter';
import {bepaalMatchBewijskwaliteit,vergelijkMatchBewijs} from './matchBewijskwaliteit';
import type {RendementsOordeel} from './rendementsOordeel';
const o:CrmObjectInput={id:'o',status:'beschikbaar',propertyTypeId:'wonen',dealTypeIds:['belegging'],provincie:'Noord-Holland',vraagprijs:500000};
const r:CrmRelatieInput={id:'r',type:'belegger',propertyTypeIds:['wonen'],regio:['Noord-Holland'],budgetMax:750000};
const match=(rel:CrmRelatieInput,object:CrmObjectInput=o)=>maakKandidaatVoorstellen(object,[rel],[],{toonAfwijkende:true})[0].besteRoute;
describe('Aansluiting en onderbouwing',()=>{
  it('does not make missing strategy and financial criteria into matches',()=>{
    expect(bepaalMatchBewijskwaliteit(match(r))).toMatchObject({passend:3,beoordeeld:3,totaal:5,aansluiting:100,onderdelen:{strategie:'niet_ingevuld',rendement:'niet_ingevuld'}});
  });
  it('withholds percentages on a single assessed criterion',()=>{
    expect(bepaalMatchBewijskwaliteit(match({...r,regio:[],budgetMax:null}))).toMatchObject({passend:1,beoordeeld:1,aansluiting:null});
  });
  it('keeps known deviations and unknown facts separate',()=>{
    const k=bepaalMatchBewijskwaliteit(match({...r,propertyTypeIds:['kantoor'],dealTypeIds:['belegging']},{...o,provincie:null}));
    expect(k).toMatchObject({passend:2,afwijkend:1,beoordeeld:3,aansluiting:67,onderdelen:{vastgoed:'afwijkend',locatie:'controle'}});
  });
  it('a national scope is not specific location evidence',()=>{
    expect(bepaalMatchBewijskwaliteit(match({...r,regio:['Heel Nederland']}))?.onderdelen.locatie).toBe('controle');
  });
  it('BAR and factor are one financial family; stronger evidence outranks thinner perfect fits',()=>{
    const finance:RendementsOordeel={status:'indicatief_voldoet',uitleg:'BAR en Factor passend',hardKnockout:false};
    const sterk=bepaalMatchBewijskwaliteit(match({...r,dealTypeIds:['belegging']}),finance);
    const dun=bepaalMatchBewijskwaliteit(match({...r,budgetMax:null}));
    expect(sterk).toMatchObject({passend:5,totaal:5,beoordeeld:5});
    expect(vergelijkMatchBewijs(sterk,dun)).toBeLessThan(0);
  });
});
