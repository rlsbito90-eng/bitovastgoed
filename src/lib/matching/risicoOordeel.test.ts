import {describe,it,expect} from 'vitest';
import {maakKandidaatVoorstellen,type CrmObjectInput,type CrmRelatieInput} from './rolMandaatAdapter';
import {beoordeelRisicovoorkeuren} from './risicoOordeel';
import type {Risicovoorkeur} from '../relaties/risicovoorkeuren';

const voorkeur=(patch:Partial<Risicovoorkeur>={}):Risicovoorkeur=>({
  id:'v',relatieId:'koper',risicotype:'leegstand',bereidheid:'sluit_uit',
  bevestigd:true,bron:'Gesprek',bronDatum:null,toelichting:null,updatedAt:null,...patch,
});
const object:CrmObjectInput={id:'o',status:'beschikbaar',propertyTypeId:'wonen',provincie:'Noord-Brabant'};
const koper:CrmRelatieInput={id:'koper',type:'belegger',propertyTypeIds:['wonen'],regio:['Noord-Brabant']};
const match=(o:CrmObjectInput,r:CrmRelatieInput)=>maakKandidaatVoorstellen(o,[r],[])[0].besteRoute;

describe('Risicogestuurde matching',()=>{
  it('maakt geen leegstandsfact van ontbrekende gegevens',()=>{
    const route=match(object,{...koper,risicovoorkeuren:[voorkeur()]});
    expect(route.kwalificatie).toBe('te_verifieren');
    expect(route.toelichting.controleer.join(' ')).toContain('objectrisico nog niet vastgesteld');
    expect(route.toelichting.afwijkend).toHaveLength(0);
  });
  it('toont een geregistreerd risico en bevestigde uitsluiting zonder automatische knock-out',()=>{
    const route=match({...object,leegstandPct:30},{...koper,risicovoorkeuren:[voorkeur()]});
    expect(route.kwalificatie).toBe('te_verifieren');
    expect(route.toelichting.controleer.join(' ')).toContain('30% leegstand geregistreerd');
    expect(route.toelichting.controleer.join(' ')).toContain('bevestigde uitsluiting');
    expect(route.toelichting.afwijkend).toHaveLength(0);
  });
  it('houdt onbevestigde voorkeuren en voorwaarden expliciet onzeker',()=>{
    const controles=beoordeelRisicovoorkeuren({transformatiePotentie:true},'koper',[
      voorkeur({risicotype:'transformatie',bereidheid:'onder_voorwaarden',bevestigd:false,bron:null,toelichting:'Alleen met vergunning'}),
    ]);
    expect(controles.join(' ')).toContain('onbevestigde acceptatie onder voorwaarden');
    expect(controles.join(' ')).toContain('Alleen met vergunning');
  });
  it('behoudt de bestaande beoordeling zonder profiel en bij bevestigde acceptatie',()=>{
    expect(match(object,koper).kwalificatie).toBe('passend');
    expect(match({...object,leegstandPct:30},{...koper,risicovoorkeuren:[voorkeur({bereidheid:'accepteert'})]}).kwalificatie).toBe('passend');
  });
  it('verwart geen voorkeuren van andere kopers of ongeldige percentages',()=>{
    expect(beoordeelRisicovoorkeuren({leegstandPct:30},'koper',[voorkeur({relatieId:'ander'})])).toEqual([]);
    expect(beoordeelRisicovoorkeuren({leegstandPct:120},'koper',[voorkeur()]).join(' ')).toContain('objectrisico nog niet vastgesteld');
  });
});
