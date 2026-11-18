import {describe,it,expect} from 'vitest';
import type {Taak} from '@/data/mock-data';
import {verzamelOpenDossierTaken} from './dossierTaken';
const now=new Date(2026,10,18,12);
const taak=(id:string,extra:Partial<Taak>={}):Taak=>({
  id,titel:id,type:'Algemeen',prioriteit:'normaal',status:'open',
  deadline:'2026-11-19',...extra,
} as Taak);
describe('open taken combineren over object, relatie en concrete deal',()=>{
  it('combineert taken zonder duplicaat en sorteert echte deadlines',()=>{
    const a=taak('later',{deadline:'2026-11-20'});
    const b=taak('eerder',{deadline:'2026-11-18',deadlineTijd:'09:00',status:'in_uitvoering'});
    const c=taak('wacht',{status:'wacht_op_reactie'});
    const ids=verzamelOpenDossierTaken([[a,b],[a,c]],now).map(t=>t.id);
    expect(ids).toEqual(['eerder','wacht','later']);
  });
  it('laat afgeronde, geannuleerde en verwijderde taken weg',()=>{
    expect(verzamelOpenDossierTaken([[
      taak('afgerond',{status:'afgerond'}),
      taak('geannuleerd',{status:'geannuleerd'}),
      taak('gewist',{softDeletedAt:'2026-11-18'}),
      taak('open'),
    ]],now).map(t=>t.id)).toEqual(['open']);
  });
});
