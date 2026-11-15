import { describe, expect, it } from 'vitest';
import { bouwKandidaatBulkVerzoek } from './kandidaatBulkContract';

const objectId='b1000000-0000-4000-8000-000000000001';
const requestId='b4000000-0000-4000-8000-000000000001';
const k=(id='b2000000-0000-4000-8000-000000000001',overrides:Record<string,unknown>={})=>({
  id,objectId,pipelineFase:'match_gevonden' as const,
  updatedAt:'2026-11-15T08:00:00.123456+00:00',
  ...overrides,
});

describe('Voorbereiden van transactionele kandidaatbulk — zonder backend',()=>{
  it('behoudt volledige PostgreSQL microsecondenprecisie',()=>{
    const r=bouwKandidaatBulkVerzoek(objectId,requestId,[k()],{
      type:'interesse',niveau:'warm',
    });
    expect(r.p_items[0].expected_updated_at).toBe('2026-11-15T08:00:00.123456+00:00');
    expect(r.p_object_id).toBe(objectId);
    expect(r.p_request_id).toBe(requestId);
    expect(r.p_actie).toEqual({type:'interesse',niveau:'warm'});
  });
  it('staat meerdere kandidaten en een interne afwijzing toe',()=>{
    const r=bouwKandidaatBulkVerzoek(objectId,requestId,[
      k(),k('b2000000-0000-4000-8000-000000000002'),
    ],{type:'afwijzen',bron:'intern',categorie:'locatie'});
    expect(r.p_items).toHaveLength(2);
    expect(r.p_actie).toEqual({type:'afwijzen',bron:'intern',categorie:'locatie'});
  });
  it('blokkeert ontbrekende of afgekorte databaseversies',()=>{
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k(undefined as never,{
      updatedAt:undefined,
    })],{type:'interesse',niveau:'warm'})).toThrow(/databaseversie/);
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k(undefined as never,{
      updatedAt:'2026-11-15',
    })],{type:'interesse',niveau:'warm'})).toThrow(/databaseversie/);
  });
  it('blokkeert kandidaten uit een ander object of een dubbele selectie',()=>{
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[
      k(undefined as never,{objectId:'b1000000-0000-4000-8000-000000000002'}),
    ],{type:'interesse',niveau:'warm'})).toThrow(/geselecteerde object/);
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k(),k()],{
      type:'interesse',niveau:'warm',
    })).toThrow(/tweemaal/);
  });
  it('blokkeert afgesloten trajecten en ontvangen kopersafwijzing',()=>{
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[
      k(undefined as never,{pipelineFase:'afgevallen'}),
    ],{type:'interesse',niveau:'warm'})).toThrow(/Afgevallen/);
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k()],{
      type:'afwijzen',bron:'koper',categorie:'prijs',
    } as never)).toThrow(/afzonderlijk/);
  });
  it('controleert onbekende codes en toelichting bij Anders',()=>{
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k()],{
      type:'afwijzen',bron:'intern',categorie:'onbekend',
    } as never)).toThrow(/geldige afwijzingscategorie/);
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k()],{
      type:'afwijzen',bron:'intern',categorie:'anders',
    })).toThrow(/Licht/);
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[k()],{
      type:'afwijzen',bron:'intern',categorie:'anders',anders:'A'.repeat(501),
    })).toThrow(/aanvullende/);
  });
  it('weigert een batch zonder kandidaat of met meer dan 100 kandidaten',()=>{
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,[],{
      type:'interesse',niveau:'warm',
    })).toThrow(/1 tot 100/);
    expect(()=>bouwKandidaatBulkVerzoek(objectId,requestId,
      Array.from({length:101},(_,i)=>k('b2000000-0000-4000-8000-'+(i+1).toString(16).padStart(12,'0'))),{
        type:'interesse',niveau:'warm',
      })).toThrow(/1 tot 100/);
  });
});
