import {describe,it,expect} from 'vitest';
import type {Taak} from '@/data/mock-data';
import {bepaalCockpitOpvolging,cockpitIsActief} from './cockpitOpvolging';
const now=new Date(2026,10,18,10,0);
const t=(id:string,extra:Partial<Taak>={}):Taak=>({
  id,titel:id,status:'open',prioriteit:'normaal',deadline:'2026-11-18',...extra,
} as Taak);

describe('Objectcockpit volgt de bestaande taken',()=>{
  it('gebruikt datum én tijd, ook bij taken in uitvoering',()=>{
    const o=bepaalCockpitOpvolging([
      t('later',{deadlineTijd:'11:30'}),
      t('eerder',{status:'in_uitvoering',deadlineTijd:'09:00'}),
      t('klaar',{status:'afgerond',deadline:'2026-11-17'}),
    ],[],now);
    expect(o.volgende?.id).toBe('eerder');
    expect(o.teLaat).toBe(true);
    expect(o.overigeActies).toBe(1);
  });
  it('neemt taken van de concrete deal mee en voorkomt dubbele telling',()=>{
    const zelfde=t('zelfde',{deadline:'2026-11-20'});
    const o=bepaalCockpitOpvolging([zelfde],[zelfde,t('deal',{deadline:'2026-11-17'})],now);
    expect(o.volgende?.id).toBe('deal');
    expect(o.overigeActies).toBe(1);
  });
  it('wachten op reactie is apart en krijgt geen rode achterstandswaarschuwing',()=>{
    const o=bepaalCockpitOpvolging([t('wacht',{status:'wacht_op_reactie',deadline:'2026-11-17'})],[],now);
    expect(o.volgende).toBeNull();
    expect(o.teLaat).toBe(false);
    expect(o.wachtend.map(x=>x.id)).toEqual(['wacht']);
  });
  it('een taak zonder datum blijft zichtbaar, maar heeft nog geen deadline',()=>{
    const o=bepaalCockpitOpvolging([t('zonder',{deadline:undefined})],[],now);
    expect(o.volgende?.id).toBe('zonder');
    expect(o.zonderDeadline).toBe(true);
    expect(o.teLaat).toBe(false);
  });
  it('een datum zonder tijd is pas na die dag verlopen',()=>{
    expect(bepaalCockpitOpvolging([t('vandaag')],[],now).teLaat).toBe(false);
  });
  it('afgesloten of gearchiveerd object krijgt geen nieuwe opvolgingswaarschuwing',()=>{
    expect(cockpitIsActief({status:'beschikbaar'})).toBe(true);
    expect(cockpitIsActief({status:'verkocht'})).toBe(false);
    expect(cockpitIsActief({status:'beschikbaar',isArchived:true})).toBe(false);
    expect(cockpitIsActief({status:'beschikbaar'},{isLost:true})).toBe(false);
  });
});
