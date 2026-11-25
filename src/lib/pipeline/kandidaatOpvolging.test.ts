import {describe,it,expect} from 'vitest';
import {kandidaatOpvolging} from './kandidaatOpvolging';
import {maakBasisKandidaat} from './basisKandidaat';
import type {PipelineKandidaat,Taak,Deal} from '@/data/mock-data';
import type {ContactMoment} from '@/lib/contactMoments';
const k:PipelineKandidaat={id:'k',...maakBasisKandidaat({objectId:'o',relatieId:'r'})};
const taak=(patch:Partial<Taak>={}):Taak=>({id:'t',titel:'Opvolgen',objectId:'o',relatieId:'r',type:'Follow-up',deadline:'2026-11-20',prioriteit:'normaal',status:'open',...patch});
const moment=(patch:Partial<ContactMoment>={}):ContactMoment=>({id:'m',momentDate:'2026-11-19',type:'email',direction:'inkomend',title:'Reactie',relatieId:'r',objectId:'o',isSystem:false,followUpRequired:false,createdAt:'2026-11-19T10:00:00Z',updatedAt:'2026-11-19T10:00:00Z',...patch});
const now=new Date(2026,10,25,10);
describe('Kandidaat opvolging',()=>{
  it('does not infer a sent offer from selection or a generic email',()=>{
    expect(kandidaatOpvolging(k,[moment()],[],[],now)).toMatchObject({historie:{bewijs:'niet_geregistreerd'},actief:true,reactie:null,openTaken:[]});
  });
  it('recognizes explicit offer evidence and relevant existing tasks only',()=>{
    const x=kandidaatOpvolging(k,[moment({direction:'uitgaand',type:'teaser_verstuurd'})],[taak(),taak({id:'ander',relatieId:'ander'}),taak({id:'gesloten',status:'afgerond'}),taak({id:'algemeen',objectId:undefined})],[],now);
    expect(x.historie.bewijs).toBe('expliciet');expect(x.openTaken.map(t=>t.id)).toEqual(['t']);expect(x.teLaat).toBe(true);
  });
  it('uses deal-linked tasks only for the exact candidate pair',()=>{
    const deal={id:'d',objectId:'o',relatieId:'r'} as Deal;
    expect(kandidaatOpvolging(k,[],[taak({objectId:undefined,relatieId:undefined,dealId:'d'})],[deal],now).taak?.id).toBe('t');
    expect(kandidaatOpvolging(k,[],[taak({objectId:undefined,relatieId:'ander',dealId:'d'})],[deal],now).taak).toBeUndefined();
  });
  it('does not replace an actual response with later silence or suggest new outreach after rejection',()=>{
    const afwijzing=moment({aanbiedingReactie:{versie:'1',status:'afgewezen',redenen:['prijs'],duiding:'object',kanaal:'email'}});
    const stilte=moment({id:'stil',momentDate:'2026-11-24',direction:'intern',aanbiedingReactie:{versie:'1',status:'geen_reactie',redenen:[],duiding:'onbekend',kanaal:'email'}});
    const x=kandidaatOpvolging(k,[afwijzing,stilte],[],[],now);
    expect(x.reactie?.label).toBe('Afgewezen');expect(x.actief).toBe(false);
  });
});
