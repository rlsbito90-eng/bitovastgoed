import {describe,it,expect} from 'vitest';
import {controleerKopersprofiel} from './kopersprofielCheck';
import type {CrmRelatieInput,CrmMandaatInput} from './rolMandaatAdapter';
import type {Rendementscriterium} from '@/hooks/useRelatieMatchingData';
const r:CrmRelatieInput={id:'r',type:'belegger',propertyTypeIds:['wonen'],dealTypeIds:['belegging'],regio:['Heel Nederland'],budgetMax:1000000};
const p:CrmMandaatInput={id:'p',relatieId:'r',status:'actief',naam:'Kantoor'};
const factor:Rendementscriterium={id:'f',relatieId:'r',zoekprofielId:null,strategie:'belegging',methode:'factor',percentage:12,criteriumType:'maximum',methodeBevestigd:true,status:'actief',toelichting:null,bron:'gesprek',bronDatum:null};
describe('Kopersprofielcheck',()=>{
  it('treats nationwide and maximum-only budget as recorded choices',()=>{
    const ids=controleerKopersprofiel(r,[],[factor],[])[0].punten.map(x=>x.id);
    expect(ids).toEqual(['voorwaarden','risico']);
  });
  it('does not mix different search routes',()=>{
    const routes=controleerKopersprofiel(r,[p],[],[]);
    expect(routes[1].punten.map(x=>x.id)).toEqual(['vastgoed','strategie','locatie','budget','rendement']);
    expect(routes[0].punten.map(x=>x.id)).not.toContain('vastgoed');
  });
  it('ignores inactive profiles and unrelated buyer criteria',()=>{
    const routes=controleerKopersprofiel(r,[{...p,status:'pauze'}],[{...factor,relatieId:'ander'}],[]);
    expect(routes).toHaveLength(1);
    expect(routes[0].punten.some(x=>x.id==='rendement')).toBe(true);
  });
  it('does not suggest turning a seller into a buyer',()=>{
    expect(controleerKopersprofiel({id:'s',type:'verkoper'},[],[],[])).toEqual([]);
  });
  it('requests confirmation rather than interpreting an unknown return method',()=>{
    expect(controleerKopersprofiel(r,[],[{...factor,methodeBevestigd:false}],[])[0].punten.find(x=>x.id==='rendement')?.label).toBe('Rendementsdefinitie te bevestigen');
  });
});
