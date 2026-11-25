import { describe, expect, it } from 'vitest';
import { matchingOfferDeals, matchingOfferCandidates, resolveOfferLink } from './offerLinks';

const deal = {id:'d1',objectId:'o1',relatieId:'r1',fase:'onderhandeling'};
describe('offer link resolution',()=>{
  it('matches both object and buyer and excludes terminal and archived deals',()=>{
    const list=[deal,{...deal,id:'d2',relatieId:'r2'},{...deal,id:'d3',objectId:'o2'},{...deal,id:'d4',isArchived:true},{...deal,id:'d5',fase:'afgevallen'},{...deal,id:'d6',fase:'afgerond'},{...deal,id:'d7',softDeletedAt:'2026-11-24'}];
    expect(matchingOfferDeals(list,'o1','r1')).toEqual([deal]);
    expect(matchingOfferDeals(list,'','r1')).toEqual([]);
  });
  it('auto-links unique matches but never chooses among ambiguous matches',()=>{
    expect(resolveOfferLink([deal])).toBe('d1');
    expect(resolveOfferLink([deal,{...deal,id:'d2'}])).toBeNull();
    expect(resolveOfferLink([deal,{...deal,id:'d2'}],'d2')).toBe('d2');
    expect(resolveOfferLink([],'d1')).toBeNull();
  });
  it('does not reuse another object or buyer candidate id',()=>{
    const candidates=[{id:'p1',objectId:'o1',relatieId:'r1'},{id:'p2',objectId:'o2',relatieId:'r1'},{id:'p3',objectId:'o1',relatieId:'r2'}];
    expect(resolveOfferLink(matchingOfferCandidates(candidates,'o1','r1'),'p2')).toBe('p1');
  });
});
