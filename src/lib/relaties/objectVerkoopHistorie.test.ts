import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { gekoppeldeVerkoopobjecten } from './objectVerkoopHistorie';

const o=(x:Partial<ObjectVastgoed>={}):ObjectVastgoed=>({
  id:'object-1',titel:'Pand',type:'wonen',plaats:'Breda',provincie:'Noord-Brabant',
  anoniem:true,status:'beschikbaar',exclusief:false,verhuurStatus:'leeg',
  isPortefeuille:false,ontwikkelPotentie:false,transformatiePotentie:false,
  datumToegevoegd:'2026-11-01',...x,
});

describe('Verkooprelatie: historische objecten',()=>{
  it('toont alle niet-verwijderde, gekoppelde objecten, ook verkocht en gearchiveerd',()=>{
    const items=[
      o({id:'o1',titel:'Oud',eigenaarRelatieId:'r1',datumToegevoegd:'2026-01-04',status:'verkocht'}),
      o({id:'o2',titel:'Nieuw',eigenaarRelatieId:'r1',datumToegevoegd:'2026-11-02',isArchived:true}),
      o({id:'o3',titel:'Andere verkoper',eigenaarRelatieId:'r2'}),
      o({id:'o4',titel:'Verwijderd',eigenaarRelatieId:'r1',softDeletedAt:'2026-11-05'}),
    ];
    expect(gekoppeldeVerkoopobjecten('r1',items).map(x=>x.id)).toEqual(['o2','o1']);
  });
  it('behandelt identieke vrije verkopersnaam niet automatisch als dezelfde partij',()=>{
    const items=[o({id:'tekst',verkoperNaam:'Jansen',eigenaarRelatieId:undefined})];
    expect(gekoppeldeVerkoopobjecten('r1',items)).toEqual([]);
  });
  it('wijzigt geen oorspronkelijke objecten',()=>{
    const objecten=Object.freeze([Object.freeze(o({eigenaarRelatieId:'r1'}))]);
    expect(gekoppeldeVerkoopobjecten('r1',objecten)).toHaveLength(1);
    expect(objecten[0].id).toBe('object-1');
  });
});
