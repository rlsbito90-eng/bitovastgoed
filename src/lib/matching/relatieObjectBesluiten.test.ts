import {describe,it,expect} from 'vitest';
import {sorteerVoorstellenOpBesluit} from './relatieObjectBesluiten';
const voorstellen=[{relatieId:'nieuw'},{relatieId:'interessant'},{relatieId:'afgewezen'},{relatieId:'pipeline'}];
describe('één beslissing in twee CRM-richtingen',()=>{
  const besluiten=[
    {relatieId:'interessant',status:'interessant' as const},
    {relatieId:'afgewezen',status:'afgewezen' as const},
  ];
  it('prioriteert handmatig interessant en verbergt afwijzingen',()=>{
    expect(sorteerVoorstellenOpBesluit(voorstellen,besluiten,new Set(['pipeline']))
      .map(r=>r.relatieId)).toEqual(['interessant','nieuw']);
  });
  it('verliest niet automatisch de volgorde van onbeoordeelde suggesties',()=>{
    expect(sorteerVoorstellenOpBesluit(voorstellen,[],new Set())
      .map(r=>r.relatieId)).toEqual(voorstellen.map(r=>r.relatieId));
  });
  it('een afgewezen voorstel blijft uit standaardoverzicht',()=>{
    expect(sorteerVoorstellenOpBesluit(voorstellen,besluiten,new Set())
      .some(x=>x.relatieId==='afgewezen')).toBe(false);
  });
});
