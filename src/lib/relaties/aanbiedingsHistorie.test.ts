import { describe,expect,it } from 'vitest';
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import { aanbodHistorieVoorRelatie,isAlsAangebodenGeregistreerd } from './aanbiedingsHistorie';

const kandidaat = (extra:Partial<PipelineKandidaat>={}):PipelineKandidaat=>({
  id:'k1',objectId:'o1',relatieId:'r1',
  pipelineFase:'match_gevonden',interesseNiveau:'lauw',
  teaserVerstuurd:false,ndaVerstuurd:false,ndaGetekend:false,
  informatieGedeeld:false,feeAkkoord:false,...extra,
});
const moment=(extra:Partial<ContactMoment>={}):ContactMoment=>({
  id:'m1',momentDate:'2026-11-10',type:'teaser_verstuurd',direction:'uitgaand',
  title:'Teaser gedeeld',followUpRequired:false,isSystem:false,
  relatieId:'r1',objectId:'o1',createdAt:'2026-11-10T12:00:00Z',
  updatedAt:'2026-11-10T12:00:00Z',...extra,
});

describe('Aanbiedingshistorie bij investeerder',()=>{
  it('interne match is geen daadwerkelijk aanbod',()=>{
    const x=aanbodHistorieVoorRelatie([kandidaat()],[]);
    expect(x[0].bewijs).toBe('niet_geregistreerd');
    expect(isAlsAangebodenGeregistreerd(x[0])).toBe(false);
    expect(x[0].eersteAanbieddatum).toBeUndefined();
  });
  it('expliciete teaser of informatie geldt als aangeboden, met juiste datum',()=>{
    const x=aanbodHistorieVoorRelatie([
      kandidaat({teaserVerstuurd:true,teaserVerstuurdOp:'2026-11-08',informatieGedeeld:true,
        informatieGedeeldOp:'2026-11-10'}),
    ],[]);
    expect(isAlsAangebodenGeregistreerd(x[0])).toBe(true);
    expect(x[0].eersteAanbieddatum).toBe('2026-11-08');
    expect(x[0].momenten).toHaveLength(2);
  });
  it('tijdlijnsignaal vereist dezelfde relatie én hetzelfde object',()=>{
    const x=aanbodHistorieVoorRelatie([kandidaat()],[
      moment({relatieId:'r2'}),
      moment({id:'m2',objectId:'o2'}),
      moment({id:'m3',type:'email'}),
    ]);
    expect(x[0].bewijs).toBe('niet_geregistreerd');
    expect(x[0].momenten).toHaveLength(0);
  });
  it('apart geregistreerd aanbodmoment toont aanbieding zonder pipelinevlag',()=>{
    const x=aanbodHistorieVoorRelatie([kandidaat()],[moment()]);
    expect(x[0].bewijs).toBe('expliciet');
    expect(x[0].eersteAanbieddatum).toBe('2026-11-10');
  });
  it('fase teaser verstuurd zonder bewijsdatum blijft expliciet als datum onbekend',()=>{
    const x=aanbodHistorieVoorRelatie([kandidaat({pipelineFase:'teaser_verstuurd'})],[]);
    expect(x[0].bewijs).toBe('fase_zonder_datum');
    expect(x[0].eersteAanbieddatum).toBeUndefined();
  });
  it('afgewezen dossier zonder teaserflag is niet automatisch aantoonbaar aangeboden',()=>{
    const x=aanbodHistorieVoorRelatie([kandidaat({
      pipelineFase:'afgevallen',redenAfgevallen:'Te laag rendement',
    })],[]);
    expect(x[0].bewijs).toBe('niet_geregistreerd');
  });
  it('zelfde teaser op pipeline en in tijdlijn telt eenmaal als gebeurtenis',()=>{
    const x=aanbodHistorieVoorRelatie([kandidaat({
      teaserVerstuurd:true,teaserVerstuurdOp:'2026-11-10',
    })],[moment()]);
    expect(x[0].momenten).toHaveLength(1);
  });
});
