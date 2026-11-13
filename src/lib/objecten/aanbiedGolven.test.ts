import { describe,expect,it } from 'vitest';
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import {
  bepaalGolfKandidaatStatus,berekenGolfVoortgang,valideerNieuweGolf,
  type GolfSelectie,
} from './aanbiedGolven';

const k=(extra:Partial<PipelineKandidaat>={}):PipelineKandidaat=>({
  id:'k1',objectId:'o1',relatieId:'r1',
  pipelineFase:'match_gevonden',interesseNiveau:'lauw',
  teaserVerstuurd:false,ndaVerstuurd:false,ndaGetekend:false,
  informatieGedeeld:false,feeAkkoord:false,...extra,
});
const m=(extra:Partial<ContactMoment>={}):ContactMoment=>({
  id:'m1',objectId:'o1',relatieId:'r1',momentDate:'2026-11-05',
  direction:'uitgaand',type:'teaser_verstuurd',isSystem:false,
  followUpRequired:false,title:'Teaser',createdAt:'2026-11-05T08:00:00Z',
  updatedAt:'2026-11-05T08:00:00Z',...extra,
});
const react=(status:'interesse'|'afgewezen'|'geen_reactie',extra:Partial<ContactMoment>={})=>
  m({
    direction:status==='geen_reactie'?'intern':'inkomend',type:'whatsapp',
    momentDate:'2026-11-09',
    aanbiedingReactie:{
      versie:'1',status,redenen:status==='afgewezen'?['prijs']:[],
      duiding:'onbekend',kanaal:'whatsapp',
    },
    ...extra,
  });

describe('Gefaseerd aanbieden zonder dubbele kandidaatadministratie',()=>{
  it('een geselecteerde kandidaat is nog niet benaderd',()=>{
    expect(bepaalGolfKandidaatStatus(k(),[],'2026-11-12').status)
      .toBe('niet_benaderd');
  });
  it('outgoing teaser telt als verstuurd, maar geen antwoord na 5 dagen als opvolging',()=>{
    const x=bepaalGolfKandidaatStatus(k(),[m()],'2026-11-12');
    expect(x.status).toBe('opvolgen');
    expect(x.laatsteAanbieddatum).toBe('2026-11-05');
  });
  it('zelfde kandidaat met recente teaser wacht op antwoord',()=>{
    const x=bepaalGolfKandidaatStatus(
      k({teaserVerstuurd:true,teaserVerstuurdOp:'2026-11-10'}),
      [],'2026-11-12',
    );
    expect(x.status).toBe('wachten');
  });
  it('expliciete afwijzing of interesse telt als inhoudelijke reactie, stilte niet',()=>{
    expect(bepaalGolfKandidaatStatus(k(),[m(),react('afgewezen')],'2026-11-12').status)
      .toBe('gereageerd');
    expect(bepaalGolfKandidaatStatus(k(),[m(),react('geen_reactie')],'2026-11-12').status)
      .toBe('opvolgen');
  });
  it('reactie op een ander object of andere relatie heeft geen invloed',()=>{
    const x=bepaalGolfKandidaatStatus(k(),[
      m(),react('interesse',{objectId:'o2'}),
      react('afgewezen',{relatieId:'r2'}),
    ],'2026-11-12');
    expect(x.status).toBe('opvolgen');
  });
  it('oude positieve reactie is geen antwoord op een later opnieuw aangeboden dossier',()=>{
    const x=bepaalGolfKandidaatStatus(k({
      teaserVerstuurd:true,teaserVerstuurdOp:'2026-11-11',
    }),[react('interesse',{momentDate:'2026-11-07'})],'2026-11-12');
    expect(x.status).toBe('wachten');
  });
  it('teaser wel verstuurd zonder datum blijft te verifiëren',()=>{
    expect(bepaalGolfKandidaatStatus(k({teaserVerstuurd:true}),
      [],'2026-11-12').status).toBe('datum_onbekend');
  });
  it('geen golf 2 impliciet goedkeuren als aanbieding nog niet is verstuurd',()=>{
    const x=berekenGolfVoortgang([k()],[],'2026-11-12');
    expect(x.nietBenaderd).toBe(1);
    expect(x.vervolgadvies).toMatch(/eerst de aanbieding/);
  });
  it('na alle concrete reacties mag de markttoets worden geëvalueerd',()=>{
    const x=berekenGolfVoortgang([k()],[
      m(),react('interesse'),
    ],'2026-11-12');
    expect(x.gereageerd).toBe(1);
    expect(x.vervolgadvies).toMatch(/Beoordeel hun redenen/);
  });
  it('golven selecteren bestaande kandidaatrecords, elk hooguit eenmaal, maximaal drie',()=>{
    const ks=[k(),k({id:'k2',relatieId:'r2'}),k({id:'k3',relatieId:'r3'}),k({id:'k4',relatieId:'r4'})];
    const old:GolfSelectie[]=[{id:'s1',golfId:'g1',
      objectId:'o1',kandidaatId:'k1',geselecteerdOp:'2026-11-12T08:00:00Z'}];
    expect(valideerNieuweGolf(['k2','k3'],ks,old)).toBeNull();
    expect(valideerNieuweGolf(['k1'],ks,old)).toMatch(/al in een eerdere golf/);
    expect(valideerNieuweGolf(['k2','k2'],ks,old)).toMatch(/slechts één keer/);
    expect(valideerNieuweGolf(['k2','k3','k4','k1'],ks,old)).toMatch(/één tot drie/);
    expect(valideerNieuweGolf(['niet-bestaand'],ks,old)).toMatch(/eerst aan het object/);
  });
});
