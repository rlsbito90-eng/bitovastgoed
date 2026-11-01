import { describe,expect,it } from 'vitest';
import type { Relatie, Zoekprofiel, PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import { maakClassificatieReview, suggereerPartijprofiel, tekstProfielSuggestie,prioriteerClassificatieReviews } from './classificatieReview';
const bron=(x:Partial<Relatie>={})=>({
  id:'r1',bedrijfsnaam:'Voorbeeld BV',type:'belegger',partijprofiel:null,softDeletedAt:undefined,investeerderSubtype:undefined,...x,
}) as Relatie;
describe('A15 — alleen read-only classificatievoorstellen',()=>{
  it('classificeert historische standaard Belegger NIET automatisch',()=>{
    const s=suggereerPartijprofiel(bron());
    expect(s.voorstel).toBeNull();
    expect(s.zekerheid).toBe('onvoldoende');
  });
  it('toont historische expliciete Family office of Fonds als te controleren voorstel',()=>{
    const a=suggereerPartijprofiel(bron({investeerderSubtype:'family_office'}));
    const b=suggereerPartijprofiel(bron({investeerderSubtype:'fonds'}));
    expect(a.voorstel).toBe('family_office');
    expect(b.voorstel).toBe('fonds');
    expect(a.zekerheid).toBe('gericht_nakijken');
    expect(tekstProfielSuggestie(a)).toBe('Family office');
  });
  it('historische ontwikkelaar blijft een controlevoorstel: kan ontwikkelende belegger zijn',()=>{
    const s=suggereerPartijprofiel(bron({type:'ontwikkelaar'}));
    expect(s.voorstel).toBe('ontwikkelaar');
    expect(s.bewijs).toContain('ontwikkelende belegger');
  });
  it('makelaar en eigenaar worden NIET automatisch fijnmazig ondergebracht',()=>{
    for(const type of ['makelaar','eigenaar'] as const)
      expect(suggereerPartijprofiel(bron({type})).voorstel).toBeNull();
  });
  it('actieve geregistreerde profielen blijven intact, gearchiveerde relaties worden uitgesloten',()=>{
    const values=Object.freeze([
      Object.freeze(bron({id:'a',partijprofiel:'buitenlandse_belegger'})),
      Object.freeze(bron({id:'b',softDeletedAt:'2026-10-01'})),
      Object.freeze(bron({id:'c',investeerderSubtype:'fonds'})),
    ]);
    const before=JSON.stringify(values);
    const result=maakClassificatieReview(values);
    expect(result.map(x=>x.relatieId)).toEqual(['a','c']);
    expect(result[0].status).toBe('reeds_ingevuld');
    expect(result[0].huidigeProfiel).toBe('buitenlandse_belegger');
    expect(result[1].status).toBe('voorstel_controleren');
    expect(JSON.stringify(values)).toBe(before);
  });
  it('leidt Buitenlandse belegger niet af uit een ander vestigingsland of buitenlandse naam',()=>{
    const s=suggereerPartijprofiel(bron({vestigingsland:'DE',bedrijfsnaam:'Foreign Capital Ltd'}));
    expect(s.voorstel).toBeNull();
  });
  it('leidt geen ontwikkelende belegger of strategie af uit de oude ontwikkelaarrol',()=>{
    const s=suggereerPartijprofiel(bron({commercialRoles:['ontwikkelaar'],type:'belegger'}));
    expect(s.voorstel).toBeNull();
  });
  it('blokkeert automatische suggesties bij naamloze of alleen Onbekend genoemde partijen, zonder pipelineverlies',()=>{
    const data=[bron({id:'leeg',bedrijfsnaam:'',type:'ontwikkelaar'}),
      bron({id:'onbekend',bedrijfsnaam:'Onbekend',type:'ontwikkelaar'})];
    const result=maakClassificatieReview(data);
    expect(result).toHaveLength(2);
    expect(result.every(r=>r.status==='onderzoek_nodig'&&r.suggestie?.voorstel===null)).toBe(true);
    expect(result.every(r=>r.datakwaliteit==='naam_controleren')).toBe(true);
    expect(data[0].type).toBe('ontwikkelaar');
  });
  it('plaatst bestaande pipeline en actieve zoekprofielen vooraan zonder profielen te wijzigen',()=>{
    const data=[
      bron({id:'gewone',type:'ontwikkelaar'}),
      bron({id:'pipeline',type:'ontwikkelaar',bedrijfsnaam:''}),
      bron({id:'profiel',type:'belegger'}),
      bron({id:'al_ingedeeld',partijprofiel:'fonds'}),
    ];
    const pipeline=[{id:'p1',relatieId:'pipeline',objectId:'o1'}] as PipelineKandidaat[];
    const profielen=[{id:'z1',relatieId:'profiel',status:'actief'}] as Zoekprofiel[];
    const momenten=[{id:'m1',relatieId:'pipeline'}] as ContactMoment[];
    const resultaat=prioriteerClassificatieReviews(data,profielen,pipeline,momenten);
    expect(resultaat.map(x=>x.relatieId).slice(0,2)).toEqual(['pipeline','profiel']);
    expect(resultaat[0]).toMatchObject({pipelineKoppelingen:1,contactmomenten:1,prioriteit:'hoog',datakwaliteit:'naam_controleren'});
    expect(resultaat[1]).toMatchObject({actieveZoekprofielen:1,prioriteit:'hoog'});
    expect(resultaat.find(r=>r.relatieId==='al_ingedeeld')?.huidigeProfiel).toBe('fonds');
    expect(data[1].partijprofiel).toBeNull();
  });
  it('genegeerde en niet-actieve zoekprofielen verhogen de prioriteit niet',()=>{
    const data=[bron({id:'a',bedrijfsnaam:'Voorbeeld'})];
    const profielen=[{id:'1',relatieId:'a',status:'inactief'}] as Zoekprofiel[];
    const result=prioriteerClassificatieReviews(data,profielen,[],[]);
    expect(result[0].actieveZoekprofielen).toBe(0);
    expect(result[0].prioriteit).toBe('regulier');
  });

});
